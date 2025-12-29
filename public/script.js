// Connect to Socket.IO
const socket = io();

// DOM Elements
const welcomeScreen = document.getElementById("welcomeScreen");
const chatScreen = document.getElementById("chatScreen");
const welcomeForm = document.getElementById("welcomeForm");
const usernameInput = document.getElementById("usernameInput");
const shuffleBtn = document.getElementById("shuffleBtn");
const continueBtn = document.getElementById("continueBtn");
const genderOptions = document.querySelectorAll(".gender-option");
const lookingForOptions = document.querySelectorAll("#lookingForOptions .gender-option");
const municipalitySelect = document.getElementById("municipalitySelect");
const interestsGrid = document.getElementById("interestsGrid");
const displayUsername = document.getElementById("displayUsername");
const displayGender = document.getElementById("displayGender");
const userMunicipality = document.getElementById("userMunicipality");
const userInterests = document.getElementById("userInterests");
const backBtn = document.getElementById("backBtn");
const startBtn = document.getElementById("startBtn");
const messagesArea = document.getElementById("messagesArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const inputArea = document.getElementById("inputArea");
const replyingToContainer = document.getElementById("replyingTo");
const replyText = document.getElementById("replyText");
const cancelReply = document.getElementById("cancelReply");
const emojiTrigger = document.getElementById("emojiTrigger");
const emojiPicker = document.getElementById("emojiPicker");
const emojiGrid = document.getElementById("emojiGrid");
const typingIndicator = document.getElementById("typingIndicator");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const strangerName = document.getElementById("strangerName");

let selectedGender = null;
let selectedLookingFor = null;
let selectedInterests = [];
let replyToMessageId = null;
let username = "";

// Sample banned words
const bannedWords = ['fuck','shit','bitch','ass','asshole','damn','hell','crap','dick','pussy','cock','bastard','slut','whore','fag','nigger','cunt','putang','puta','gago','tarantado','tanga','bobo','ulol','sira','hayop','tangina','kantot','tamod','tite','puke','bilat','burat','hinayupak','leche','peste','yawa','buwisit'];

// Generate random username
function generateRandomUsername() {
    const adjectives = ["Cool", "Crazy", "Happy", "Silent", "Fast"];
    const nouns = ["Tiger", "Panda", "Eagle", "Shark", "Lion"];
    return adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)] + Math.floor(Math.random() * 100);
}

// Shuffle button
shuffleBtn.addEventListener("click", () => {
    usernameInput.value = generateRandomUsername();
    checkFormValidity();
});

// Gender selection
genderOptions.forEach(option => {
    option.addEventListener("click", () => {
        genderOptions.forEach(o => o.classList.remove("selected"));
        option.classList.add("selected");
        selectedGender = option.dataset.gender;
        checkFormValidity();
    });
});

lookingForOptions.forEach(option => {
    option.addEventListener("click", () => {
        if(option.classList.contains("selected")) {
            option.classList.remove("selected");
            selectedLookingFor = null;
        } else {
            lookingForOptions.forEach(o => o.classList.remove("selected"));
            option.classList.add("selected");
            selectedLookingFor = option.dataset.looking;
        }
    });
});

// Interests selection (max 3)
interestsGrid.querySelectorAll(".interest-chip").forEach(chip => {
    chip.addEventListener("click", () => {
        if(chip.classList.contains("active")) {
            chip.classList.remove("active");
            selectedInterests = selectedInterests.filter(i => i !== chip.dataset.interest);
        } else if(selectedInterests.length < 3) {
            chip.classList.add("active");
            selectedInterests.push(chip.dataset.interest);
        }
    });
});

// Enable continue button only if username & gender are filled
function checkFormValidity() {
    continueBtn.disabled = !(usernameInput.value.trim() && selectedGender);
}
usernameInput.addEventListener("input", checkFormValidity);

// Continue button
welcomeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    username = usernameInput.value.trim();
    displayUsername.textContent = username;
    displayGender.textContent = selectedGender;

    if(municipalitySelect.value) {
        userMunicipality.textContent = municipalitySelect.value;
        document.getElementById("userLocation").style.display = "flex";
    }

    if(selectedInterests.length) {
        userInterests.innerHTML = selectedInterests.map(i => `<div class="interest-tag">${i}</div>`).join("");
        userInterests.style.display = "flex";
    }

    welcomeScreen.style.display = "none";
    chatScreen.style.display = "block";

    socket.emit("join", {
        username,
        gender: selectedGender,
        lookingFor: selectedLookingFor,
        municipality: municipalitySelect.value,
        interests: selectedInterests
    });
});

// Back button
backBtn.addEventListener("click", () => {
    chatScreen.style.display = "none";
    welcomeScreen.style.display = "flex";
});

