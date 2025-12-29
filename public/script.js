// Initialize Socket.IO connection
const socket = io();

// Nickname suggestions
const NICKNAME_ADJECTIVES = ['Cool', 'Swift', 'Brave', 'Wise', 'Silent', 'Mighty', 'Gentle', 'Wild', 'Calm', 'Bold', 'Happy', 'Lucky', 'Smart', 'Quick', 'Noble'];
const NICKNAME_NOUNS = ['Tiger', 'Eagle', 'Wolf', 'Fox', 'Panda', 'Dragon', 'Phoenix', 'Lion', 'Bear', 'Hawk', 'Falcon', 'Panther', 'Dolphin', 'Shark', 'Raven'];

// Emoji list
const EMOJIS = ['😊', '😂', '❤️', '👍', '👏', '🔥', '✨', '🎉', '😍', '🤗', '😎', '🙌', '💯', '✅', '❌', '😢', '😭', '😡', '🤔', '😮', '😴', '🤩', '😇', '🥳', '🤪', '😜', '🙈', '🙉', '🙊', '💪', '🙏', '👌', '✌️', '🤝', '💕', '💖', '💗', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🌟', '💫', '⭐', '🌈', '🌸', '🌺', '🌻', '🌹', '🍀'];

// Reaction emojis for messages
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

// Vulgar words filter (English and Tagalog)
const VULGAR_WORDS = [
    // English
    'fuck', 'shit', 'bitch', 'ass', 'asshole', 'damn', 'hell', 'crap', 'dick', 'pussy', 'cock', 'bastard', 'slut', 'whore', 'fag', 'nigger', 'cunt',
    // Tagalog
    'putang', 'puta', 'gago', 'tarantado', 'tanga', 'bobo', 'ulol', 'sira', 'hayop', 'tangina', 'kantot', 'tamod', 'tite', 'puke', 'bilat', 'burat', 'hinayupak', 'leche', 'peste', 'yawa', 'buwisit', 'bwesit'
];

// State management
let currentUser = {
    username: '',
    gender: '',
    lookingFor: '',
    municipality: '',
    interests: [],
    randomMode: false
};

let chatState = 'idle'; // idle, searching, connected
let selectedInterests = [];
let currentPartner = null;
let replyToMessage = null;
let longPressTimer = null;
let typingTimeout = null;
let messageReactions = {}; // Store reactions: {messageId: {emoji: count}}
let messageTimestamps = {}; // Store message timestamps for edit/delete window
let activeMessageMenu = null; // Track which message menu is open

// DOM Elements - Welcome Screen
const welcomeScreen = document.getElementById('welcomeScreen');
const chatScreen = document.getElementById('chatScreen');
const welcomeForm = document.getElementById('welcomeForm');
const usernameInput = document.getElementById('usernameInput');
const shuffleBtn = document.getElementById('shuffleBtn');
const municipalitySelect = document.getElementById('municipalitySelect');
const randomModeCheckbox = document.getElementById('randomModeCheckbox');
const interestsGrid = document.getElementById('interestsGrid');
const continueBtn = document.getElementById('continueBtn');

// DOM Elements - Chat Screen
const displayUsername = document.getElementById('displayUsername');
const displayGender = document.getElementById('displayGender');
const userAvatarIcon = document.getElementById('userAvatarIcon');
const userMunicipality = document.getElementById('userMunicipality');
const userLocation = document.getElementById('userLocation');
const userInterests = document.getElementById('userInterests');
const strangerName = document.getElementById('strangerName');
const strangerAvatar = document.getElementById('strangerAvatar');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const chatActions = document.getElementById('chatActions');
const messagesArea = document.getElementById('messagesArea');
const emptyState = document.getElementById('emptyState');
const inputArea = document.getElementById('inputArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const backBtn = document.getElementById('backBtn');
const typingIndicator = document.getElementById('typingIndicator');
const replyingTo = document.getElementById('replyingTo');
const replyText = document.getElementById('replyText');
const cancelReply = document.getElementById('cancelReply');
const emojiTrigger = document.getElementById('emojiTrigger');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.getElementById('emojiGrid');
const connectionStatus = document.getElementById('connectionStatus');

// Gender selection
let selectedGender = '';
let selectedLookingFor = '';

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
        // Toggle selection for "Looking For"
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

// Update continue button state
function updateContinueButton() {
    continueBtn.disabled = !usernameInput.value.trim() || !selectedGender;
}

usernameInput.addEventListener('input', updateContinueButton);

// Generate random nickname
function generateNickname() {
    const adj = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)];
    const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}${noun}${num}`;
}

// Shuffle button handler
shuffleBtn.addEventListener('click', () => {
    usernameInput.value = generateNickname();
    updateContinueButton();
});

// Profanity filter
function containsVulgarWords(text) {
    const lowerText = text.toLowerCase();
    return VULGAR_WORDS.some(word => {
        const regex = new RegExp('\\b' + word + '\\b', 'i');
        return regex.test(lowerText);
    });
}

function filterMessage(text) {
    let filtered = text;
    VULGAR_WORDS.forEach(word => {
        const regex = new RegExp('\\b' + word + '\\b', 'gi');
        filtered = filtered.replace(regex, '*'.repeat(word.length));
    });
    return filtered;
}

// Initialize emoji picker
function initEmojiPicker() {
    emojiGrid.innerHTML = EMOJIS.map(emoji => 
        `<div class="emoji-item" data-emoji="${emoji}">${emoji}</div>`
    ).join('');
}

// Emoji picker toggle
emojiTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('active');
});

// Close emoji picker when clicking outside
document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiTrigger) {
        emojiPicker.classList.remove('active');
    }
});

// Emoji selection
emojiGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-item')) {
        const emoji = e.target.dataset.emoji;
        const cursorPos = messageInput.selectionStart;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(cursorPos);
        messageInput.value = textBefore + emoji + textAfter;
        messageInput.focus();
        messageInput.selectionStart = messageInput.selectionEnd = cursorPos + emoji.length;
        emojiPicker.classList.remove('active');
        
        sendBtn.disabled = !messageInput.value.trim();
    }
});

// Interest selection handling
interestsGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('interest-chip') && !e.target.classList.contains('disabled')) {
        const interest = e.target.dataset.interest;
        
        if (e.target.classList.contains('active')) {
            selectedInterests = selectedInterests.filter(i => i !== interest);
            e.target.classList.remove('active');
        } else {
            if (selectedInterests.length < 3) {
                selectedInterests.push(interest);
                e.target.classList.add('active');
            }
        }

        updateInterestChips();
    }
});

function updateInterestChips() {
    const chips = interestsGrid.querySelectorAll('.interest-chip');
    chips.forEach(chip => {
        if (!chip.classList.contains('active') && selectedInterests.length >= 3) {
            chip.classList.add('disabled');
        } else if (!chip.classList.contains('active')) {
            chip.classList.remove('disabled');
        }
    });
}

// Get avatar icon based on gender
function getGenderIcon(gender) {
    switch(gender) {
        case 'Boy': return '👦';
        case 'Girl': return '👧';
        case 'LGBT': return '🏳️‍🌈';
        default: return '👤';
    }
}

// Welcome form submission
welcomeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    if (!username || !selectedGender) return;

    currentUser = {
        username: username,
        gender: selectedGender,
        lookingFor: selectedLookingFor,
        municipality: municipalitySelect.value,
        interests: selectedInterests,
        randomMode: randomModeCheckbox.checked
    };

    // Update UI
    displayUsername.textContent = currentUser.username;
    displayGender.textContent = currentUser.gender;
    userAvatarIcon.textContent = getGenderIcon(currentUser.gender);
    
    if (currentUser.municipality) {
        userMunicipality.textContent = currentUser.municipality;
        userLocation.style.display = 'block';
    }

    if (currentUser.interests.length > 0) {
        userInterests.innerHTML = currentUser.interests.map(interest => 
            `<span class="interest-tag">${interest}</span>`
        ).join('');
        userInterests.style.display = 'flex';
    }

    // Switch to chat screen
    welcomeScreen.style.display = 'none';
    chatScreen.style.display = 'block';
});

// Back button handler
backBtn.addEventListener('click', () => {
    if (chatState === 'connected' || chatState === 'searching') {
        socket.emit('stop-chat');
    }
    
    chatState = 'idle';
    currentPartner = null;
    
    chatScreen.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    
    clearMessages();
});

// Create message action menu (Reply, Edit, Delete, Reactions)
function createMessageMenu(messageDiv, messageId, text, timestamp, isOwnMessage) {
    const menu = document.createElement('div');
    menu.className = 'message-menu';
    menu.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 0;
        background: #0B1220;
        border: 1px solid #1E2A44;
        border-radius: 12px;
        padding: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 1001;
        margin-bottom: 8px;
        min-width: 200px;
    `;

    // Add reactions
    const reactionsDiv = document.createElement('div');
    reactionsDiv.style.cssText = `
        display: flex;
        gap: 4px;
        padding: 8px;
        border-bottom: 1px solid #1E2A44;
        flex-wrap: wrap;
        justify-content: center;
    `;

    REACTION_EMOJIS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.style.cssText = `
            font-size: 20px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            transition: all 0.2s;
        `;
        btn.onmouseenter = () => btn.style.transform = 'scale(1.3)';
        btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        btn.onclick = (e) => {
            e.stopPropagation();
            handleReactionClick(messageId, emoji);
            menu.remove();
            activeMessageMenu = null;
        };
        reactionsDiv.appendChild(btn);
    });

    menu.appendChild(reactionsDiv);

    // Add action buttons
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
    `;

    // Reply button
    const replyBtn = document.createElement('button');
    replyBtn.textContent = '↩️ Reply';
    replyBtn.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        background: #10192E;
        border: 1px solid #1E2A44;
        border-radius: 6px;
        color: #EAF2FF;
        cursor: pointer;
        text-align: left;
        font-size: 13px;
        transition: all 0.2s;
    `;
    replyBtn.onmouseover = () => {
        replyBtn.style.background = '#1E2A44';
        replyBtn.style.borderColor = '#18C3E2';
    };
    replyBtn.onmouseout = () => {
        replyBtn.style.background = '#10192E';
        replyBtn.style.borderColor = '#1E2A44';
    };
    replyBtn.onclick = (e) => {
        e.stopPropagation();
        replyToMessage = { id: messageId, text: text };
        showReplyUI(text);
        highlightMessage(messageId);
        menu.remove();
        activeMessageMenu = null;
    };
    buttonsDiv.appendChild(replyBtn);

    // Edit and Delete buttons only for own messages within 15 minutes
    if (isOwnMessage) {
        const now = Date.now();
        const timeDiff = now - timestamp;
        const fifteenMin = 15 * 60 * 1000;

        if (timeDiff < fifteenMin) {
            // Edit button
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️ Edit';
            editBtn.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                background: #10192E;
                border: 1px solid #1E2A44;
                border-radius: 6px;
                color: #EAF2FF;
                cursor: pointer;
                text-align: left;
                font-size: 13px;
                transition: all 0.2s;
            `;
            editBtn.onmouseover = () => {
                editBtn.style.background = '#1E2A44';
                editBtn.style.borderColor = '#18C3E2';
            };
            editBtn.onmouseout = () => {
                editBtn.style.background = '#10192E';
                editBtn.style.borderColor = '#1E2A44';
            };
            editBtn.onclick = (e) => {
                e.stopPropagation();
                editMessage(messageId, text);
                menu.remove();
                activeMessageMenu = null;
            };
            buttonsDiv.appendChild(editBtn);

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️ Delete';
            deleteBtn.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                background: #10192E;
                border: 1px solid #1E2A44;
                border-radius: 6px;
                color: #FF6B6B;
                cursor: pointer;
                text-align: left;
                font-size: 13px;
                transition: all 0.2s;
            `;
            deleteBtn.onmouseover = () => {
                deleteBtn.style.background = '#2A1616';
                deleteBtn.style.borderColor = '#FF6B6B';
            };
            deleteBtn.onmouseout = () => {
                deleteBtn.style.background = '#10192E';
                deleteBtn.style.borderColor = '#1E2A44';
            };
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteMessage(messageId);
                menu.remove();
                activeMessageMenu = null;
            };
            buttonsDiv.appendChild(deleteBtn);
        }
    }

    menu.appendChild(buttonsDiv);
    return menu;
}

