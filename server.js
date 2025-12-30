const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let waitingUsers = [];
let activeChats = new Map();
let userConnections = new Map();

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

function findMatch(user) {
    if (waitingUsers.length === 0) return null;

    let match = null;

    if (user.randomMode) {
        match = waitingUsers[0];
    } else {
        // Priority 1: Gender preference
        if (user.lookingFor) {
            match = waitingUsers.find(u => 
                u.gender === user.lookingFor &&
                (!u.lookingFor || u.lookingFor === user.gender) &&
                u.socketId !== user.socketId
            );
        }

        // Priority 2: Municipality
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

        // Priority 3: Interests
        if (!match && user.interests && user.interests.length > 0) {
            match = waitingUsers.find(u => {
                if (!u.interests || u.interests.length === 0 || u.randomMode) return false;
                if (user.lookingFor && u.gender !== user.lookingFor) return false;
                if (u.lookingFor && user.gender !== u.lookingFor) return false;
                return u.interests.some(interest => user.interests.includes(interest));
            });
        }

        // Priority 4: Compatible gender
        if (!match) {
            match = waitingUsers.find(u => {
                if (user.lookingFor && u.gender !== user.lookingFor) return false;
                if (u.lookingFor && user.gender !== u.lookingFor) return false;
                return true;
            });
        }

        // Priority 5: No preference - match with anyone
        if (!match && !user.lookingFor) {
            match = waitingUsers.find(u => u.socketId !== user.socketId);
        }
    }

    if (match) {
        waitingUsers = waitingUsers.filter(u => u.socketId !== match.socketId);
    }

    return match;
}

function getMatchReason(user1, user2) {
    if (user1.randomMode || user2.randomMode) {
        return 'Random connection';
    }

    if (user1.lookingFor && user2.gender === user1.lookingFor) {
        return `Matched by gender preference`;
    }

    if (user1.municipality && user2.municipality && user1.municipality === user2.municipality) {
        return `Both from ${user1.municipality}`;
    }

    if (user1.interests && user2.interests && user1.interests.length > 0 && user2.interests.length > 0) {
        const sharedInterest = user1.interests.find(i => user2.interests.includes(i));
        if (sharedInterest) {
            return `Shared interest: ${sharedInterest}`;
        }
    }

    return 'Random connection';
}

io.on('connection', (socket) => {
    console.log(`✓ User connected: ${socket.id}`);
    
    userConnections.set(socket.id, {
        connectedAt: Date.now(),
        lastActivity: Date.now()
    });

    socket.on('start-search', (userData) => {
        console.log(`🔍 User ${socket.id} (${userData.username}) searching`);
        console.log(`  Gender: ${userData.gender}, Looking for: ${userData.lookingFor || 'Anyone'}`);
        console.log(`  Municipality: ${userData.municipality || 'Any'}, Interests: ${userData.interests?.join(', ') || 'None'}`);

        const user = new User(
            socket.id,
            userData.username,
            userData.gender,
            userData.lookingFor,
            userData.municipality,
            userData.interests,
            userData.randomMode
        );

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

            console.log(`✓ Match: ${user.username} <-> ${match.username} (${matchReason})`);
        } else {
            waitingUsers.push(user);
            socket.emit('searching');
            console.log(`→ ${userData.username} waiting (Total: ${waitingUsers.length})`);
        }
    });

    socket.on('send-message', (data) => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            if (userConnections.has(socket.id)) {
                userConnections.get(socket.id).lastActivity = Date.now();
            }

            // Get reply text if replyTo is provided
            let replyToText = null;
            if (data.replyTo) {
                replyToText = data.replyToText || null;
            }

            io.to(partnerId).emit('receive-message', {
                message: data.message,
                messageId: data.messageId,
                timestamp: data.timestamp,
                replyToText: replyToText
            });
        }
    });

    socket.on('send-reaction', (data) => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('receive-reaction', {
                messageId: data.messageId,
                emoji: data.emoji
            });
        }
    });

    socket.on('edit-message', (data) => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('message-edited', {
                messageId: data.messageId,
                newText: data.newText
            });
        }
    });

    socket.on('delete-message', (data) => {
        const partnerId = activeChats.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('message-deleted', {
                messageId: data.messageId
            });
        }
    });

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

    socket.on('stop-chat', () => {
        console.log(`⏹ User ${socket.id} stopped chat`);
        handleDisconnection(socket.id);
    });

    socket.on('disconnect', (reason) => {
        console.log(`✗ User disconnected: ${socket.id} (${reason})`);
        handleDisconnection(socket.id);
    });

    socket.on('heartbeat', () => {
        if (userConnections.has(socket.id)) {
            userConnections.get(socket.id).lastActivity = Date.now();
        }
    });

    function handleDisconnection(socketId) {
        waitingUsers = waitingUsers.filter(u => u.socketId !== socketId);

        const partnerId = activeChats.get(socketId);
        if (partnerId) {
            io.to(partnerId).emit('partner-disconnected');
            io.to(partnerId).emit('partner-stop-typing');
            activeChats.delete(partnerId);
        }

        activeChats.delete(socketId);
        userConnections.delete(socketId);
    }
});

// Session timeout - 10 minutes
setInterval(() => {
    const now = Date.now();
    const timeout = 600000; // 10 minutes
    
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
            
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.disconnect(true);
            }
        }
    });
}, 60000); // Check every minute

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeChats: activeChats.size / 2,
        waitingUsers: waitingUsers.length,
        totalConnections: userConnections.size
    });
});

app.get('/stats', (req, res) => {
    const waitingUsersInfo = waitingUsers.map(u => ({
        username: u.username,
        gender: u.gender,
        lookingFor: u.lookingFor || 'Anyone',
        municipality: u.municipality || 'Any',
        interests: u.interests,
        waitingTime: Math.floor((Date.now() - u.connectedAt) / 1000) + 's'
    }));

    res.json({
        activeChats: activeChats.size / 2,
        waitingUsers: waitingUsers.length,
        waitingUsersDetails: waitingUsersInfo,
        totalConnections: userConnections.size
    });
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║     Sorsogon Chat Server Started      ║
╠════════════════════════════════════════╣
║  Port: ${PORT}                          
║  URL: http://localhost:${PORT}         
║                                        
║  ✅ Gender matching                    
║  ✅ Municipality matching              
║  ✅ Interest matching                  
║  ✅ Profanity filter                   
║  ✅ Message reactions                  
║  ✅ Edit/Delete (15 min)               
║  ✅ Reply threads                      
║  ✅ Session timeout (10 min)           
╚════════════════════════════════════════╝
    `);
});