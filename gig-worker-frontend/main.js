// Updated main.js with theme toggle and chat functionality

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
const apiUrl = "http://localhost:5000/api";

let socket = null;
let currentChatUser = null;
let conversations = [];

// Initialize Socket.IO connection
function initializeSocket() {
  if (token) {
    socket = io('http://localhost:5000', {
      auth: {
        token: token
      }
    });

    socket.on('connect', () => {
      console.log('✅ Connected to chat server');
    });

    socket.on('new_message', (message) => {
      handleNewMessage(message);
    });

    socket.on('message_sent', (message) => {
      if (currentChatUser && 
          (message.receiver._id === currentChatUser._id || message.sender._id === currentChatUser._id)) {
        displayMessage(message);
      }
      updateConversationsList();
    });

    socket.on('user_typing', (data) => {
      showTypingIndicator(data);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from chat server');
    });
  }
}

// Theme Toggle Functionality
function initializeTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('theme') || 'light';
  
  // Apply saved theme
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
  });
}

function updateThemeButton(theme) {
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Chat Modal Functionality
function initializeChat() {
  const chatToggleBtn = document.getElementById('chat-toggle-btn');
  const chatModal = document.getElementById('chat-modal');
  const closeChatBtn = document.getElementById('close-chat');
  const sendMessageBtn = document.getElementById('send-message-btn');
  const chatInput = document.getElementById('chat-input');

  chatToggleBtn.addEventListener('click', () => {
    chatModal.style.display = 'block';
    loadConversations();
  });

  closeChatBtn.addEventListener('click', () => {
    chatModal.style.display = 'none';
  });

  // Close modal when clicking outside
  chatModal.addEventListener('click', (e) => {
    if (e.target === chatModal) {
      chatModal.style.display = 'none';
    }
  });

  sendMessageBtn.addEventListener('click', sendMessage);
  
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Typing indicator
  let typingTimer;
  chatInput.addEventListener('input', () => {
    if (currentChatUser && socket) {
      socket.emit('typing', {
        otherUserId: currentChatUser._id,
        isTyping: true
      });
      
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        socket.emit('typing', {
          otherUserId: currentChatUser._id,
          isTyping: false
        });
      }, 1000);
    }
  });
}