// Show reply UI
function showReplyUI(text) {
    const preview = text.substring(0, 50) + (text.length > 50 ? '...' : '');
    replyText.textContent = `Replying to: "${preview}"`;
    replyingTo.style.display = 'flex';
    messageInput.focus();
}

// Highlight message being replied to
function highlightMessage(messageId) {
    // Remove previous highlights
    document.querySelectorAll('.message.replying-to').forEach(m => {
        m.classList.remove('replying-to');
    });
    
    // Highlight current message
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        messageDiv.classList.add('replying-to');
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Edit message
function editMessage(messageId, currentText) {
    const newText = prompt('Edit message:', currentText);
    if (newText && newText.trim() && newText !== currentText) {
        if (containsVulgarWords(newText)) {
            alert('Please keep the conversation respectful.');
            return;
        }
        
        // Update UI
        const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
        const textDiv = messageDiv.querySelector('.message-text');
        textDiv.textContent = newText + ' (edited)';
        
        // Send to server
        socket.emit('edit-message', { messageId, newText });
    }
}

// Delete message
function deleteMessage(messageId) {
    if (confirm('Delete this message?')) {
        // Update UI
        const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
        const textDiv = messageDiv.querySelector('.message-text');
        textDiv.textContent = '(Message deleted)';
        textDiv.style.fontStyle = 'italic';
        textDiv.style.opacity = '0.5';
        
        // Send to server
        socket.emit('delete-message', { messageId });
    }
}

// Start chatting button functions
function createStartButton() {
    return `
        <button class="btn btn-start" id="startBtn">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            Start Chatting
        </button>
    `;
}

function createCancelButton() {
    return `
        <button class="btn btn-stop" id="stopBtn">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
            </svg>
            Cancel
        </button>
    `;
}

function createStopAndNewButtons() {
    return `
        <button class="btn btn-stop" id="stopBtn">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
            </svg>
            Stop
        </button>
        <button class="btn btn-new" id="newMatchBtn">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            New Match
        </button>
    `;
}

// Event delegation for dynamic buttons
chatActions.addEventListener('click', (e) => {
    const startBtn = e.target.closest('#startBtn');
    const stopBtn = e.target.closest('#stopBtn');
    const newMatchBtn = e.target.closest('#newMatchBtn');

    if (startBtn) {
        handleStartChat();
    } else if (stopBtn) {
        handleStopChat();
    } else if (newMatchBtn) {
        handleNewMatch();
    }
});

function handleStartChat() {
    chatState = 'searching';
    updateUI();
    clearMessages();
    
    socket.emit('start-search', currentUser);
}

function handleStopChat() {
    socket.emit('stop-chat');
    
    if (chatState === 'connected') {
        addSystemMessage('You disconnected.');
    }
    
    chatState = 'idle';
    currentPartner = null;
    hideTypingIndicator();
    updateUI();
}

function handleNewMatch() {
    handleStopChat();
    setTimeout(() => {
        handleStartChat();
    }, 500);
}

// Update UI based on chat state
function updateUI() {
    switch (chatState) {
        case 'idle':
            strangerName.textContent = 'Not Connected';
            statusText.textContent = 'Offline';
            statusDot.className = 'status-dot';
            strangerAvatar.textContent = '👤';
            chatActions.innerHTML = createStartButton();
            inputArea.style.display = 'none';
            
            if (messagesArea.children.length <= 1) {
                messagesArea.innerHTML = `
                    <div class="empty-state" id="emptyState">
                        <div>
                            <svg class="empty-icon" style="width: 48px; height: 48px; margin: 0 auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                            </svg>
                            <p>Click "Start Chatting" to find a stranger</p>
                        </div>
                    </div>
                    <div class="typing-indicator-wrapper">
                        <div class="typing-indicator" id="typingIndicator">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>
                `;
            }
            break;

        case 'searching':
            strangerName.textContent = 'Finding stranger...';
            statusText.textContent = 'Searching';
            statusDot.className = 'status-dot searching';
            strangerAvatar.textContent = '🔍';
            chatActions.innerHTML = createCancelButton();
            inputArea.style.display = 'none';
            
            messagesArea.innerHTML = `
                <div class="searching-state">
                    <div>
                        <svg class="searching-icon" style="width: 48px; height: 48px; margin: 0 auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                        <p style="color: #EAF2FF;">Searching for a stranger...</p>
                        <p style="font-size: 14px; margin-top: 8px; color: #9FB0C8;">
                            ${currentUser.lookingFor ? `Looking for ${currentUser.lookingFor}` : currentUser.randomMode ? 'Random mode active' : 'Matching by preferences'}
                        </p>
                    </div>
                </div>
                <div class="typing-indicator-wrapper">
                    <div class="typing-indicator" id="typingIndicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            `;
            break;

        case 'connected':
            strangerName.textContent = currentPartner ? currentPartner.username : 'Stranger';
            statusText.textContent = 'Online';
            statusDot.className = 'status-dot connected';
            strangerAvatar.textContent = currentPartner ? getGenderIcon(currentPartner.gender) : '👤';
            chatActions.innerHTML = createStopAndNewButtons();
            inputArea.style.display = 'flex';
            break;
    }
}

// Message functions
function clearMessages() {
    messageReactions = {};
    messageTimestamps = {};
    messagesArea.innerHTML = `
        <div class="typing-indicator-wrapper">
            <div class="typing-indicator" id="typingIndicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.innerHTML = `<span>${text}</span>`;
    
    const typingWrapper = document.querySelector('.typing-indicator-wrapper');
    if (typingWrapper && typingWrapper.parentNode) {
        typingWrapper.parentNode.insertBefore(messageDiv, typingWrapper);
    } else {
        messagesArea.appendChild(messageDiv);
    }
    scrollToBottom();
}

function addMessage(type, text, sender, messageId) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.dataset.messageId = messageId || Date.now();
    const timestamp = Date.now();
    messageTimestamps[messageDiv.dataset.messageId] = timestamp;
    
    messageDiv.innerHTML = `
        <div class="message-bubble" style="position: relative;">
            <div class="message-sender">${sender}</div>
            <div class="message-text">${escapeHtml(text)}</div>
        </div>
    `;
    
    // Add long press event for showing menu
    const bubble = messageDiv.querySelector('.message-bubble');
    let pressTimer;

    const handlePressStart = (e) => {
        e.preventDefault();
        pressTimer = setTimeout(() => {
            // Remove existing menu
            if (activeMessageMenu) {
                activeMessageMenu.remove();
            }

            // Create and show new menu
            const menu = createMessageMenu(messageDiv, messageDiv.dataset.messageId, text, timestamp, type === 'you');
            bubble.appendChild(menu);
            activeMessageMenu = menu;

            // Close menu when clicking outside
            const closeHandler = (event) => {
                if (!menu.contains(event.target) && !bubble.contains(event.target)) {
                    menu.remove();
                    activeMessageMenu = null;
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
            }, 100);
        }, 500); // 500ms long press
    };

    const handlePressEnd = () => {
        clearTimeout(pressTimer);
    };

    bubble.addEventListener('mousedown', handlePressStart);
    bubble.addEventListener('touchstart', handlePressStart);
    bubble.addEventListener('mouseup', handlePressEnd);
    bubble.addEventListener('mouseleave', handlePressEnd);
    bubble.addEventListener('touchend', handlePressEnd);
    
    const typingWrapper = document.querySelector('.typing-indicator-wrapper');
    if (typingWrapper && typingWrapper.parentNode) {
        typingWrapper.parentNode.insertBefore(messageDiv, typingWrapper);
    } else {
        messagesArea.appendChild(messageDiv);
    }
    scrollToBottom();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Typing indicator functions
function showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.classList.add('active');
        scrollToBottom();
    }
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.classList.remove('active');
    }
}

// Message input handling
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    
    sendBtn.disabled = !messageInput.value.trim();
    
    if (chatState === 'connected') {
        socket.emit('typing');
        
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stop-typing');
        }, 1000);
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

    // Check for vulgar words
    if (containsVulgarWords(message)) {
        addSystemMessage('⚠️ Please keep the conversation respectful. Vulgar language is not allowed.');
        return;
    }

    const messageId = Date.now();
    addMessage('you', message, 'You', messageId);

    socket.emit('send-message', { 
        message,
        messageId,
        replyTo: replyToMessage ? replyToMessage.id : null
    });

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    socket.emit('stop-typing');
    hideReplyUI();
}

function hideReplyUI() {
    replyingTo.style.display = 'none';
    replyToMessage = null;
}

cancelReply.addEventListener('click', hideReplyUI);

// Socket event listeners
socket.on('searching', () => {
    console.log('Searching for a match...');
});

socket.on('match-found', (data) => {
    console.log('Match found:', data);
    
    chatState = 'connected';
    currentPartner = {
        id: data.partnerId,
        username: data.partnerUsername,
        gender: data.partnerGender,
        municipality: data.partnerMunicipality,
        interests: data.partnerInterests
    };

    clearMessages();
    addSystemMessage('Stranger connected!');
    addSystemMessage(data.matchReason);
    
    updateUI();
});

socket.on('receive-message', (data) => {
    hideTypingIndicator();
    
    // Filter the message for display
    const filteredMessage = filterMessage(data.message);
    addMessage('stranger', filteredMessage, currentPartner ? currentPartner.username : 'Stranger', data.messageId);
});

socket.on('receive-reaction', (data) => {
    const { messageId, emoji } = data;
    
    if (!messageReactions[messageId]) {
        messageReactions[messageId] = {};
    }
    
    if (!messageReactions[messageId][emoji]) {
        messageReactions[messageId][emoji] = 0;
    }
    
    messageReactions[messageId][emoji]++;
    updateMessageReactions(messageId);
});

// Receive edited message
socket.on('message-edited', (data) => {
    const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageDiv) {
        const textDiv = messageDiv.querySelector('.message-text');
        textDiv.textContent = data.newText + ' (edited)';
    }
});

// Receive deleted message
socket.on('message-deleted', (data) => {
    const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageDiv) {
        const textDiv = messageDiv.querySelector('.message-text');
        textDiv.textContent = '(Message deleted)';
        textDiv.style.fontStyle = 'italic';
        textDiv.style.opacity = '0.5';
    }
});

socket.on('partner-disconnected', () => {
    addSystemMessage('Stranger disconnected.');
    chatState = 'idle';
    currentPartner = null;
    hideTypingIndicator();
    updateUI();
});

socket.on('partner-typing', () => {
    if (chatState === 'connected') {
        showTypingIndicator();
    }
});

socket.on('partner-stop-typing', () => {
    hideTypingIndicator();
});

// Connection status handling
socket.on('connect', () => {
    console.log('Connected to server');
    connectionStatus.className = 'connection-status';
    
    // Restore session if was connected
    if (chatState === 'connected') {
        addSystemMessage('Reconnected! But your chat partner may have been disconnected.');
    }
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    connectionStatus.textContent = '⚠️ Disconnected from server';
    connectionStatus.className = 'connection-status disconnected';
    
    if (chatState === 'connected') {
        addSystemMessage('Connection lost. Trying to reconnect...');
    }
});

socket.on('reconnecting', (attemptNumber) => {
    console.log('Reconnecting attempt:', attemptNumber);
    connectionStatus.textContent = '🔄 Reconnecting...';
    connectionStatus.className = 'connection-status reconnecting';
});

// Heartbeat to keep session alive
setInterval(() => {
    if (socket.connected) {
        socket.emit('heartbeat');
        
        // Update last activity on any user action
        if (chatState === 'connected') {
            console.log('Heartbeat sent');
        }
    }
}, 30000); // Every 30 seconds

// Initialize
initEmojiPicker();
updateUI();