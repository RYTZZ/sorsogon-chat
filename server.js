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
const SESSION_TIMEOUT = 120000; // 2 minutes

// Serve static files
app.use(express.static('public'));

// In-memory storage
let waitingUsers = [];
let activeChats = new Map();
let userConnections = new Map();

// User class
class User {
    constructor(socketId, username, gender, lookingFor, municipality, interests, randomMode) {
        this.socketId = socketId;
        this.username = username;
        this.gender = gender;
        this.lookingFor = lookingFor;
        this.municipality = municipality;
        this.interests = interests;
        this.randomMode = randomMode;
        this.partnerId = null;
        this.connectedAt = Date.now();
    }
}

// Improved matching algorithm with gender preference
function findMatch(user) {
    if (waitingUsers.length === 0) {
        return null;
    }

    let match = null;

    // If user is in random mode, match with anyone
    if (user.randomMode) {
        match = waitingUsers[0];
    } else {
        // Priority 1: Match by gender preference if specified
        if (user.lookingFor) {
            match = waitingUsers.find(u => 
                u.gender === user.lookingFor &&
                (!u.lookingFor || u.lookingFor === user.gender) &&
                u.socketId !== user.socketId
            );
            
            if (match) {
                console.log(`  ✓ Gender match: ${user.username} (looking for ${user.lookingFor}) <-> ${match.username} (${match.gender})`);
            }
        }

        // Priority 2: Match by municipality if both have specified one
        if (!match && user.municipality) {
            match = waitingUsers.find(u => 
                u.municipality && 
                u.municipality === user.municipality &&
                !u.randomMode &&
                u.socketId !== user.socketId &&
                (!user.lookingFor || u.gender === user.lookingFor) &&
                (!u.lookingFor || user.gender === u.lookingFor)
            );
        }

        // Priority 3: Match by shared interests
        if (!match && user.interests && user.interests.length > 0) {
            match = waitingUsers.find(u => {
                if (!u.interests || u.interests.length === 0 || u.randomMode) return false;
                
                if (user.lookingFor && u.gender !== user.lookingFor) return false;
                if (u.lookingFor && user.gender !== u.lookingFor) return false;
                
                return u.interests.some(interest => user.interests.includes(interest));
            });
        }

        // Priority 4: Match with anyone compatible
        if (!match) {
            match = waitingUsers.find(u => {
                if (user.lookingFor && u.gender !== user.lookingFor) return false;
                if (u.lookingFor && user.gender !== u.lookingFor) return false;
                return true;
            });
        }

        // Priority 5: No preference matches anyone
        if (!match && !user.lookingFor) {
            match = waitingUsers.find(u => u.socketId !== user.socketId);
            console.log('✓ No-preference match');
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

    // Check gender match
    if (user1.lookingFor && user2.gender === user1.lookingFor) {
        return `Matched by gender preference`;
    }

    // Check municipality match
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
    
    userConnections.set(socket.id, {
        connectedAt: Date.now(),
        lastActivity: Date.now()
    });

    // Handle user starting search
    socket.on('start-search', (userData) => {
        console.log(`User ${socket.id} (${userData.username}) started searching`);
        console.log(`  Gender: ${userData.gender}`);
        console.log(`  Looking for: ${userData.lookingFor || 'Anyone'}`);
        console.log(`  Municipality: ${userData.municipality || 'Any'}`);
        console.log(`  Interests: ${userData.interests.length > 0 ? userData.interests.join(', ') : 'None'}`);
        console.log(`  Random Mode: ${userData.randomMode}`);

        const user = new User(
            socket.id,
            userData.username,
            userData.gender,
            userData.lookingFor,
            userData.municipality,
            userData.interests,
            userData.randomMode
        );

        // Try to find a match
        const match = findMatch(user);

        if (match) {
            // Match found!
            user.partnerId = match.socketId;
            match.partnerId = user.socketId;

            activeChats.set(socket.id, match.socketId);
            activeChats.set(match.socketId, socket.id);

            const matchReason = getMatchReason(user, match);

            // Notify both users
            socket.emit('match-found', {
                partnerId: match.socketId,
                partnerUsername: match.username,
                partnerGender: match.gender,
                partnerMunicipality: match.municipality,
                partnerInterests: match.interests,
                matchReason: matchReason
            });

            io.to(match.socketId).emit('match-found', {
                partnerId: socket.id,
                partnerUsername: user.username,
                partnerGender: user.gender,
                partnerMunicipality: user.municipality,
                partnerInterests: user.interests,
                matchReason: matchReason
            });

            console.log(`✓ Match made: ${user.username} (${user.gender}) <-> ${match.username} (${match.gender})`);
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

    // Handle sending reactions
    socket.on('send-reaction', (data) => {
        const partnerId = activeChats.get(socket.id);
        
        if (partnerId) {
            io.to(partnerId).emit('receive-reaction', {
                messageId: data.messageId,
                emoji: data.emoji,
                timestamp: Date.now()
            });
            console.log(`Reaction: ${socket.id} → ${partnerId} (${data.emoji})`);
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

    // Heartbeat
    socket.on('heartbeat', () => {
        if (userConnections.has(socket.id)) {
            userConnections.get(socket.id).lastActivity = Date.now();
        }
    });

    // Edit message
    socket.on('edit-message', (data) => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('message-edited', {
                messageId: data.messageId,
                newText: data.newText
            });
        }
    });

    // Delete message
    socket.on('delete-message', (data) => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('message-deleted', {
                messageId: data.messageId
            });
        }
    });

    // Handle disconnection logic
    function handleDisconnection(socketId, voluntary) {
        // Remove from waiting list
        const beforeLength = waitingUsers.length;
        waitingUsers = waitingUsers.filter(u => u.socketId !== socketId);
        
        if (waitingUsers.length < beforeLength) {
            console.log(`  Removed from waiting list`);
        }

        // Notify partner
        const partnerId = activeChats.get(socketId);
        if (partnerId) {
            io.to(partnerId).emit('partner-disconnected');
            activeChats.delete(partnerId);
            console.log(`  Partner ${partnerId} notified of disconnection`);
            io.to(partnerId).emit('partner-stop-typing');
        }

        activeChats.delete(socketId);
        userConnections.delete(socketId);
    }
});

// Cleanup stale connections
setInterval(() => {
    const now = Date.now();
    const timeout = SESSION_TIMEOUT; // Use the SESSION_TIMEOUT constant
    
    userConnections.forEach((data, socketId) => {
        if (now - data.lastActivity > timeout) {
            console.log(`⏱ Session timeout: ${socketId}`);
            
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
}, 30000);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeChats: activeChats.size / 2,
        waitingUsers: waitingUsers.length,
        totalConnections: userConnections.size,
        timestamp: new Date().toISOString()
    });
});

// Stats endpoint
app.get('/stats', (req, res) => {
    const waitingUsersInfo = waitingUsers.map(u => ({
        username: u.username,
        gender: u.gender,
        lookingFor: u.lookingFor || 'Anyone',
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
╔═══════════════════════════════════════════╗
║      Sorsogon Chat Server Started         ║
╠═══════════════════════════════════════════╣
║  Port: ${PORT}                             ║
║  URL: http://localhost:${PORT}            ║
║                                           ║
║  Features:                                ║
║    ✓ Gender-based matching                ║
║    ✓ Profanity filter                     ║
║    ✓ Message reactions                    ║
║    ✓ Typing indicator                     ║
║                                           ║
║  Endpoints:                               ║
║    /health - Health check                 ║
║    /stats  - Server statistics            ║
╚═══════════════════════════════════════════╝
    `);
});