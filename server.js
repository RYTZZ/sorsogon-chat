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
    pingTimeout: 10000, // 10 seconds
    pingInterval: 5000  // 5 seconds
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// In-memory storage for users waiting to be matched
let waitingUsers = [];
let activeChats = new Map(); // Map of socketId to chat partner's socketId
let userConnections = new Map(); // Map of socketId to user data

// User class to store user information
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

// Improved matching algorithm - FIXED
function findMatch(user) {
    if (waitingUsers.length === 0) {
        return null;
    }

    let match = null;

    // If user is in random mode, match with anyone
    if (user.randomMode) {
        match = waitingUsers[0];
    } else {
        // Priority 1: Match by municipality if both have specified one
        if (user.municipality) {
            match = waitingUsers.find(u => 
                u.municipality && 
                u.municipality === user.municipality &&
                !u.randomMode && // Don't match with random mode users if we're specific
                u.socketId !== user.socketId
            );
        }

        // Priority 2: Match by shared interests
        if (!match && user.interests && user.interests.length > 0) {
            match = waitingUsers.find(u => {
                if (!u.interests || u.interests.length === 0 || u.randomMode) return false;
                return u.interests.some(interest => user.interests.includes(interest));
            });
        }

        // Priority 3: Match with random mode users or anyone else
        if (!match) {
            match = waitingUsers[0];
        }
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

    // Check municipality match first
    if (user1.municipality && user2.municipality && user1.municipality === user2.municipality) {
        return `Both from ${user1.municipality}`;
    }

    // Check interests match
    if (user1.interests && user2.interests && user1.interests.length > 0 && user2.interests.length > 0) {
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
    
    // Store connection info
    userConnections.set(socket.id, {
        connectedAt: Date.now(),
        lastActivity: Date.now()
    });

    // Handle user starting search for a chat partner
    socket.on('start-search', (userData) => {
        console.log(`User ${socket.id} (${userData.username}) started searching`);
        console.log(`  Municipality: ${userData.municipality || 'Any'}`);
        console.log(`  Interests: ${userData.interests.length > 0 ? userData.interests.join(', ') : 'None'}`);
        console.log(`  Random Mode: ${userData.randomMode}`);

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

            console.log(`✓ Match made: ${user.username} <-> ${match.username}`);
            console.log(`  Reason: ${matchReason}`);
        } else {
            // No match found, add to waiting list
            waitingUsers.push(user);
            socket.emit('searching');
            console.log(`→ User ${userData.username} added to waiting list`);
            console.log(`  Total waiting: ${waitingUsers.length}`);
        }
    });

    // Handle sending messages
    socket.on('send-message', (data) => {
        const partnerId = activeChats.get(socket.id);
        
        if (partnerId) {
            // Update last activity
            if (userConnections.has(socket.id)) {
                userConnections.get(socket.id).lastActivity = Date.now();
            }

            io.to(partnerId).emit('receive-message', {
                message: data.message,
                messageId: data.messageId || Date.now(),
                replyTo: data.replyTo,
                timestamp: Date.now()
            });
            console.log(`Message: ${socket.id} → ${partnerId}`);
        } else {
            console.log(`⚠ Message failed: No partner for ${socket.id}`);
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
        console.log(`User ${socket.id} stopped chat`);
        handleDisconnection(socket.id, true);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.id} (Reason: ${reason})`);
        handleDisconnection(socket.id, false);
    });

    // Heartbeat to detect connection issues
    socket.on('heartbeat', () => {
        if (userConnections.has(socket.id)) {
            userConnections.get(socket.id).lastActivity = Date.now();
        }
    });

    // Handle disconnection logic
    function handleDisconnection(socketId, voluntary) {
        // Remove from waiting list if present
        const beforeLength = waitingUsers.length;
        waitingUsers = waitingUsers.filter(u => u.socketId !== socketId);
        
        if (waitingUsers.length < beforeLength) {
            console.log(`  Removed from waiting list`);
        }

        // Notify partner if in active chat
        const partnerId = activeChats.get(socketId);
        if (partnerId) {
            io.to(partnerId).emit('partner-disconnected');
            activeChats.delete(partnerId);
            console.log(`  Partner ${partnerId} notified of disconnection`);
            
            // Also stop partner's typing indicator
            io.to(partnerId).emit('partner-stop-typing');
        }

        // Remove from active chats
        activeChats.delete(socketId);
        
        // Remove connection info
        userConnections.delete(socketId);
    }
});

// Periodic cleanup of stale connections
setInterval(() => {
    const now = Date.now();
    const timeout = 60000; // 60 seconds timeout
    
    userConnections.forEach((data, socketId) => {
        if (now - data.lastActivity > timeout) {
            console.log(`⚠ Cleaning up stale connection: ${socketId}`);
            
            const partnerId = activeChats.get(socketId);
            if (partnerId) {
                io.to(partnerId).emit('partner-disconnected');
                activeChats.delete(partnerId);
            }
            
            activeChats.delete(socketId);
            userConnections.delete(socketId);
            waitingUsers = waitingUsers.filter(u => u.socketId !== socketId);
        }
    });
}, 30000); // Check every 30 seconds

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeChats: activeChats.size / 2, // Divide by 2 since each chat has 2 entries
        waitingUsers: waitingUsers.length,
        totalConnections: userConnections.size,
        timestamp: new Date().toISOString()
    });
});

// Stats endpoint for debugging
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