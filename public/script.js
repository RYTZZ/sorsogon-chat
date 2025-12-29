// Initialize Socket.IO connection
const socket = io();

// Nickname suggestions
const NICKNAME_ADJECTIVES = ['Cool', 'Swift', 'Brave', 'Wise', 'Silent', 'Mighty', 'Gentle', 'Wild', 'Calm', 'Bold', 'Happy', 'Lucky', 'Smart', 'Quick', 'Noble'];
const NICKNAME_NOUNS = ['Tiger', 'Eagle', 'Wolf', 'Fox', 'Panda', 'Dragon', 'Phoenix', 'Lion', 'Bear', 'Hawk', 'Falcon', 'Panther', 'Dolphin', 'Shark', 'Raven'];

// Emoji list
const EMOJIS = ['😊', '😂', '❤️', '👍', '👏', '🔥', '✨', '🎉', '😍', '🤗', '😎', '🙌', '💯', '✅', '❌', '😢', '😭', '😡', '🤔', '😮', '😴', '🤩', '😇', '🥳', '🤪', '😜', '🙈', '🙉', '🙊', '💪', '🙏', '👌', '✌️', '🤝', '💕', '💖', '💗', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🌟', '💫', '⭐', '🌈', '🌸', '🌺', '🌻', '🌹', '🍀'];

// Reaction emojis for messages
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

// Vulgar words filter
const VULGAR_WORDS = [
    'fuck', 'shit', 'bitch', 'ass', 'asshole', 'damn', 'hell', 'crap', 'dick', 'pussy', 'cock', 'bastard', 'slut', 'whore', 'fag', 'nigger', 'cunt',
    'putang', 'puta', 'gago', 'tarantado', 'tanga', 'bobo', 'ulol', 'sira', 'hayop', 'tangina', 'kantot', 'tamod', 'tite', 'puke', 'bilat', 'burat', 'hinayupak', 'leche', 'peste', 'yawa', 'buwisit'
];

// State management
let currentUser = { username: '', gender: '', lookingFor: '', municipality: '', interests: [], randomMode: false };
let chatState = 'idle'; // idle, searching, connected
let selectedInterests = [];
let currentPartner = null;
let replyToMessage = null;
let longPressTimer = null;
let typingTimeout = null;
let messageReactions = {}; // {messageId: {emoji: count}}

// DOM Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const chatScreen = document.getElementById('chatScreen');
const welcomeForm = document.getElementById('welcomeForm');
const usernameInput = document.getElementById('usernameInput');
const shuffleBtn = document.getElementById('shuffleBtn');
const municipalitySelect = document.getElementById('municipalitySelect');
const randomModeCheckbox = document.getElementById('randomModeCheckbox');
const interestsGrid = document.getElementById('interestsGrid');
const continueBtn = document.getElementById('continueBtn');

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

function updateContinueButton() {
    continueBtn.disabled = !usernameInput.value.trim() || !selectedGender;
}
usernameInput.addEventListener('input', updateContinueButton);

function generateNickname() {
    const adj = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)];
    const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}${noun}${num}`;
}

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

// Emoji picker
function initEmojiPicker() {
    emojiGrid.innerHTML = EMOJIS.map(emoji => `<div class="emoji-item" data-emoji="${emoji}">${emoji}</div>`).join('');
}
emojiTrigger.addEventListener('click', (e) => { e.stopPropagation(); emojiPicker.classList.toggle('active'); });
document.addEventListener('click', (e) => { if (!emojiPicker.contains(e.target) && e.target !== emojiTrigger) emojiPicker.classList.remove('active'); });
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

// Interests
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
        if (!chip.classList.contains('active') && selectedInterests.length >= 3) chip.classList.add('disabled');
        else if (!chip.classList.contains('active')) chip.classList.remove('disabled');
    });
}

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
    const username = usernameInput.value.trim();
    if (!username || !selectedGender) return;

    currentUser = {
        username,
        gender: selectedGender,
        lookingFor: selectedLookingFor,
        municipality: municipalitySelect.value,
        interests: selectedInterests,
        randomMode: randomModeCheckbox.checked
    };

    displayUsername.textContent = currentUser.username;
    displayGender.textContent = currentUser.gender;
    userAvatarIcon.textContent = getGenderIcon(currentUser.gender);

    if (currentUser.municipality) { userMunicipality.textContent = currentUser.municipality; userLocation.style.display = 'block'; }
    if (currentUser.interests.length > 0) {
        userInterests.innerHTML = currentUser.interests.map(i => `<span class="interest-tag">${i}</span>`).join('');
        userInterests.style.display = 'flex';
    }

    welcomeScreen.style.display = 'none';
    chatScreen.style.display = 'block';
});

// Back button
backBtn.addEventListener('click', () => {
    if (chatState === 'connected' || chatState === 'searching') socket.emit('stop-chat');
    chatState = 'idle'; currentPartner = null;
    chatScreen.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    clearMessages();
});

// Reaction picker
function createReactionPicker(messageId) {
    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.id = `reaction-picker-${messageId}`;
    picker.innerHTML = REACTION_EMOJIS.map(emoji => 
        `<button class="reaction-emoji-btn" data-emoji="${emoji}" data-message-id="${messageId}">${emoji}</button>`
    ).join('');
    return picker;
}
function handleReactionClick(messageId, emoji) {
    socket.emit('send-reaction', { messageId, emoji });
    if (!messageReactions[messageId]) messageReactions[messageId] = {};
    if (!messageReactions[messageId][emoji]) messageReactions[messageId][emoji] = 0;
    messageReactions[messageId][emoji]++;
    updateMessageReactions(messageId);
}
function updateMessageReactions(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    let reactionsContainer = messageDiv.querySelector('.message-reactions');
    if (!reactionsContainer) {
        reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'message-reactions';
        messageDiv.querySelector('.message-bubble').appendChild(reactionsContainer);
    }
    const reactions = messageReactions[messageId];
    if (!reactions || Object.keys(reactions).length === 0) { reactionsContainer.innerHTML = ''; return; }
    reactionsContainer.innerHTML = Object.entries(reactions).map(([emoji, count]) => 
        `<div class="reaction-item"><span class="reaction-emoji">${emoji}</span><span class="reaction-count">${count}</span></div>`
    ).join('');
}

// Start/Stop buttons
function createStartButton() { return `<button class="btn btn-start" id="startBtn">Start Chatting</button>`; }
function createCancelButton() { return `<button class="btn btn-stop" id="stopBtn">Cancel</button>`; }
function createStopAndNewButtons() { return `<button class="btn btn-stop" id="stopBtn">Stop</button><button class="btn btn-new" id="newMatchBtn">New Match</button>`; }

chatActions.addEventListener('click', (e) => {
    const startBtn = e.target.closest('#startBtn');
    const stopBtn = e.target.closest('#stopBtn');
    const newMatchBtn = e.target.closest('#newMatchBtn');
    if (startBtn) handleStartChat();
    else if (stopBtn) handleStopChat();
    else if (newMatchBtn) handleNewMatch();
});

function handleStartChat() {
    chatState = 'searching';
    updateUI();
    clearMessages();
    socket.emit('start-search', currentUser); // sends all preferences
}
function handleStopChat() {
    socket.emit('stop-chat');
    if (chatState === 'connected') addSystemMessage('You disconnected.');
    chatState = 'idle'; currentPartner = null; hideTypingIndicator(); updateUI();
}
function handleNewMatch() {
    handleStopChat();
    setTimeout(handleStartChat, 500);
}

// UI Updates
function updateUI() {
    switch(chatState) {
        case 'idle':
            strangerName.textContent = 'Not Connected';
            statusText.textContent = 'Offline';
            statusDot.className = 'status-dot';
            strangerAvatar.textContent = '👤';
            chatActions.innerHTML = createStartButton();
            inputArea.style.display = 'none';
            break;
        case 'searching':
            strangerName.textContent = 'Finding stranger...';
            statusText.textContent = 'Searching';
            statusDot.className = 'status-dot searching';
            strangerAvatar.textContent = '🔍';
            chatActions.innerHTML = createCancelButton();
            inputArea.style.display = 'none';
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

// Messages
function clearMessages() { messageReactions = {}; messagesArea.innerHTML = ''; }
function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.innerHTML = `<span>${text}</span>`;
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

function addMessage(type, text, sender, messageId, replyTo = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.dataset.messageId = messageId || Date.now();
    let replyHTML = '';
    if (replyTo) replyHTML = `<div class="message-reply"><span>Replying to: ${escapeHtml(replyTo.text)}</span></div>`;
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-sender">${sender}</div>
            ${replyHTML}
            <div class="message-text">${escapeHtml(text)}</div>
        </div>
    `;
    const bubble = messageDiv.querySelector('.message-bubble');
    bubble.addEventListener('mousedown', (e) => handleMessagePress(e, messageDiv));
    bubble.addEventListener('touchstart', (e) => handleMessagePress(e, messageDiv));
    bubble.addEventListener('mouseup', clearMessagePress);
    bubble.addEventListener('touchend', clearMessagePress);
    bubble.addEventListener('mouseleave', clearMessagePress);
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

