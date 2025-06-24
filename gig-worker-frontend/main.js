// Updated main.js with theme toggle and chat functionality

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
const apiUrl = "http://localhost:5000/api";

let socket = null;
let currentChatUser = null;
let conversations = [];

function getStoredAuth() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const name = localStorage.getItem('name');
  const userId = localStorage.getItem('userId');
  
  return { token, role, name, userId };
}

// Message templates
const messageTemplates = {
  intro: "Hi! I'm interested in discussing the job opportunity. Could you tell me more about the position?",
  "follow-up": "Just following up on our previous conversation. I'm still very interested in this opportunity.",
  schedule: "Would you be available for a quick chat? I'm free on [DAY] at [TIME].",
  accept: "Thank you for your application! We'd like to move forward with your candidacy. When would be a good time to discuss next steps?",
  reject: "Thank you for your interest. While your qualifications are impressive, we've decided to move forward with other candidates at this time. We'll keep your application on file for future opportunities.",
  custom: ""
};

// Insert template text into chat input
window.insertTemplate = function() {
  const templateSelect = document.getElementById('message-template');
  const chatInput = document.getElementById('chat-input');
  const selectedTemplate = templateSelect.value;

  if (selectedTemplate && messageTemplates[selectedTemplate]) {
    chatInput.value = messageTemplates[selectedTemplate];
    chatInput.focus();
    
    // If it's the schedule template, add current date
    if (selectedTemplate === 'schedule') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const day = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
      const time = '10:00 AM';
      chatInput.value = chatInput.value.replace('[DAY]', day).replace('[TIME]', time);
    }
  }
  
  // Reset select to default option
  templateSelect.value = '';
}

