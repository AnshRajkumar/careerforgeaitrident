import { getSessionUser } from "./auth.js";

const studentProfileName = document.getElementById('studentProfileName');
const mentorListEl = document.getElementById('mentorList');
const chatHistoryEl = document.getElementById('chatHistory');
const chatInputArea = document.getElementById('chatInputArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

let currentStudentId = null;
let currentStudentUsername = null;
let activeMentorId = null;
let activeMentorName = null;
let activeChatId = null;
let chatPollInterval = null;

// Handle Auth State Local Session
document.addEventListener('DOMContentLoaded', () => {
    const user = getSessionUser();
    
    if (user) {
        currentStudentId = user.uid;
        currentStudentUsername = user.name || user.email;
        studentProfileName.textContent = currentStudentUsername;
        loadMentors();
    } else {
        window.location.href = '/login';
    }
});

// Load available mentors from backend
async function loadMentors() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/mentors`);
        const data = await res.json();
        
        if (!data.mentors || data.mentors.length === 0) {
            mentorListEl.innerHTML = '<div style="padding: 20px; color: #94a3b8; text-align: center;">No mentors available right now.</div>';
            return;
        }

        mentorListEl.innerHTML = '';
        data.mentors.forEach(mentor => {
            renderMentorListItem(mentor);
        });
    } catch (e) {
        console.error("Failed to load mentors", e);
        mentorListEl.innerHTML = '<div style="padding: 20px; color: #ef4444; text-align: center;">Failed to load mentors. Please try again.</div>';
    }
}

function renderMentorListItem(mentor) {
    const div = document.createElement('div');
    div.className = 'chat-user';
    
    div.innerHTML = `
        <div class="chat-username">
            ${mentor.name}
            <span class="verified-badge">VERIFIED</span>
        </div>
        <div class="expertise-tag">${mentor.expertise} • ${mentor.experience} yrs exp</div>
    `;
    
    div.addEventListener('click', () => {
        document.querySelectorAll('.chat-user').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
        openChat(mentor.id, mentor.name);
    });
    
    mentorListEl.appendChild(div);
}

function openChat(mentorId, mentorName) {
    activeMentorId = mentorId;
    activeMentorName = mentorName;
    // Generate a consistent chat ID based on student and mentor IDs
    activeChatId = `chat_${currentStudentId}_${mentorId}`;
    
    chatInputArea.style.display = 'flex';
    
    // Initial Load
    fetchMessages();
    
    // Set up polling (since we removed Firebase onSnapshot)
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(() => {
        fetchMessages();
    }, 3000); // Poll every 3 seconds for snappy messaging
}

async function fetchMessages() {
    if (!activeChatId) return;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/mentorhub/chat/${activeChatId}/messages`);
        
        // If chat doesn't exist yet, it will return an error or empty array, handle gracefully
        if (!res.ok && res.status !== 404) return;
        
        const data = await res.json();
        
        chatHistoryEl.innerHTML = `<div style="color:#94a3b8; text-align:center; padding: 20px;">Chatting with ${activeMentorName}</div>`;
        
        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
                renderMessageBubble(msg.text, msg.senderId === currentStudentId);
            });
            chatHistoryEl.scrollTo(0, chatHistoryEl.scrollHeight);
        } else {
            chatHistoryEl.innerHTML += `<div style="color:#94a3b8; text-align:center; padding: 20px; font-size: 0.9rem;">Send your first message to introduce yourself!</div>`;
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

// Sending a message from Student -> Mentor
async function sendMessage() {
    const text = messageInput.value.trim();
    if(!text || !activeMentorId || !currentStudentId || !activeChatId) return;
    
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
                senderId: currentStudentId,
                mentorId: activeMentorId,
                studentId: currentStudentId,
                studentUsername: currentStudentUsername
            })
        });

        // V17: Log activity for dashboard
        if (typeof logActivity === 'function') {
            logActivity('mentor_chat', `Messaged mentor: ${activeMentorName}`);
        }
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
        window.location.href = `/video-call.html?room=${activeChatId}&role=student`;
    });
}
