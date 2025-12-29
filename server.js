const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 10000,
    pingInterval: 5000
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// In-memory storage
let waitingUsers = [];
let activeChats = new Map(); // socketId -> partnerId
let userConnections = new Map(); // socketId -> { connectedAt, lastActivity }

// User class
class User {
    constructor(socketId, username, municipality, interests, randomMode) {
        this.socketId = socketId;
        this.username = username;
        this.municipality = municipality;
        this.interests = interests;
        this.randomMode = randomMode;
        this.partnerId = null;
        this.connectedAt = Date.now();
    }
}

// Matching logic
function findMatch(user) {
    if (waitingUsers.length === 0) return null;

    let match = null;

    if (user.randomMode) {
        match = waitingUsers[0];
    } else {
        if (user.municipality) {
            match = waitingUsers.find(u => u.municipality && u.municipality === user.municipality && !u.randomMode && u.socketId !== user.socketId);
        }
        if (!match && user.interests && user.interests.length > 0) {
            match = waitingUsers.find(u => {
                if (!u.interests || u.interests.length === 0 || u.randomMode) return false;
                return u.interests.some(i => user.interests.includes(i));
            });
        }
        if (!match) {
            match = waitingUsers[0];
        }
    }

    if (match) {
        waitingUsers = waitingUsers.filter(u => u.socketId !== match.socketId);
    }
    return match;
}

function getMatchReason(user1, user2) {
    if (user1.randomMode || user2.randomMode) return 'Random connection';
    if (user1.municipality && user2.municipality && user1.municipality === user2.municipality) {
        return `Both from ${user1.municipality}`;
    }
    if (user1.interests && user2.interests && user1.interests.length > 0 && user2.interests.length > 0) {
        const shared = user1.interests.find(i => user2.interests.includes(i));
        if (shared) return `Shared interest: ${shared}`;
    }
    return 'Random connection';
}

// Socket.IO
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    userConnections.set(socket.id, { connectedAt: Date.now(), lastActivity: Date.now() });

    socket.on('start-search', (userData) => {
        const user = new User(socket.id, userData.username, userData.municipality, userData.interests, userData.randomMode);
        const match = findMatch(user);

        if (match) {
            user.partnerId = match.socketId;
            match.partnerId = user.socketId;
            activeChats.set(socket.id, match.socketId);
            activeChats.set(match.socketId, socket.id);

            const matchReason = getMatchReason(user, match);

            socket.emit('match-found', {
                partnerId: match.socketId,
                partnerUsername: match.username,
                partnerMunicipality: match.municipality,
                partnerInterests: match.interests,
                matchReason
            });

            io.to(match.socketId).emit('match-found', {
                partnerId: socket.id,
                partnerUsername: user.username,
                partnerMunicipality: user.municipality,
                partnerInterests: user.interests,
                matchReason
            });

            console.log(`✓ Match made: ${user.username} <-> ${match.username}`);
        } else {
            waitingUsers.push(user);
            socket.emit('searching');
            console.log(`→ User ${userData.username} added to waiting list`);
        }
    });

    // Messages
    socket.on('send-message', (data) => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            if (userConnections.has(socket.id)) userConnections.get(socket.id).lastActivity = Date.now();
            io.to(partnerId).emit('receiveMessage', {
                text: data.text,
                messageId: data.messageId || Date.now(),
                replyTo: data.replyTo,
                username: data.username || "Stranger",
                timestamp: Date.now()
            });
            console.log(`Message: ${socket.id} → ${partnerId} ${data.replyTo ? "(reply)" : ""}`);
        }
    });

    // Reactions
    socket.on('reactMessage', (data) => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('reactionAdded', { messageId: data.messageId, emoji: data.emoji });
            socket.emit('reactionAdded', { messageId: data.messageId, emoji: data.emoji });
            console.log(`Reaction: ${socket.id} reacted ${data.emoji} to ${data.messageId}`);
        }
    });

    // Typing
    socket.on('typing', (data) => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) io.to(partnerId).emit('typing', { typing: data.typing });
    });

    socket.on('stop-chat', () => handleDisconnection(socket.id, true));
    socket.on('disconnect', (reason) => handleDisconnection(socket.id, false));
    socket.on('heartbeat', () => { if (userConnections.has(socket.id)) userConnections.get(socket.id).lastActivity = Date.now(); });

    function handleDisconnection(socketId, voluntary) {
        waitingUsers = waitingUsers.filter(u => u.socketId !== socketId);
        const partnerId = activeChats.get(socketId);
        if (partnerId) {
            io.to(partnerId).emit('partner-disconnected');
            activeChats.delete(partnerId);
            io.to(partnerId).emit('partner-stop-typing');
        }
        activeChats.delete(socketId);
        userConnections.delete(socketId);
    }
});

// Cleanup stale connections
setInterval(() => {
    const now = Date.now();
    const timeout = 60000;
    userConnections.forEach((data, socketId) => {
        if (now - data.lastActivity > timeout) {
            const partnerId = activeChats.get(socketId);
            if (partnerId) io.to(partnerId).emit('partner-disconnected');
            activeChats.delete(socketId);
            activeChats.delete(partnerId);
            userConnections.delete(socketId);
            waitingUsers = waitingUsers.filter(u => u.socketId !== socketId);
            console.log(`⚠ Cleaned stale: ${socketId}`);
        }
    });
}, 30000);

// Health and stats endpoints
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeChats: activeChats.size / 2,
        waitingUsers: waitingUsers.length,
        totalConnections: userConnections.size,
        timestamp: new Date().toISOString()
    });
});

app.get('/stats', (req, res) => {
    const waitingUsersInfo = waitingUsers.map(u => ({
        username: u.username,
        municipality: u.municipality || 'Any',
        interests: u.interests,
        randomMode: u.randomMode,
        waitingTime: Math.floor((Date.now() - u.connectedAt) / 1000) + 's'
    }));
    res.json({
        activeChats: activeChats.size / 2,
        waitingUsers: waitingUsers.length,
        waitingUsersDetails: waitingUsersInfo,
        totalConnections: userConnections.size
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║     Sorsogon Chat Server Started      ║
╠════════════════════════════════════════╣
║  Port: ${PORT}                           ║
║  URL: http://localhost:${PORT}          ║
║                                        ║
║  Endpoints:                            ║
║    /health - Health check              ║
║    /stats  - Server statistics         ║
╚════════════════════════════════════════╝
    `);
});