// Initialize Socket.IO connection
function initializeSocket() {
  if (token) {
    try {
      socket = io('http://localhost:5000', {
        auth: {
          token: token
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        withCredentials: false,
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('✅ Connected to chat server');
        // Re-join chat room if there was an active conversation
        if (currentChatUser) {
          socket.emit('join_chat', currentChatUser._id);
        }
        // Load conversations when socket connects
        loadConversations();
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message);
        alert('Chat connection failed. Please refresh the page to try again.');
      });

      socket.on('new_message', (message) => {
        console.log('📩 New message received:', message);
        handleNewMessage(message);
      });

      socket.on('message_sent', (message) => {
        console.log('✅ Message sent successfully:', message);
        // Remove pending status from the message
        const pendingMessages = document.querySelectorAll('.message.pending');
        pendingMessages.forEach(msg => msg.classList.remove('pending'));
        // Refresh conversations
        loadConversations();
      });

      socket.on('message_error', (error) => {
        console.error('❌ Message error:', error);
        alert('Failed to send message. Please try again.');
      });

      socket.on('user_typing', (data) => {
        showTypingIndicator(data);
      });

      socket.on('disconnect', () => {
        console.log('❌ Disconnected from chat server');
      });
    } catch (error) {
      console.error('❌ Failed to initialize socket:', error);
      alert('Chat initialization failed. Please refresh the page.');
    }
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
    console.log('🔍 Loading conversations...');
    const response = await fetch(`${apiUrl}/chat/conversations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load conversations: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Conversations loaded:', data);

    // Make sure we have an array of conversations
    conversations = Array.isArray(data) ? data : [];
    
    // Update UI
    displayConversations();
  } catch (error) {
    console.error('❌ Error loading conversations:', error);
  }
}

// Display conversations in sidebar
function displayConversations() {
  const conversationsList = document.getElementById('conversations-list');
  conversationsList.innerHTML = '';

  if (!conversations || conversations.length === 0) {
    conversationsList.innerHTML = '<div class="no-conversations">No conversations yet</div>';
    return;
  }

  conversations.forEach(conversation => {
    if (!conversation.otherUser) {
      console.error('❌ Invalid conversation format:', conversation);
      return;
    }

    const conversationDiv = document.createElement('div');
    conversationDiv.className = 'conversation-item';
    if (currentChatUser && currentChatUser._id === conversation.otherUser._id) {
      conversationDiv.classList.add('active');
    }
    
    conversationDiv.onclick = () => selectConversation(conversation);

    const unreadBadge = conversation.unreadCount > 0 
      ? `<span class="unread-badge">${conversation.unreadCount}</span>` 
      : '';

    const lastMessage = conversation.lastMessage 
      ? conversation.lastMessage.content 
      : 'No messages yet';

    conversationDiv.innerHTML = `
      <div class="conversation-name">${conversation.otherUser.name}</div>
      <div class="conversation-preview">${lastMessage}</div>
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
  messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'} ${message.pending ? 'pending' : ''}`;
  
  const messageTime = new Date(message.createdAt).toLocaleTimeString();
  
  messageDiv.innerHTML = `
    <div class="message-content">${message.content}</div>
    <div class="message-time">${messageTime}</div>
    ${message.pending ? '<div class="message-status">Sending...</div>' : ''}
  `;
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send a message
async function sendMessage() {
  const chatInput = document.getElementById('chat-input');
  const content = chatInput.value.trim();
  
  if (!content) {
    return;
  }

  if (!currentChatUser) {
    alert('Please select a conversation first.');
    return;
  }

  try {
    console.log('📤 Sending message...');
    
    // Clear input immediately for better UX
    const messageContent = content;
    chatInput.value = '';

    // Create a temporary message element
    const tempMessage = {
      content: messageContent,
      sender: {
        _id: getCurrentUserId()
      },
      createdAt: new Date(),
      pending: true
    };
    displayMessage(tempMessage);

    // Send via REST API
    const response = await fetch(`${apiUrl}/chat/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receiverId: currentChatUser._id,
        content: messageContent
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

    const message = await response.json();
    console.log('✅ Message sent successfully:', message);

    // Remove pending status from temporary message
    const pendingMessages = document.querySelectorAll('.message.pending');
    pendingMessages.forEach(msg => msg.classList.remove('pending'));

    // Also emit via socket for real-time
    if (socket && socket.connected) {
      socket.emit('send_message', {
        receiverId: currentChatUser._id,
        content: messageContent
      });
    }

    // Refresh conversations after a short delay
    setTimeout(async () => {
      console.log('🔄 Refreshing conversations...');
      await loadConversations();
    }, 1000);

  } catch (error) {
    console.error('❌ Error sending message:', error);
    alert('Failed to send message. Please try again.');
    chatInput.value = messageContent;
  }
}

// Handle new incoming messages
function handleNewMessage(message) {
  // Show notification if chat modal is closed
  const chatModal = document.getElementById('chat-modal');
  if (chatModal.style.display === 'none') {
    showNotification(`New message from ${message.sender.name}`);
  }

  // Update conversations list immediately
  loadConversations();

  // Display message if current chat is open
  if (currentChatUser && (message.sender._id === currentChatUser._id || message.receiver._id === currentChatUser._id)) {
    displayMessage(message);
  }
}

// Show typing indicator
function showTypingIndicator(data) {
  if (!currentChatUser || data.userId !== currentChatUser._id) return;
  
  const chatMessages = document.getElementById('chat-messages');
  let typingIndicator = document.getElementById('typing-indicator');
  
  if (data.isTyping) {
    if (!typingIndicator) {
      typingIndicator = document.createElement('div');
      typingIndicator.id = 'typing-indicator';
      typingIndicator.className = 'typing-indicator';
      typingIndicator.innerHTML = `<span>${currentChatUser.name} is typing...</span>`;
      chatMessages.appendChild(typingIndicator);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } else if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Show notification
function showNotification(message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Gig Worker Finder', { body: message });
    playNotificationSound();
  } else {
    // Fallback: alert or in-app notification
    // alert(message);
  }
}

// Play a sound for new messages
function playNotificationSound() {
  const audio = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa1c82.mp3');
  audio.play();
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
      document.getElementById('chat-modal').style.display = 'block';
      await loadConversations();
      let convo = conversations.find(c => c.otherUser._id === employerId);
      if (!convo) {
        // Wait and try again if not found
        setTimeout(async () => {
          await loadConversations();
          convo = conversations.find(c => c.otherUser._id === employerId);
          if (convo) selectConversation(convo);
        }, 1000);
      } else {
        selectConversation(convo);
      }
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
  if ('Notification' in window && Notification.permission !== 'granted') {
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

if (role !== "employer" && role !== "worker" && role !== "admin") {
  console.log("❌ Invalid role detected:", role);
  localStorage.clear();
  window.location.href = "index.html";
}

// Initialize all functionality when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme and chat functionality
  initializeTheme();
  initializeChat();
  initializeSocket();
  requestNotificationPermission();

  // Initialize role-specific views and functionality
  const role = localStorage.getItem('role');
  const employerView = document.getElementById('employerView');
  const workerView = document.getElementById('workerView');
  const adminView = document.getElementById('adminView');

  // Hide all views initially
  employerView.style.display = 'none';
  workerView.style.display = 'none';
  adminView.style.display = 'none';

  // Show appropriate view based on role
  if (role === 'employer') {
    console.log("✅ Loading employer view");
    employerView.style.display = 'block';
    loadEmployerJobs();
    loadMyJobs();
    loadBookmarkedApplicants();
    
    // Add employer-specific event listeners
    const employerFilterBtn = document.getElementById('employerFilterBtn');
    if (employerFilterBtn) {
      employerFilterBtn.addEventListener('click', loadEmployerJobs);
    }

    // Add job form submission handler if it exists
    const jobForm = document.getElementById('jobForm');
    if (jobForm) {
      jobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const jobData = {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            location: document.getElementById('location').value,
            payRate: parseFloat(document.getElementById('payRate').value),
            jobType: document.getElementById('jobType').value
          };

          const response = await fetch(`${apiUrl}/jobs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(jobData)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to post job');
          }

          alert('Job posted successfully!');
          document.getElementById('jobForm').reset();
          // Refresh the job listings
          loadEmployerJobs();
        } catch (error) {
          console.error('Error posting job:', error);
          alert(error.message);
        }
      });
    }
  } else if (role === 'worker') {
    console.log("✅ Loading worker view");
    workerView.style.display = 'block';
    loadJobs();
    loadMyApplications();
    
    // Add worker-specific event listeners
    document.getElementById('filterBtn').addEventListener('click', loadJobs);
    document.getElementById('showFavoritesBtn').addEventListener('click', toggleFavorites);
  } else if (role === 'admin') {
    console.log("✅ Loading admin view");
    adminView.style.display = 'block';
    loadAllJobsForAdmin();
  }

  // Add logout functionality
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (socket) {
      socket.disconnect();
    }
    // Clear all auth data but preserve theme setting
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
  });

  // Add applicants modal close button handler
  const closeApplicantsBtn = document.getElementById('close-applicants-btn');
  if (closeApplicantsBtn) {
    closeApplicantsBtn.addEventListener('click', function() {
      const applicantsSection = document.getElementById('applicants-section');
      if (applicantsSection) {
        applicantsSection.style.display = 'none';
      } else {
        console.error('Applicants section not found');
      }
    });
  } else {
    console.error('Close applicants button not found');
  }
});