// Load conversations
async function loadConversations() {
  try {
    const response = await fetch(`${apiUrl}/chat/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      conversations = await response.json();
      displayConversations();
    } else {
      console.error('Failed to load conversations');
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
  }
}

// Display conversations in sidebar
function displayConversations() {
  const conversationsList = document.getElementById('conversations-list');
  conversationsList.innerHTML = '';

  if (conversations.length === 0) {
    conversationsList.innerHTML = '<div class="no-conversations">No conversations yet</div>';
    return;
  }

  conversations.forEach(conversation => {
    const conversationDiv = document.createElement('div');
    conversationDiv.className = 'conversation-item';
    conversationDiv.onclick = () => selectConversation(conversation);

    const unreadBadge = conversation.unreadCount > 0 
      ? `<span class="unread-badge">${conversation.unreadCount}</span>` 
      : '';

    conversationDiv.innerHTML = `
      <div class="conversation-name">${conversation.otherUser.name}</div>
      <div class="conversation-preview">${conversation.lastMessage.content}</div>
      ${unreadBadge}
    `;

    conversationsList.appendChild(conversationDiv);
  });
}

// Select a conversation
async function selectConversation(conversation) {
  currentChatUser = conversation.otherUser;
  
  // Update UI
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.remove('active');
  });
  event.currentTarget.classList.add('active');

  // Show chat interface
  document.getElementById('chat-header').style.display = 'block';
  document.getElementById('chat-input-container').style.display = 'flex';
  document.getElementById('no-chat-selected').style.display = 'none';
  document.getElementById('chat-with-name').textContent = `Chat with ${currentChatUser.name}`;

  // Join chat room
  if (socket) {
    socket.emit('join_chat', currentChatUser._id);
  }

  // Load messages
  await loadMessages(currentChatUser._id);
}

// Load messages for a conversation
async function loadMessages(otherUserId) {
  try {
    const response = await fetch(`${apiUrl}/chat/messages/${otherUserId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const messages = await response.json();
      displayMessages(messages);
    } else {
      console.error('Failed to load messages');
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

// Display messages in chat area
function displayMessages(messages) {
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.innerHTML = '';

  messages.forEach(message => {
    displayMessage(message);
  });

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Display a single message
function displayMessage(message) {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  
  const isOwnMessage = message.sender._id === getCurrentUserId();
  messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;
  
  const messageTime = new Date(message.createdAt).toLocaleTimeString();
  
  messageDiv.innerHTML = `
    <div class="message-content">${message.content}</div>
    <div class="message-time">${messageTime}</div>
  `;
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send a message
async function sendMessage() {
  const chatInput = document.getElementById('chat-input');
  const content = chatInput.value.trim();
  
  if (!content || !currentChatUser) return;

  try {
    const response = await fetch(`${apiUrl}/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        receiverId: currentChatUser._id,
        content: content
      })
    });

    if (response.ok) {
      chatInput.value = '';
      // Message will be displayed via socket event
    } else {
      console.error('Failed to send message');
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Handle new incoming messages
function handleNewMessage(message) {
  // Show notification if chat modal is closed
  const chatModal = document.getElementById('chat-modal');
  if (chatModal.style.display === 'none') {
    showNotification(`New message from ${message.sender.name}`);
  }

  // Update conversations list
  updateConversationsList();

  // Display message if current chat is open
  if (currentChatUser && message.sender._id === currentChatUser._id) {
    displayMessage(message);
  }
}

// Show notification
function showNotification(message) {
  // Simple notification - you can enhance this
  if (Notification.permission === 'granted') {
    new Notification('Gig Worker Finder', {
      body: message,
      icon: '/favicon.ico'
    });
  }
}

// Update conversations list
function updateConversationsList() {
  loadConversations();
}

// Get current user ID from token
function getCurrentUserId() {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id;
  } catch (error) {
    return null;
  }
}

// Start conversation with job poster (for workers applying to jobs)
async function startConversationWithEmployer(employerId, jobId, jobTitle) {
  try {
    const response = await fetch(`${apiUrl}/chat/start-conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        employerId: employerId,
        jobId: jobId,
        initialMessage: `Hi! I'm interested in your job posting: ${jobTitle}. I'd like to discuss the details.`
      })
    });

    if (response.ok) {
      alert('✅ Message sent to employer! Check your messages.');
      // Optionally open chat modal
      document.getElementById('chat-modal').style.display = 'block';
      loadConversations();
    } else {
      const data = await response.json();
      alert(`❌ ${data.message || 'Failed to send message'}`);
    }
  } catch (error) {
    console.error('Error starting conversation:', error);
  }
}

// Request notification permission
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Original authentication and role checking code
console.log("🔍 Debug - Token:", token);
console.log("🔍 Debug - Role:", role);

if (!token || !role) {
  console.log("❌ Missing token or role, redirecting to login");
  window.location.href = "index.html";
}

if (role !== "employer" && role !== "worker") {
  console.log("❌ Invalid role detected:", role);
  localStorage.clear();
  window.location.href = "index.html";
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  initializeChat();
  initializeSocket();
  requestNotificationPermission();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  if (socket) {
    socket.disconnect();
  }
  localStorage.clear();
  window.location.href = "index.html";
});

const employerView = document.getElementById("employerView");
const workerView = document.getElementById("workerView");

// Role-based view loading
if (role === "employer") {
  console.log("✅ Loading employer view");
  employerView.style.display = "block";
  workerView.style.display = "none";
  loadMyJobs();
  
  document.getElementById("jobForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const job = {
      title: document.getElementById("title").value,
      description: document.getElementById("description").value,
      location: document.getElementById("location").value,
      payRate: document.getElementById("payRate").value
    };
    
    try {
      const res = await fetch(`${apiUrl}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(job)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert("Job posted successfully!");
        document.getElementById("jobForm").reset();
        loadMyJobs();
      } else {
        alert(data.message || "Error posting job");
      }
    } catch (err) {
      console.error("Error posting job:", err);
      alert("Error posting job");
    }
  });
}

if (role === "worker") {
  console.log("✅ Loading worker view");
  workerView.style.display = "block";
  employerView.style.display = "none";
  loadJobs();
  
  document.getElementById("filterBtn").addEventListener("click", loadJobs);
}

async function loadJobs() {
  const location = document.getElementById("filterLocation").value;
  let url = `${apiUrl}/jobs`;
  if (location) url += `?location=${location}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    const jobList = document.getElementById("jobList");
    jobList.innerHTML = "";
    
    const jobs = data.jobs || data;
    
    if (jobs && jobs.length > 0) {
      jobs.forEach((job) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${job.title}</strong> — ${job.location} — Rs. ${job.payRate}
          <br/>
          <small>Posted by: ${job.employer?.name || 'Unknown'}</small>
          <br/>
          <div style="margin-top: 10px;">
            <button onclick="applyToJob('${job._id}')" style="margin-right: 10px;">Apply</button>
            <button onclick="startConversationWithEmployer('${job.employer?._id}', '${job._id}', '${job.title}')" class="chat-btn">💬 Message Employer</button>
          </div>
        `;
        jobList.appendChild(li);
      });
    } else {
      jobList.innerHTML = "<li>No jobs available</li>";
    }
  } catch (err) {
    console.error("Error loading jobs:", err);
    alert("Error loading jobs");
  }
}

async function loadMyJobs() {
  try {
    const res = await fetch(`${apiUrl}/jobs`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    const data = await res.json();
    const postedJobs = document.getElementById("postedJobs");
    postedJobs.innerHTML = "";
    
    const jobs = data.jobs || data;
    
    if (jobs && jobs.length > 0) {
      jobs.forEach((job) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${job.title}</strong> — ${job.location} — Rs. ${job.payRate}
          <br/>
          <small>Applicants: ${job.applicants?.length || 0}</small>
        `;
        postedJobs.appendChild(li);
      });
    } else {
      postedJobs.innerHTML = "<li>No jobs posted yet</li>";
    }
  } catch (err) {
    console.error("Error loading posted jobs:", err);
    alert("Error loading posted jobs");
  }
}

async function applyToJob(jobId) {
  const applyButton = event.target;
  const originalText = applyButton.textContent;
  applyButton.disabled = true;
  applyButton.textContent = "Applying...";
  
  try {
    const res = await fetch(`${apiUrl}/jobs/${jobId}/apply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert("✅ Application submitted successfully!");
      applyButton.textContent = "Applied!";
      applyButton.style.backgroundColor = "#28a745";
    } else {
      alert(`❌ ${data.message || "Error applying to job"}`);
      applyButton.disabled = false;
      applyButton.textContent = originalText;
    }
  } catch (err) {
    console.error("Error applying to job:", err);
    alert("❌ Error applying to job. Please try again.");
    applyButton.disabled = false;
    applyButton.textContent = originalText;
  }
}

// Make functions globally available
window.applyToJob = applyToJob;
window.startConversationWithEmployer = startConversationWithEmployer;