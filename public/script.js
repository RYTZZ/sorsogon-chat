// Initialize Socket.IO connection
const socket = io();

// State management
let currentUser = {
    username: '',
    municipality: '',
    interests: [],
    randomMode: false
};

let chatState = 'idle'; // idle, searching, connected
let selectedInterests = [];
let currentPartner = null;

// DOM Elements - Welcome Screen
const welcomeScreen = document.getElementById('welcomeScreen');
const chatScreen = document.getElementById('chatScreen');
const welcomeForm = document.getElementById('welcomeForm');
const usernameInput = document.getElementById('usernameInput');
const municipalitySelect = document.getElementById('municipalitySelect');
const randomModeCheckbox = document.getElementById('randomModeCheckbox');
const interestsGrid = document.getElementById('interestsGrid');

// DOM Elements - Chat Screen
const displayUsername = document.getElementById('displayUsername');
const userMunicipality = document.getElementById('userMunicipality');
const userLocation = document.getElementById('userLocation');
const userInterests = document.getElementById('userInterests');
const strangerName = document.getElementById('strangerName');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const strangerIcon = document.getElementById('strangerIcon');
const chatActions = document.getElementById('chatActions');
const messagesArea = document.getElementById('messagesArea');
const emptyState = document.getElementById('emptyState');
const inputArea = document.getElementById('inputArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// Interest selection handling
interestsGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('interest-chip') && !e.target.classList.contains('disabled')) {
        const interest = e.target.dataset.interest;
        
        if (e.target.classList.contains('active')) {
            // Deselect
            selectedInterests = selectedInterests.filter(i => i !== interest);
            e.target.classList.remove('active');
        } else {
            // Select (max 3)
            if (selectedInterests.length < 3) {
                selectedInterests.push(interest);
                e.target.classList.add('active');
            }
        }

        // Update disabled state
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

// Welcome form submission
welcomeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    if (!username) return;

    currentUser = {
        username: username,
        municipality: municipalitySelect.value,
        interests: selectedInterests,
        randomMode: randomModeCheckbox.checked
    };

    // Update UI
    displayUsername.textContent = currentUser.username;
    
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

// Start chatting button
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
    
    // Emit start search event to server
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
            strangerIcon.style.color = '#9FB0C8';
            chatActions.innerHTML = createStartButton();
            inputArea.style.display = 'none';
            
            // Show empty state if no messages
            if (messagesArea.children.length === 0 || messagesArea.querySelector('.empty-state')) {
                messagesArea.innerHTML = `
                    <div class="empty-state" id="emptyState">
                        <div>
                            <svg class="empty-icon" style="width: 48px; height: 48px; margin: 0 auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                            </svg>
                            <p>Click "Start Chatting" to find a stranger</p>
                        </div>
                    </div>
                `;
            }
            break;

        case 'searching':
            strangerName.textContent = 'Finding stranger...';
            statusText.textContent = 'Searching';
            statusDot.className = 'status-dot searching';
            strangerIcon.style.color = '#FFD233';
            chatActions.innerHTML = createCancelButton();
            inputArea.style.display = 'none';
            
            // Show searching state
            messagesArea.innerHTML = `
                <div class="searching-state">
                    <div>
                        <svg class="searching-icon" style="width: 48px; height: 48px; margin: 0 auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                        <p style="color: #EAF2FF;">Searching for a stranger...</p>
                        <p style="font-size: 14px; margin-top: 8px; color: #9FB0C8;">
                            ${currentUser.randomMode ? 'Random mode active' : 'Matching by location or interests'}
                        </p>
                    </div>
                </div>
            `;
            break;

        case 'connected':
            strangerName.textContent = currentPartner ? currentPartner.username : 'Stranger';
            statusText.textContent = 'Online';
            statusDot.className = 'status-dot connected';
            strangerIcon.style.color = '#2FBF71';
            chatActions.innerHTML = createStopAndNewButtons();
            inputArea.style.display = 'flex';
            break;
    }
}

// Message functions
function clearMessages() {
    messagesArea.innerHTML = '';
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.innerHTML = `<span>${text}</span>`;
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

function addMessage(type, text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-sender">${sender}</div>
            <div class="message-text">${escapeHtml(text)}</div>
        </div>
    `;
    
    messagesArea.appendChild(messageDiv);
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

// Message input handling
messageInput.addEventListener('input', () => {
    // Auto-resize textarea
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    
    // Enable/disable send button
    sendBtn.disabled = !messageInput.value.trim();
    
    // Typing indicator
    if (messageInput.value.trim()) {
        socket.emit('typing');
    } else {
        socket.emit('stop-typing');
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

    // Add message to UI
    addMessage('you', message, 'You');

    // Send to server
    socket.emit('send-message', { message });

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    socket.emit('stop-typing');
}

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
        municipality: data.partnerMunicipality,
        interests: data.partnerInterests
    };

    clearMessages();
    addSystemMessage('Stranger connected!');
    addSystemMessage(data.matchReason);
    
    updateUI();
});

socket.on('receive-message', (data) => {
    addMessage('stranger', data.message, currentPartner ? currentPartner.username : 'Stranger');
});

socket.on('partner-disconnected', () => {
    addSystemMessage('Stranger disconnected.');
    chatState = 'idle';
    currentPartner = null;
    updateUI();
});

socket.on('partner-typing', () => {
    // You can implement typing indicator here if desired
    console.log('Partner is typing...');
});

socket.on('partner-stop-typing', () => {
    console.log('Partner stopped typing');
});

// Connection status
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    if (chatState === 'connected') {
        addSystemMessage('Connection lost. Please refresh the page.');
        chatState = 'idle';
        updateUI();
    }
});

// Initialize
updateUI();