// Initialize Socket.IO
const socket = io();

// Nickname suggestions
const ADJECTIVES = ['Cool', 'Swift', 'Brave', 'Wise', 'Silent', 'Mighty', 'Gentle', 'Wild', 'Calm', 'Bold'];
const NOUNS = ['Tiger', 'Eagle', 'Wolf', 'Fox', 'Panda', 'Dragon', 'Phoenix', 'Lion', 'Bear', 'Hawk'];

// Reaction emojis
const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

// Vulgar words filter
const VULGAR_WORDS = [
    'fuck', 'shit', 'bitch', 'ass', 'asshole', 'damn', 'hell', 'crap', 'dick', 'pussy',
    'putang', 'puta', 'gago', 'tarantado', 'tanga', 'bobo', 'ulol', 'tangina'
];

// State
let currentUser = { username: '', gender: '', lookingFor: '', randomMode: false };
let chatState = 'idle';
let selectedGender = '';
let selectedLookingFor = '';
let currentPartner = null;
let replyToMessage = null;
let messageReactions = {};
let typingTimeout = null;

// DOM Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const chatScreen = document.getElementById('chatScreen');
const welcomeForm = document.getElementById('welcomeForm');
const usernameInput = document.getElementById('usernameInput');
const shuffleBtn = document.getElementById('shuffleBtn');
const continueBtn = document.getElementById('continueBtn');
const displayUsername = document.getElementById('displayUsername');
const displayGender = document.getElementById('displayGender');
const userAvatarIcon = document.getElementById('userAvatarIcon');
const strangerName = document.getElementById('strangerName');
const strangerAvatar = document.getElementById('strangerAvatar');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const chatActions = document.getElementById('chatActions');
const messagesArea = document.getElementById('messagesArea');
const inputArea = document.getElementById('inputArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const backBtn = document.getElementById('backBtn');
const typingIndicator = document.getElementById('typingIndicator');
const replyingTo = document.getElementById('replyingTo');
const replyText = document.getElementById('replyText');
const cancelReply = document.getElementById('cancelReply');
const connectionStatus = document.getElementById('connectionStatus');

// Gender selection
const genderOptions = document.querySelectorAll('.gender-option[data-gender]');
const lookingForOptions = document.querySelectorAll('.gender-option[data-looking]');

genderOptions.forEach(option => {
    option.addEventListener('click', () => {
        genderOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedGender = option.dataset.gender;
        updateContinueButton();
    });
});

lookingForOptions.forEach(option => {
    option.addEventListener('click', () => {
        if (option.classList.contains('selected')) {
            option.classList.remove('selected');
            selectedLookingFor = '';
        } else {
            lookingForOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedLookingFor = option.dataset.looking;
        }
    });
});

// Generate nickname
function generateNickname() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}${noun}${num}`;
}

shuffleBtn.addEventListener('click', () => {
    usernameInput.value = generateNickname();
    updateContinueButton();
});

function updateContinueButton() {
    continueBtn.disabled = !usernameInput.value.trim() || !selectedGender;
}

usernameInput.addEventListener('input', updateContinueButton);

// Profanity filter
function containsVulgar(text) {
    const lower = text.toLowerCase();
    return VULGAR_WORDS.some(word => new RegExp('\\b' + word + '\\b', 'i').test(lower));
}

// Get gender icon
function getGenderIcon(gender) {
    switch(gender) {
        case 'Boy': return '👦';
        case 'Girl': return '👧';
        case 'LGBT': return '🏳️‍🌈';
        default: return '👤';
    }
}

// Welcome form
welcomeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!usernameInput.value.trim() || !selectedGender) return;

    currentUser = {
        username: usernameInput.value.trim(),
        gender: selectedGender,
        lookingFor: selectedLookingFor,
        randomMode: false
    };

    displayUsername.textContent = currentUser.username;
    displayGender.textContent = currentUser.gender;
    userAvatarIcon.textContent = getGenderIcon(currentUser.gender);

    welcomeScreen.style.display = 'none';
    chatScreen.style.display = 'block';
});

// Back button
backBtn.addEventListener('click', () => {
    if (chatState !== 'idle') {
        socket.emit('stop-chat');
    }
    chatState = 'idle';
    currentPartner = null;
    chatScreen.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    messagesArea.innerHTML = '';
});

// Chat actions
chatActions.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.id === 'startBtn') {
        handleStartChat();
    } else if (btn.id === 'stopBtn') {
        handleStopChat();
    } else if (btn.id === 'newMatchBtn') {
        handleStopChat();
        setTimeout(handleStartChat, 500);
    }
});

function handleStartChat() {
    chatState = 'searching';
    updateUI();
    messagesArea.innerHTML = '<div style="text-align: center; padding: 40px; color: #9FB0C8;"><div style="font-size: 48px;">🔍</div><p>Searching for stranger...</p></div>';
    socket.emit('start-search', currentUser);
}

function handleStopChat() {
    socket.emit('stop-chat');
    if (chatState === 'connected') {
        addSystemMessage('You disconnected.');
    }
    chatState = 'idle';
    currentPartner = null;
    updateUI();
}

function updateUI() {
    switch (chatState) {
        case 'idle':
            strangerName.textContent = 'Not Connected';
            statusText.textContent = 'Offline';
            statusDot.className = 'status-dot';
            strangerAvatar.textContent = '👤';
            chatActions.innerHTML = '<button class="btn btn-start" id="startBtn">Start Chatting</button>';
            inputArea.style.display = 'none';
            break;

        case 'searching':
            strangerName.textContent = 'Finding stranger...';
            statusText.textContent = 'Searching';
            statusDot.className = 'status-dot searching';
            strangerAvatar.textContent = '🔍';
            chatActions.innerHTML = '<button class="btn btn-stop" id="stopBtn">Cancel</button>';
            inputArea.style.display = 'none';
            break;

        case 'connected':
            strangerName.textContent = currentPartner?.username || 'Stranger';
            statusText.textContent = 'Online';
            statusDot.className = 'status-dot connected';
            strangerAvatar.textContent = currentPartner ? getGenderIcon(currentPartner.gender) : '👤';
            chatActions.innerHTML = `
                <button class="btn btn-stop" id="stopBtn">Stop</button>
                <button class="btn btn-new" id="newMatchBtn">New Match</button>
            `;
            inputArea.style.display = 'block';
            break;
    }
}

// Messages
function addSystemMessage(text) {
    const div = document.createElement('div');
    div.style.cssText = 'text-align: center; padding: 8px; margin: 8px 0;';
    div.innerHTML = `<span style="display: inline-block; padding: 6px 16px; background: #0B1220; color: #9FB0C8; border-radius: 16px; font-size: 14px;">${text}</span>`;
    messagesArea.appendChild(div);
    scrollToBottom();
}

function addMessage(type, text, messageId, timestamp, replyTo = null) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.dataset.messageId = messageId;
    div.dataset.timestamp = timestamp;
    div.dataset.text = text;

    let replyHTML = '';
    if (replyTo) {
        replyHTML = `<div class="reply-preview">↩️ ${escapeHtml(replyTo.substring(0, 50))}${replyTo.length > 50 ? '...' : ''}</div>`;
    }

    div.innerHTML = `
        <div class="message-content">
            <div class="message-bubble">
                ${replyHTML}
                <div class="message-text">${escapeHtml(text)}</div>
                <div class="message-time">${formatTime(timestamp)}</div>
                <div class="message-reactions" id="reactions-${messageId}"></div>
            </div>
            <button class="message-menu-btn" onclick="showMessageMenu(event, '${messageId}', '${type}')">⋮</button>
        </div>
    `;

    messagesArea.appendChild(div);
    scrollToBottom();
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Message Context Menu
window.showMessageMenu = function(event, messageId, messageType) {
    event.stopPropagation();

    // Remove existing menus
    document.querySelectorAll('.message-context-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'message-context-menu active';

    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    const messageText = messageDiv.dataset.text;
    const messageTimestamp = parseInt(messageDiv.dataset.timestamp);
    const fifteenMin = 15 * 60 * 1000;
    const canEdit = messageType === 'you' && (Date.now() - messageTimestamp) < fifteenMin;

    // Reaction picker
    menu.innerHTML = `
        <div class="reaction-picker-inline">
            ${REACTIONS.map(emoji => `<button class="reaction-emoji-btn" onclick="addReaction('${messageId}', '${emoji}')">${emoji}</button>`).join('')}
        </div>
        <button class="context-menu-item" onclick="replyToMsg('${messageId}', '${escapeHtml(messageText).replace(/'/g, "\\'")}')">
            <span class="context-menu-icon">↩️</span>
            <span>Reply</span>
        </button>
        ${canEdit ? `
        <button class="context-menu-item" onclick="editMessage('${messageId}')">
            <span class="context-menu-icon">✏️</span>
            <span>Edit</span>
        </button>
        <button class="context-menu-item danger" onclick="deleteMessage('${messageId}')">
            <span class="context-menu-icon">🗑️</span>
            <span>Delete</span>
        </button>
        ` : ''}
    `;

    document.body.appendChild(menu);

    // Position menu
    const btnRect = event.target.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = Math.min(btnRect.bottom + 5, window.innerHeight - menu.offsetHeight - 10) + 'px';
    menu.style.left = Math.min(btnRect.left - menu.offsetWidth + 30, window.innerWidth - menu.offsetWidth - 10) + 'px';

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 100);
};

// Add reaction
window.addReaction = function(messageId, emoji) {
    socket.emit('send-reaction', { messageId, emoji });
    
    if (!messageReactions[messageId]) {
        messageReactions[messageId] = {};
    }
    if (!messageReactions[messageId][emoji]) {
        messageReactions[messageId][emoji] = 0;
    }
    messageReactions[messageId][emoji]++;
    
    updateReactions(messageId);
    document.querySelectorAll('.message-context-menu').forEach(m => m.remove());
};

function updateReactions(messageId) {
    const container = document.getElementById(`reactions-${messageId}`);
    if (!container) return;

    const reactions = messageReactions[messageId];
    if (!reactions || Object.keys(reactions).length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = Object.entries(reactions)
        .map(([emoji, count]) => `<div class="reaction-item"><span>${emoji}</span><span>${count}</span></div>`)
        .join('');
}

// Reply to message
window.replyToMsg = function(messageId, messageText) {
    const unescaped = document.createElement('textarea');
    unescaped.innerHTML = messageText;
    const text = unescaped.value;

    replyToMessage = { id: messageId, text };
    const preview = text.substring(0, 50) + (text.length > 50 ? '...' : '');
    replyText.textContent = `↩️ ${preview}`;
    replyingTo.classList.add('active');
    messageInput.focus();
    
    document.querySelectorAll('.message-context-menu').forEach(m => m.remove());
};

cancelReply.addEventListener('click', () => {
    replyToMessage = null;
    replyingTo.classList.remove('active');
});

// Edit message
window.editMessage = function(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    const currentText = messageDiv.dataset.text;
    
    const newText = prompt('Edit message:', currentText);
    if (!newText || !newText.trim() || newText === currentText) {
        document.querySelectorAll('.message-context-menu').forEach(m => m.remove());
        return;
    }

    if (containsVulgar(newText)) {
        alert('⚠️ Please keep the conversation respectful.');
        document.querySelectorAll('.message-context-menu').forEach(m => m.remove());
        return;
    }

    // Update UI
    const textDiv = messageDiv.querySelector('.message-text');
    textDiv.innerHTML = escapeHtml(newText) + ' <span class="message-edited">(edited)</span>';
    messageDiv.dataset.text = newText;

    // Send to server
    socket.emit('edit-message', { messageId, newText });
    document.querySelectorAll('.message-context-menu').forEach(m => m.remove());
};

// Delete message
window.deleteMessage = function(messageId) {
    if (!confirm('Delete this message?')) {
        document.querySelectorAll('.message-context-menu').forEach(m => m.remove());
        return;
    }

    // Update UI
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    const textDiv = messageDiv.querySelector('.message-text');
    textDiv.innerHTML = '<span style="font-style: italic; opacity: 0.5;">(Message deleted)</span>';
    messageDiv.dataset.text = '(Message deleted)';

    // Send to server
    socket.emit('delete-message', { messageId });
    document.querySelectorAll('.message-context-menu').forEach(m => m.remove());
};

// Message input
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    sendBtn.disabled = !messageInput.value.trim();

    if (chatState === 'connected') {
        socket.emit('typing');
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => socket.emit('stop-typing'), 1000);
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || chatState !== 'connected') return;

    if (containsVulgar(message)) {
        alert('⚠️ Please keep the conversation respectful. Vulgar language is not allowed.');
        return;
    }

    const messageId = Date.now();
    const timestamp = Date.now();
    
    addMessage('you', message, messageId, timestamp, replyToMessage?.text);

    socket.emit('send-message', {
        message,
        messageId,
        timestamp,
        replyTo: replyToMessage ? replyToMessage.id : null
    });

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    socket.emit('stop-typing');
    
    if (replyToMessage) {
        replyToMessage = null;
        replyingTo.classList.remove('active');
    }
}

// Socket events
socket.on('match-found', (data) => {
    chatState = 'connected';
    currentPartner = {
        id: data.partnerId,
        username: data.partnerUsername,
        gender: data.partnerGender
    };

    messagesArea.innerHTML = '';
    addSystemMessage('Stranger connected!');
    addSystemMessage(data.matchReason);
    updateUI();
});

socket.on('receive-message', (data) => {
    typingIndicator.classList.remove('active');
    addMessage('stranger', data.message, data.messageId, data.timestamp, data.replyToText);
});

socket.on('receive-reaction', (data) => {
    if (!messageReactions[data.messageId]) {
        messageReactions[data.messageId] = {};
    }
    if (!messageReactions[data.messageId][data.emoji]) {
        messageReactions[data.messageId][data.emoji] = 0;
    }
    messageReactions[data.messageId][data.emoji]++;
    updateReactions(data.messageId);
});

socket.on('message-edited', (data) => {
    const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageDiv) {
        const textDiv = messageDiv.querySelector('.message-text');
        textDiv.innerHTML = escapeHtml(data.newText) + ' <span class="message-edited">(edited)</span>';
        messageDiv.dataset.text = data.newText;
    }
});

socket.on('message-deleted', (data) => {
    const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageDiv) {
        const textDiv = messageDiv.querySelector('.message-text');
        textDiv.innerHTML = '<span style="font-style: italic; opacity: 0.5;">(Message deleted)</span>';
        messageDiv.dataset.text = '(Message deleted)';
    }
});

socket.on('partner-disconnected', () => {
    addSystemMessage('Stranger disconnected.');
    chatState = 'idle';
    currentPartner = null;
    typingIndicator.classList.remove('active');
    updateUI();
});

socket.on('partner-typing', () => {
    if (chatState === 'connected') {
        typingIndicator.classList.add('active');
    }
});

socket.on('partner-stop-typing', () => {
    typingIndicator.classList.remove('active');
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    connectionStatus.textContent = '⚠️ Disconnected from server';
    connectionStatus.className = 'connection-status disconnected';
});

socket.on('reconnecting', (attempt) => {
    connectionStatus.textContent = '🔄 Reconnecting...';
    connectionStatus.className = 'connection-status reconnecting';
});

socket.on('connect', () => {
    connectionStatus.className = 'connection-status';
});

// Heartbeat
setInterval(() => {
    if (socket.connected) socket.emit('heartbeat');
}, 30000);

// Initial UI
updateUI();