// Start chat
startBtn.addEventListener("click", () => {
    socket.emit("start-search", {
        username,
        municipality: municipalitySelect.value,
        interests: selectedInterests,
        randomMode: !municipalitySelect.value && selectedInterests.length === 0
    });
    startBtn.disabled = true;
    statusDot.classList.add("searching");
    statusText.textContent = "Searching...";
});

// Cancel reply
cancelReply.addEventListener("click", () => {
    replyingToContainer.style.display = "none";
    replyToMessageId = null;
});

// Emoji picker
const emojis = ["😊","😂","😍","🥰","😎","😢","😡","👍","👎","🎉","💖","🤔"];
emojiGrid.innerHTML = emojis.map(e => `<button class="reaction-emoji-btn">${e}</button>`).join("");
emojiTrigger.addEventListener("click", (e) => {
    e.preventDefault();
    emojiPicker.classList.toggle("active");
});
emojiGrid.querySelectorAll(".reaction-emoji-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        messageInput.value += btn.textContent;
        emojiPicker.classList.remove("active");
        sendBtn.disabled = !messageInput.value.trim();
    });
});

// Send message
messageInput.addEventListener("input", () => {
    sendBtn.disabled = !messageInput.value.trim();
    socket.emit("typing", { typing: !!messageInput.value.trim() });
});

function sanitizeMessage(text) {
    let cleanText = text;
    bannedWords.forEach(word => {
        const regex = new RegExp(word, "gi");
        cleanText = cleanText.replace(regex, "****");
    });
    return cleanText;
}

function sendMessage() {
    let text = messageInput.value.trim();
    if(!text) return;

    text = sanitizeMessage(text);

    const messageData = {
        text,
        replyTo: replyToMessageId,
        username
    };

    addMessageToChat(messageData, true);
    socket.emit("send-message", messageData);

    messageInput.value = "";
    sendBtn.disabled = true;
    replyingToContainer.style.display = "none";
    replyToMessageId = null;
}

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
    if(e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Add message to chat
function addMessageToChat(msg, isYou = false) {
    const div = document.createElement("div");
    div.classList.add("message");
    if(isYou) div.classList.add("you"); else div.classList.add("stranger");
    div.dataset.id = msg.messageId || Date.now();

    let replyHTML = "";
    if(msg.replyTo) {
        const repliedMsg = document.querySelector(`.message[data-id='${msg.replyTo}']`);
        if(repliedMsg) {
            replyHTML = `<div class="reply-preview">${repliedMsg.querySelector(".message-text").textContent}</div>`;
            repliedMsg.classList.add("highlight-replied"); // Highlight the original message
        }
    }

    div.innerHTML = `
        <div class="message-bubble">
            ${replyHTML ? `<div class="replying-to">${replyHTML}</div>` : ""}
            <div class="message-text">${msg.text}</div>
            <div class="message-reactions"></div>
        </div>
    `;

    messagesArea.appendChild(div);

    div.addEventListener("click", () => {
        if(!isYou) return;
        replyToMessageId = div.dataset.id;
        replyText.textContent = msg.text;
        replyingToContainer.style.display = "flex";
    });

    // Add reaction buttons
    const reactionsContainer = div.querySelector(".message-reactions");
    const reactionEmojis = ["😊","😂","😍","👍","👎"];
    reactionEmojis.forEach(emoji => {
        const btn = document.createElement("button");
        btn.textContent = emoji;
        btn.classList.add("reaction-emoji-btn");
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            socket.emit("reactMessage", { messageId: div.dataset.id, emoji });
            addReaction(div, emoji);
        });
        reactionsContainer.appendChild(btn);
    });

    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Add reaction to a message
function addReaction(messageDiv, emoji) {
    const container = messageDiv.querySelector(".message-reactions");
    let existing = container.querySelector(`.reaction-item[data-emoji='${emoji}']`);
    if(existing) {
        existing.querySelector(".reaction-count").textContent = parseInt(existing.querySelector(".reaction-count").textContent) + 1;
    } else {
        const reactionItem = document.createElement("div");
        reactionItem.classList.add("reaction-item");
        reactionItem.dataset.emoji = emoji;
        reactionItem.innerHTML = `<span class="reaction-emoji">${emoji}</span> <span class="reaction-count">1</span>`;
        container.appendChild(reactionItem);
    }
}

// Socket events
socket.on("receiveMessage", msg => addMessageToChat(msg, false));
socket.on("typing", data => typingIndicator.classList.toggle("active", data.typing));
socket.on("match-found", stranger => {
    statusDot.classList.remove("searching");
    statusDot.classList.add("connected");
    statusText.textContent = "Connected";
    strangerName.textContent = stranger.partnerUsername || "Stranger";
    inputArea.style.display = "flex";
});
socket.on("reactionAdded", data => {
    const msgDiv = document.querySelector(`.message[data-id='${data.messageId}']`);
    if(msgDiv) addReaction(msgDiv, data.emoji);
});
