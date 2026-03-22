import { getSessionUser, clearSession } from "./auth.js";

const logoutBtn = document.getElementById('logoutBtn');
const mentorProfileName = document.getElementById('mentorProfileName');
const chatListEl = document.getElementById('chatList');
const chatHistoryEl = document.getElementById('chatHistory');
const chatInputArea = document.getElementById('chatInputArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

let currentMentorId = null;
let activeStudentId = null;
let activeStudentUsername = null;
let activeChatId = null;
let chatPollInterval = null;

// Handle Auth State Local Session
document.addEventListener('DOMContentLoaded', () => {
    const user = getSessionUser();
    
    if (user && user.role === 'mentor') {
        currentMentorId = user.uid;
        mentorProfileName.textContent = user.name || user.email;
        loadChatChannels();
    } else {
        window.location.href = '/login';
    }
});

logoutBtn.addEventListener('click', () => {
    clearSession();
    window.location.href = '/login';
});

// Load existing conversations where this mentor is a participant
async function loadChatChannels() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/mentorhub/chats/${currentMentorId}`);
        const data = await res.json();
        
        if (!data.chats || data.chats.length === 0) {
            chatListEl.innerHTML = '<div style="padding: 20px; color: #94a3b8; text-align: center;">No messages yet.</div>';
            return;
        }

        chatListEl.innerHTML = '';
        data.chats.forEach(chat => {
            renderChatListItem(chat.id, chat.studentId, chat.studentUsername || 'Anonymous Student', chat.lastMessage);
        });
    } catch (e) {
        console.error("Failed to load mentor chats", e);
        chatListEl.innerHTML = '<div style="padding: 20px; color: #ef4444; text-align: center;">Failed to load chats.</div>';
    }
}

function renderChatListItem(chatId, studentId, username, lastMessage) {
    const div = document.createElement('div');
    div.className = 'chat-user';
    if(studentId === activeStudentId) div.classList.add('active');
    
    div.innerHTML = `
        <div class="chat-username">${username}</div>
        <div class="chat-preview">${lastMessage || 'Click to view messages...'}</div>
    `;
    div.addEventListener('click', () => {
        document.querySelectorAll('.chat-user').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
        openChat(chatId, studentId, username);
    });
    chatListEl.appendChild(div);
}

function openChat(chatId, studentId, username) {
    activeStudentId = studentId;
    activeStudentUsername = username;
    activeChatId = chatId;
    chatInputArea.style.display = 'flex';
    
    // Initial Load
    fetchMessages(chatId, username);
    
    // Set up polling (since we removed Firebase onSnapshot)
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(() => {
        fetchMessages(chatId, username);
    }, 5000); // Poll every 5 seconds
}

async function fetchMessages(chatId, username) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/mentorhub/chat/${chatId}/messages`);
        const data = await res.json();
        
        chatHistoryEl.innerHTML = `<div style="color:#94a3b8; text-align:center; padding: 20px;">Chatting with ${username}</div>`;
        
        if (data.messages) {
            data.messages.forEach(msg => {
                renderMessageBubble(msg.text, msg.senderId === currentMentorId);
            });
            chatHistoryEl.scrollTo(0, chatHistoryEl.scrollHeight);
        }
    } catch(e) {
        console.error("Failed to fetch messages", e);
    }
}

function renderMessageBubble(text, isSentByMe) {
    const div = document.createElement('div');
    div.className = `msg-bubble ${isSentByMe ? 'msg-sent' : 'msg-received'}`;
    div.textContent = text;
    chatHistoryEl.appendChild(div);
}

// Sending a message from Mentor -> Student
async function sendMessage() {
    const text = messageInput.value.trim();
    if(!text || !activeStudentId || !currentMentorId || !activeChatId) return;
    
    messageInput.value = '';
    messageInput.focus();
    
    // Optimistic UI Update
    renderMessageBubble(text, true);
    chatHistoryEl.scrollTo(0, chatHistoryEl.scrollHeight);

    try {
        await fetch('${API_BASE_URL}/api/mentorhub/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: activeChatId,
                text: text,
                senderId: currentMentorId,
                mentorId: currentMentorId,
                studentId: activeStudentId,
                studentUsername: activeStudentUsername
            })
        });
        
        loadChatChannels(); // refresh left sidebar
    } catch(e) {
        console.error("Failed to send message", e);
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
});

const videoCallBtn = document.getElementById('videoCallBtn');
if (videoCallBtn) {
    videoCallBtn.addEventListener('click', () => {
        if(!activeChatId) return;
        window.location.href = `/video-call.html?room=${activeChatId}&role=mentor`;
    });
}