async function loadJobs() {
  const location = document.getElementById("filterLocation").value;
  const minPay = document.getElementById("filterMinPay").value;
  const maxPay = document.getElementById("filterMaxPay").value;
  const jobType = document.getElementById("filterJobType").value;
  const keyword = document.getElementById("filterKeyword").value;
  let url = `${apiUrl}/jobs?`;
  if (location) url += `location=${encodeURIComponent(location)}&`;
  if (minPay) url += `minPay=${encodeURIComponent(minPay)}&`;
  if (maxPay) url += `maxPay=${encodeURIComponent(maxPay)}&`;
  if (jobType) url += `jobType=${encodeURIComponent(jobType)}&`;
  if (keyword) url += `keyword=${encodeURIComponent(keyword)}&`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const jobList = document.getElementById("jobList");
    jobList.innerHTML = "";

    const jobs = data.jobs || data;
    const favorites = await getFavoriteJobIds();
    const userId = getCurrentUserId();

    if (jobs && jobs.length > 0) {
      jobs.forEach((job) => {
        const hasApplied = job.applicants && job.applicants.some(
          applicantId => applicantId === userId || applicantId._id === userId
        );
        const isFavorite = favorites.includes(job._id);
        const applyButton = hasApplied 
          ? `<button disabled style="background-color: #28a745; color: white; margin-right: 10px;">Applied!</button>` 
          : `<button onclick="applyToJob('${job._id}')" style="margin-right: 10px;">Apply</button>`;
        const favoriteButton = isFavorite
          ? `<button onclick="unfavoriteJob('${job._id}')" style="color: gold;">★ Unfavorite</button>`
          : `<button onclick="favoriteJob('${job._id}')">☆ Favorite</button>`;
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${job.title}</strong> — ${job.location} — Rs. ${job.payRate} — ${job.jobType || ''}
          <br/>
          <small>Posted by: ${job.employer?.name || 'Unknown'}</small>
          <br/>
          <div style="margin-top: 10px;">
            ${applyButton}
            ${favoriteButton}
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

async function getFavoriteJobIds() {
  try {
    const res = await fetch(`${apiUrl}/jobs/favorites`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return (data.jobs || []).map(job => job._id);
  } catch (err) {
    return [];
  }
}

window.favoriteJob = async function(jobId) {
  try {
    const res = await fetch(`${apiUrl}/jobs/${jobId}/favorite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      loadJobs();
    } else {
      alert('Failed to favorite job.');
    }
  } catch (err) {
    alert('Failed to favorite job.');
  }
}

window.unfavoriteJob = async function(jobId) {
  try {
    const res = await fetch(`${apiUrl}/jobs/${jobId}/favorite`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      loadJobs();
    } else {
      alert('Failed to unfavorite job.');
    }
  } catch (err) {
    alert('Failed to unfavorite job.');
  }
}

async function loadFavoriteJobs() {
  try {
    const res = await fetch(`${apiUrl}/jobs/favorites`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const favoriteJobsList = document.getElementById('favoriteJobsList');
    favoriteJobsList.innerHTML = '';
    const jobs = data.jobs || [];
    if (jobs.length > 0) {
      jobs.forEach(job => {
        const li = document.createElement('li');
        li.innerHTML = `
          <strong>${job.title}</strong> — ${job.location} — Rs. ${job.payRate} — ${job.jobType || ''}
          <br/>
          <small>Posted by: ${job.employer?.name || 'Unknown'}</small>
          <br/>
          <button onclick="unfavoriteJob('${job._id}')">Remove from Favorites</button>
        `;
        favoriteJobsList.appendChild(li);
      });
    } else {
      favoriteJobsList.innerHTML = '<li>No favorite jobs</li>';
    }
  } catch (err) {
    alert('Failed to load favorite jobs.');
  }
}

function toggleFavorites() {
  const favoriteJobsList = document.getElementById('favoriteJobsList');
  if (favoriteJobsList.style.display === 'none' || favoriteJobsList.style.display === '') {
    loadFavoriteJobs();
    favoriteJobsList.style.display = 'block';
  } else {
    favoriteJobsList.style.display = 'none';
  }
}

async function loadMyJobs() {
  try {
    const res = await fetch(`${apiUrl}/jobs/mine`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();
    const postedJobs = document.getElementById("postedJobs");
    postedJobs.innerHTML = "";
    const jobs = data.jobs || data;
    if (jobs && jobs.length > 0) {
      const userId = getCurrentUserId();
      jobs.forEach((job) => {
        const li = document.createElement("li");
        let buttons = `<button onclick="viewApplicants('${job._id}', '${job.title}')">View Applicants (${job.applicants?.length || 0})</button>`;
        if (job.employer && job.employer._id === userId) {
          buttons += `
            <button onclick="editJob('${job._id}')" class="edit-btn">Edit</button>
            <button onclick="deleteJob('${job._id}')" class="delete-btn">Delete</button>
          `;
        }
        li.innerHTML = `
          <strong>${job.title}</strong> — ${job.location} — Rs. ${job.payRate}
          <br/>
          <small>Applicants: ${job.applicants?.length || 0}</small>
          <div style="margin-top: 10px;">
            ${buttons}
          </div>
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

function editJob(jobId) {
  const newTitle = prompt("Enter new title:");
  if (newTitle) {
    updateJob(jobId, { title: newTitle });
  }
}

async function deleteJob(jobId) {
  if (confirm("Are you sure you want to delete this job?")) {
    try {
      const res = await fetch(`${apiUrl}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        loadMyJobs();
      } else {
        alert('Failed to delete job.');
      }
    } catch (err) {
      console.error('Error deleting job:', err);
    }
  }
}

async function updateJob(jobId, data) {
  try {
    const res = await fetch(`${apiUrl}/jobs/${jobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      loadMyJobs();
    } else {
      alert('Failed to update job.');
    }
  } catch (err) {
    console.error('Error updating job:', err);
  }
}

window.editJob = editJob;
window.deleteJob = deleteJob;

// View applicants for a job
async function viewApplicants(jobId, jobTitle) {
  try {
    if (!jobId) {
      throw new Error('Invalid job ID');
    }

    const response = await fetch(`http://localhost:5000/api/jobs/${jobId}/applicants`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to load applicants');
    }

    const applicants = await response.json();
    const applicantsList = document.getElementById('applicants-list');
    const applicantsSection = document.getElementById('applicants-section');
    const applicantsJobTitle = document.getElementById('applicants-job-title');
    
    applicantsList.innerHTML = '';
    applicantsSection.style.display = 'block';
    applicantsJobTitle.textContent = `Applicants for: ${jobTitle}`;

    if (!applicants || applicants.length === 0) {
      applicantsList.innerHTML = '<li>No applicants yet</li>';
      return;
    }

    applicants.forEach(applicant => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="applicant-card">
          <h4>${applicant.name}</h4>
          <p>${applicant.email}</p>
          <div class="applicant-actions">
            <button 
              onclick="toggleBookmark('${jobId}', '${applicant._id}', ${applicant.isBookmarked})"
              data-bookmark-job="${jobId}"
              data-bookmark-user="${applicant._id}"
              data-bookmarked="${applicant.isBookmarked}"
              class="${applicant.isBookmarked ? 'remove-bookmark-btn' : 'bookmark-btn'}"
            >
              ${applicant.isBookmarked ? '✖ Remove Bookmark' : '⭐ Bookmark'}
            </button>
            <button 
              onclick="startChat('${applicant._id}', '${applicant.name}')"
              class="chat-btn"
            >
              💬 Chat
            </button>
          </div>
        </div>
      `;
      applicantsList.appendChild(li);
    });
  } catch (error) {
    console.error('Error viewing applicants:', error);
    alert(error.message);
  }
}

// Close applicants modal
document.getElementById('close-applicants-btn').addEventListener('click', () => {
  document.getElementById('applicants-section').style.display = 'none';
});

async function loadMyApplications() {
  try {
    const res = await fetch(`${apiUrl}/jobs/my-applications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const myApplicationsList = document.getElementById('myApplicationsList');
    myApplicationsList.innerHTML = '';
    const applications = data.applications || [];
    if (applications.length > 0) {
      applications.forEach(app => {
        const li = document.createElement('li');
        li.innerHTML = `
          <strong>${app.title}</strong> — ${app.location} — Rs. ${app.payRate} — ${app.jobType || ''}<br/>
          <em>Status:</em> ${app.status} <em>Applied At:</em> ${new Date(app.appliedAt).toLocaleString()}
        `;
        myApplicationsList.appendChild(li);
      });
    } else {
      myApplicationsList.innerHTML = '<li>No applications yet</li>';
    }
  } catch (err) {
    alert('Failed to load applications.');
  }
}

if (role === "employer") {
  // Add logic to load bookmarked applicants for all jobs
  loadBookmarkedApplicants();
}

async function loadBookmarkedApplicants() {
  try {
    const res = await fetch(`${apiUrl}/jobs`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const jobs = data.jobs || [];
    const bookmarkedApplicantsList = document.getElementById('bookmarkedApplicantsList');
    bookmarkedApplicantsList.innerHTML = '';
    let hasBookmarks = false;
    for (const job of jobs) {
      const res2 = await fetch(`${apiUrl}/jobs/${job._id}/bookmarked-applicants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data2 = await res2.json();
      const applicants = data2.bookmarkedApplicants || [];
      if (applicants.length > 0) {
        hasBookmarks = true;
        applicants.forEach(applicant => {
          const li = document.createElement('li');
          li.innerHTML = `
            <strong>${applicant.name}</strong> (${applicant.email}) — ${applicant.role}<br/>
            <em>Bookmarked for job:</em> ${job.title}
          `;
          bookmarkedApplicantsList.appendChild(li);
        });
      }
    }
    if (!hasBookmarks) {
      bookmarkedApplicantsList.innerHTML = '<li>No bookmarked applicants</li>';
    }
  } catch (err) {
    alert('Failed to load bookmarked applicants.');
  }
}

window.updateApplicationStatus = async function(jobId, userId, status) {
  try {
    const res = await fetch(`${apiUrl}/jobs/${jobId}/applications/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      document.getElementById(`status-${jobId}-${userId}`).textContent = status;
      alert('Status updated!');
    } else {
      const data = await res.json();
      alert(data.message || 'Failed to update status.');
    }
  } catch (err) {
    console.error('Error updating status:', err);
    alert('Failed to update status.');
  }
}

window.bookmarkApplicant = async function(jobId, userId) {
  try {
    const res = await fetch(`${apiUrl}/jobs/${jobId}/applications/${userId}/bookmark`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      alert('Applicant bookmarked!');
      loadBookmarkedApplicants();
    } else {
      const data = await res.json();
      alert(data.message || 'Failed to bookmark applicant.');
    }
  } catch (err) {
    console.error('Error bookmarking applicant:', err);
    alert('Failed to bookmark applicant.');
  }
}

window.removeBookmark = async function(jobId, userId) {
  try {
    const res = await fetch(`${apiUrl}/jobs/${jobId}/applications/${userId}/bookmark`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      alert('Bookmark removed!');
      loadBookmarkedApplicants();
    } else {
      alert('Failed to remove bookmark.');
    }
  } catch (err) {
    console.error('Error removing bookmark:', err);
    alert('Failed to remove bookmark.');
  }
}

async function loadAllJobsForAdmin() {
  try {
    const res = await fetch(`${apiUrl}/jobs`);
    const data = await res.json();
    const jobs = data.jobs || [];
    const allJobsList = document.getElementById("allJobsList");
    allJobsList.innerHTML = "";
    if (jobs.length > 0) {
      jobs.forEach(job => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${job.title}</strong> — ${job.location} — Rs. ${job.payRate} — ${job.jobType || ''}<br/>
          <small>Posted by: ${job.employer?.name || 'Unknown'}</small>
          <button onclick="deleteJobAsAdmin('${job._id}')">Delete</button>
        `;
        allJobsList.appendChild(li);
      });
    } else {
      allJobsList.innerHTML = "<li>No jobs found</li>";
    }
  } catch (err) {
    alert("Failed to load jobs for admin.");
  }
}

window.deleteJobAsAdmin = async function(jobId) {
  if (confirm("Are you sure you want to delete this job?")) {
    try {
      const res = await fetch(`${apiUrl}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        loadAllJobsForAdmin();
      } else {
        alert('Failed to delete job.');
      }
    } catch (err) {
      alert('Failed to delete job.');
    }
  }
}

// Load employer's posted jobs and initialize bookmarked applicants
async function loadEmployerJobs() {
  try {
    const response = await fetch('http://localhost:5000/api/jobs/mine', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load jobs');
    }

    const { jobs } = await response.json();
    const postedJobsList = document.getElementById('postedJobs');
    postedJobsList.innerHTML = '';

    if (jobs.length === 0) {
      postedJobsList.innerHTML = '<li>No jobs posted yet</li>';
      return;
    }

    jobs.forEach(job => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="job-card">
          <h3>${job.title}</h3>
          <p>${job.description}</p>
          <p>Location: ${job.location}</p>
          <p>Pay Rate: $${job.payRate}/hr</p>
          <p>Type: ${job.jobType}</p>
          <div class="job-actions">
            <button onclick="viewBookmarkedApplicants('${job._id}', '${job.title}')">View Bookmarked Applicants</button>
            <button onclick="viewApplicants('${job._id}', '${job.title}')">View All Applicants</button>
          </div>
        </div>
      `;
      postedJobsList.appendChild(li);
    });
  } catch (error) {
    console.error('Error loading employer jobs:', error);
    alert(error.message);
  }
}

// View bookmarked applicants for a job
async function viewBookmarkedApplicants(jobId, jobTitle) {
  try {
    if (!jobId) {
      throw new Error('Invalid job ID');
    }

    // Use applicants endpoint instead and filter for bookmarked ones
    const response = await fetch(`http://localhost:5000/api/jobs/${jobId}/applicants`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to load bookmarked applicants');
    }

    const applicants = await response.json();
    const bookmarkedApplicants = applicants.filter(app => app.isBookmarked);
    
    const bookmarkedList = document.getElementById('bookmarkedApplicantsList');
    const applicantsSection = document.getElementById('applicants-section');
    const applicantsJobTitle = document.getElementById('applicants-job-title');
    
    bookmarkedList.innerHTML = '';
    applicantsSection.style.display = 'block';
    applicantsJobTitle.textContent = `Bookmarked Applicants for: ${jobTitle}`;

    if (!bookmarkedApplicants || bookmarkedApplicants.length === 0) {
      bookmarkedList.innerHTML = '<li>No bookmarked applicants for this job</li>';
      return;
    }

    bookmarkedApplicants.forEach(applicant => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="applicant-card">
          <h4>${applicant.name}</h4>
          <p>${applicant.email}</p>
          <div class="applicant-actions">
            <button 
              onclick="toggleBookmark('${jobId}', '${applicant._id}', true)"
              class="remove-bookmark-btn"
            >
              ✖ Remove Bookmark
            </button>
            <button 
              onclick="startChat('${applicant._id}', '${applicant.name}')"
              class="chat-btn"
            >
              💬 Chat
            </button>
          </div>
        </div>
      `;
      bookmarkedList.appendChild(li);
    });
  } catch (error) {
    console.error('Error loading bookmarked applicants:', error);
    alert(error.message);
  }
}

// Handle bookmark/unbookmark applicant
async function toggleBookmark(jobId, userId, isBookmarked) {
  try {
    if (!jobId || !userId) {
      throw new Error('Invalid job or user ID');
    }

    const method = isBookmarked ? 'DELETE' : 'POST';
    const response = await fetch(`http://localhost:5000/api/jobs/${jobId}/applications/${userId}/bookmark`, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to toggle bookmark');
    }

    // Show success message
    alert(isBookmarked ? 'Bookmark removed successfully' : 'Applicant bookmarked successfully');

    // Refresh the current view
    if (document.getElementById('bookmarkedApplicantsList').innerHTML) {
      await viewBookmarkedApplicants(jobId);
    } else {
      await viewApplicants(jobId);
    }
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    alert(error.message);
  }
}

// Start a chat with an applicant
async function startChat(userId, userName) {
  try {
    if (!userId) {
      throw new Error('Invalid user ID');
    }

    // Show chat modal
    const chatModal = document.getElementById('chat-modal');
    chatModal.style.display = 'block';

    // Set chat header
    const chatWithName = document.getElementById('chat-with-name');
    chatWithName.textContent = `Chat with ${userName}`;
    document.getElementById('chat-header').style.display = 'block';

    // Show chat input container
    const chatInputContainer = document.getElementById('chat-input-container');
    chatInputContainer.style.display = 'block';

    // Hide no chat selected message
    document.getElementById('no-chat-selected').style.display = 'none';

    // Show chat messages
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.style.display = 'block';
    chatMessages.innerHTML = ''; // Clear previous messages

    // Load chat history
    try {
      const response = await fetch(`http://localhost:5000/api/chat/messages/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load chat history');
      }

      const messages = await response.json();
      
      if (messages && messages.length > 0) {
        messages.forEach(message => {
          const messageDiv = document.createElement('div');
          messageDiv.className = `message ${message.sender._id === userId ? 'received' : 'sent'}`;
          messageDiv.innerHTML = `
            <p class="message-text">${message.content}</p>
            <span class="message-time">${new Date(message.createdAt).toLocaleTimeString()}</span>
          `;
          chatMessages.appendChild(messageDiv);
        });

        // Mark messages as read using POST instead of PATCH
        try {
          await fetch(`http://localhost:5000/api/chat/mark-read/${userId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
        } catch (markReadError) {
          console.error('Error marking messages as read:', markReadError);
          // Don't throw error here, just log it
        }
      } else {
        const noMessagesDiv = document.createElement('div');
        noMessagesDiv.className = 'no-messages';
        noMessagesDiv.textContent = 'No messages yet. Start the conversation!';
        chatMessages.appendChild(noMessagesDiv);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      chatMessages.innerHTML = '<div class="error-message">Failed to load chat history. Please try again later.</div>';
    }

    // Set current chat partner
    window.currentChatPartner = userId;

    // Scroll to bottom of chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (error) {
    console.error('Error starting chat:', error);
    alert(error.message);
  }
}

// Make functions available globally
window.viewBookmarkedApplicants = viewBookmarkedApplicants;
window.viewApplicants = viewApplicants;
window.toggleBookmark = toggleBookmark;
window.startChat = startChat;

// Close applicants modal
document.getElementById('close-applicants-btn').addEventListener('click', () => {
  document.getElementById('applicants-section').style.display = 'none';
});
