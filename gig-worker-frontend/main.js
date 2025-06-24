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


    socket.on('user_typing', (data) => {
      showTypingIndicator(data);
    });

    // Handle connection errors
    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
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
function sendMessage() {
  const chatInput = document.getElementById('chat-input');
  const content = chatInput.value.trim();
  
  if (content && currentChatUser && socket) {
    socket.emit('send_message', {
      receiverId: currentChatUser._id,
      content: content
    });
    chatInput.value = '';
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
const adminView = document.getElementById("adminView");

// Role-based view loading
if (role === "employer") {
  console.log("✅ Loading employer view");
  employerView.style.display = "block";
  workerView.style.display = "none";
  loadMyJobs();
  loadBookmarkedApplicants();
  
  document.getElementById("jobForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const job = {
      title: document.getElementById("title").value,
      description: document.getElementById("description").value,
      location: document.getElementById("location").value,
      payRate: document.getElementById("payRate").value,
      jobType: document.getElementById("jobType").value
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
  loadMyApplications();
  
  document.getElementById("filterBtn").addEventListener("click", loadJobs);
  document.getElementById("showFavoritesBtn").addEventListener("click", toggleFavorites);
}

if (role === "admin") {
  adminView.style.display = "block";
  employerView.style.display = "none";
  workerView.style.display = "none";
  loadAllJobsForAdmin();
}

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

async function viewApplicants(jobId, jobTitle) {
  const { token } = getStoredAuth();
  try {
    const response = await fetch(`${apiUrl}/jobs/${jobId}/applicants`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    // Fetch job to get bookmarkedApplicants
    const jobRes = await fetch(`${apiUrl}/jobs/${jobId}`);
    const jobData = await jobRes.json();
    const bookmarked = (jobData.bookmarkedApplicants || []).map(id => id.toString());
    if (response.ok) {
      const applicantsJobTitle = document.getElementById('applicants-job-title');
      const applicantsList = document.getElementById('applicants-list');
      const applicantsSection = document.getElementById('applicants-section');
      applicantsJobTitle.textContent = jobTitle;
      applicantsList.innerHTML = '';
      if (data.length > 0) {
        for (const applicant of data) {
          const isBookmarked = bookmarked.includes(applicant._id);
          const li = document.createElement('li');
          li.innerHTML = `
            <strong>${applicant.name}</strong><br>
            <em>Email:</em> ${applicant.email}<br>
            <em>Role:</em> ${applicant.role}<br>
            <em>Status:</em> <span id="status-${jobId}-${applicant._id}">${applicant.status}</span><br>
            <button onclick="updateApplicationStatus('${jobId}','${applicant._id}','accepted')">Accept</button>
            <button onclick="updateApplicationStatus('${jobId}','${applicant._id}','rejected')">Reject</button>
            ${isBookmarked
              ? `<button onclick="removeBookmark('${jobId}','${applicant._id}')">Remove Bookmark</button>`
              : `<button onclick="bookmarkApplicant('${jobId}','${applicant._id}')">Bookmark</button>`}
          `;
          applicantsList.appendChild(li);
        }
      } else {
        applicantsList.innerHTML = '<li>No applicants yet</li>';
      }
      applicantsSection.style.display = 'block';
    } else {
      alert(data.message || 'Failed to load applicants');
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
}

window.viewApplicants = viewApplicants;

document.addEventListener('DOMContentLoaded', () => {
    const closeApplicantsBtn = document.getElementById('close-applicants-btn');
    if(closeApplicantsBtn) {
        closeApplicantsBtn.addEventListener('click', () => {
            document.getElementById('applicants-section').style.display = 'none';
        });
    }
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
      alert('Failed to update status.');
    }
  } catch (err) {
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
