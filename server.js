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
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// In-memory storage for users waiting to be matched
let waitingUsers = [];
let activeChats = new Map(); // Map of socketId to chat partner's socketId

// User class to store user information
class User {
    constructor(socketId, username, municipality, interests, randomMode) {
        this.socketId = socketId;
        this.username = username;
        this.municipality = municipality;
        this.interests = interests;
        this.randomMode = randomMode;
        this.partnerId = null;
    }
}

// Matching algorithm
function findMatch(user) {
    if (waitingUsers.length === 0) {
        return null;
    }

    // If random mode, match with anyone
    if (user.randomMode) {
        const match = waitingUsers[0];
        waitingUsers = waitingUsers.filter(u => u.socketId !== match.socketId);
        return match;
    }

    // Try to match by municipality first
    let match = waitingUsers.find(u => 
        u.municipality && 
        user.municipality && 
        u.municipality === user.municipality &&
        u.socketId !== user.socketId
    );

    // If no municipality match, try to match by interests
    if (!match && user.interests && user.interests.length > 0) {
        match = waitingUsers.find(u => {
            if (!u.interests || u.interests.length === 0) return false;
            return u.interests.some(interest => user.interests.includes(interest));
        });
    }

    // If still no match and there are waiting users, match randomly
    if (!match && waitingUsers.length > 0) {
        match = waitingUsers[0];
    }

    // Remove matched user from waiting list
    if (match) {
        waitingUsers = waitingUsers.filter(u => u.socketId !== match.socketId);
    }

    return match;
}

// Get match reason for display
function getMatchReason(user1, user2) {
    if (user1.randomMode || user2.randomMode) {
        return 'Random connection';
    }

    if (user1.municipality && user2.municipality && user1.municipality === user2.municipality) {
        return `Both from ${user1.municipality}`;
    }

    if (user1.interests && user2.interests) {
        const sharedInterest = user1.interests.find(i => user2.interests.includes(i));
        if (sharedInterest) {
            return `Shared interest: ${sharedInterest}`;
        }
    }

    return 'Random connection';
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user starting search for a chat partner
    socket.on('start-search', (userData) => {
        console.log(`User ${socket.id} (${userData.username}) started searching`);

        const user = new User(
            socket.id,
            userData.username,
            userData.municipality,
            userData.interests,
            userData.randomMode
        );

        // Try to find a match
        const match = findMatch(user);

        if (match) {
            // Match found! Connect both users
            user.partnerId = match.socketId;
            match.partnerId = user.socketId;

            activeChats.set(socket.id, match.socketId);
            activeChats.set(match.socketId, socket.id);

            const matchReason = getMatchReason(user, match);

            // Notify both users
            socket.emit('match-found', {
                partnerId: match.socketId,
                partnerUsername: match.username,
                partnerMunicipality: match.municipality,
                partnerInterests: match.interests,
                matchReason: matchReason
            });

            io.to(match.socketId).emit('match-found', {
                partnerId: socket.id,
                partnerUsername: user.username,
                partnerMunicipality: user.municipality,
                partnerInterests: user.interests,
                matchReason: matchReason
            });

            console.log(`Match made: ${user.username} <-> ${match.username} (${matchReason})`);
        } else {
            // No match found, add to waiting list
            waitingUsers.push(user);
            socket.emit('searching');
            console.log(`User ${userData.username} added to waiting list. Total waiting: ${waitingUsers.length}`);
        }
    });

    // Handle sending messages
    socket.on('send-message', (data) => {
        const partnerId = activeChats.get(socket.id);
        
        if (partnerId) {
            io.to(partnerId).emit('receive-message', {
                message: data.message,
                timestamp: Date.now()
            });
            console.log(`Message sent from ${socket.id} to ${partnerId}`);
        }
    });

    // Handle typing indicator
    socket.on('typing', () => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('partner-typing');
        }
    });

    socket.on('stop-typing', () => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('partner-stop-typing');
        }
    });

    // Handle stop chat
    socket.on('stop-chat', () => {
        handleDisconnection(socket.id);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        handleDisconnection(socket.id);
    });

    // Handle disconnection logic
    function handleDisconnection(socketId) {
        // Remove from waiting list if present
        waitingUsers = waitingUsers.filter(u => u.socketId !== socketId);

        // Notify partner if in active chat
        const partnerId = activeChats.get(socketId);
        if (partnerId) {
            io.to(partnerId).emit('partner-disconnected');
            activeChats.delete(partnerId);
            console.log(`Partner ${partnerId} notified of disconnection`);
        }

        // Remove from active chats
        activeChats.delete(socketId);
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeChats: activeChats.size / 2, // Divide by 2 since each chat has 2 entries
        waitingUsers: waitingUsers.length,
        timestamp: new Date().toISOString()
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to use the app`);
});