function handleMessagePress(e, messageDiv) {
    longPressTimer = setTimeout(() => { showReactionPicker(messageDiv, messageDiv.dataset.messageId); }, 500);
}
function clearMessagePress() { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } }
function showReactionPicker(messageDiv, messageId) {
    document.querySelectorAll('.reaction-picker').forEach(p => p.remove());
    const picker = createReactionPicker(messageId);
    const bubble = messageDiv.querySelector('.message-bubble');
    bubble.appendChild(picker); picker.classList.add('active');
    picker.querySelectorAll('.reaction-emoji-btn').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        handleReactionClick(btn.dataset.messageId, btn.dataset.emoji);
        picker.remove();
    }));
    setTimeout(() => {
        document.addEventListener('click', function closePicker(e) { if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', closePicker); } });
    }, 100);
}

function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function scrollToBottom() { messagesArea.scrollTop = messagesArea.scrollHeight; }

// Typing
function showTypingIndicator() { typingIndicator.classList.add('active'); scrollToBottom(); }
function hideTypingIndicator() { typingIndicator.classList.remove('active'); }

// Send messages
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto'; messageInput.style.height = messageInput.scrollHeight + 'px';
    sendBtn.disabled = !messageInput.value.trim();
    if (chatState === 'connected') {
        socket.emit('typing');
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => { socket.emit('stop-typing'); }, 1000);
    }
});

messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
sendBtn.addEventListener('click', sendMessage);

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || chatState !== 'connected') return;
    const filteredMessage = filterMessage(message);
    const messageId = Date.now();
    addMessage('user', filteredMessage, currentUser.username, messageId, replyToMessage);
    socket.emit('send-message', { message: filteredMessage, messageId, replyTo: replyToMessage ? { id: replyToMessage.id, text: replyToMessage.text } : null });
    messageInput.value = ''; messageInput.style.height = 'auto'; sendBtn.disabled = true; replyingTo.style.display = 'none'; replyToMessage = null;
}

// Cancel reply
cancelReply.addEventListener('click', () => { replyToMessage = null; replyingTo.style.display = 'none'; });

// Socket events
socket.on('match-found', (partner) => { chatState = 'connected'; currentPartner = partner; updateUI(); addSystemMessage(`You are now connected with ${partner.username}.`); });
socket.on('receive-message', (data) => {
    hideTypingIndicator();
    const filteredMessage = filterMessage(data.message);
    addMessage('stranger', filteredMessage, currentPartner ? currentPartner.username : 'Stranger', data.messageId, data.replyTo);
});
socket.on('typing', showTypingIndicator);
socket.on('stop-typing', hideTypingIndicator);
