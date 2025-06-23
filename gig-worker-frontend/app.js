const API_BASE = 'http://localhost:5000/api';

// Elements
const authSection = document.getElementById('auth-section');
const registerForm = document.getElementById('register-form');
const registerMsg = document.getElementById('register-message');
const loginForm = document.getElementById('login-form');
const loginMsg = document.getElementById('login-message');
const userSection = document.getElementById('user-section');
const userName = document.getElementById('user-name');
const userRole = document.getElementById('user-role');
const logoutBtn = document.getElementById('logout-btn');
const postJobSection = document.getElementById('post-job-section');
const postJobForm = document.getElementById('post-job-form');
const postJobMsg = document.getElementById('post-job-message');
const jobsList = document.getElementById('jobs-list');
const applicantsSection = document.getElementById('applicants-section');
const applicantsList = document.getElementById('applicants-list');
const applicantsJobTitle = document.getElementById('applicants-job-title');
const closeApplicantsBtn = document.getElementById('close-applicants-btn');

// Fix 1: Better token and role management with debugging
function getStoredAuth() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const name = localStorage.getItem('name');
  const userId = localStorage.getItem('userId');
  
  console.log('🔍 Debug - Stored token:', token ? 'exists' : 'missing');
  console.log('🔍 Debug - Stored role:', role);
  console.log('🔍 Debug - Stored name:', name);
  
  return { token, role, name, userId };
}

function setStoredAuth(userData) {
  localStorage.setItem('token', userData.token);
  localStorage.setItem('role', userData.role);
  localStorage.setItem('name', userData.name);
  localStorage.setItem('userId', userData.id);
  
  console.log('✅ Stored auth data:', { 
    role: userData.role, 
    name: userData.name 
  });
}

function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('name');
  localStorage.removeItem('userId');
  console.log('🗑️ Cleared auth data');
}

// Fix 1: Check authentication on page load
function checkAuth() {
  const { token, role, name } = getStoredAuth();
  
  if (token && role && name) {
    console.log('✅ User authenticated, redirecting to dashboard');
    window.location.href = 'dashboard.html';
  } else {
    console.log('❌ User not authenticated, showing login');
    showAuthSection();
  }
}

// Fix 1: Proper section display management
function showAuthSection() {
  authSection.style.display = 'block';
  userSection.style.display = 'none';
}

function showUserSection(role, name) {
  window.location.href = 'dashboard.html';
}

// Register functionality
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      registerMsg.textContent = 'Registration successful!';
      registerMsg.className = 'message';
      registerForm.reset();
      
      // Auto-login after registration
      setStoredAuth(data);
      showUserSection(data.role, data.name);
      loadJobs();
    } else {
      registerMsg.textContent = data.message || 'Registration failed';
      registerMsg.className = 'error';
    }
  } catch (error) {
    console.error('Registration error:', error);
    registerMsg.textContent = 'Network error. Please try again.';
    registerMsg.className = 'error';
  }
});

// Login functionality
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      loginMsg.textContent = 'Login successful!';
      loginMsg.className = 'message';
      loginForm.reset();
      
      // Store auth data and show dashboard
      setStoredAuth(data);
      showUserSection(data.role, data.name);
      loadJobs();
    } else {
      loginMsg.textContent = data.message || 'Login failed';
      loginMsg.className = 'error';
    }
  } catch (error) {
    console.error('Login error:', error);
    loginMsg.textContent = 'Network error. Please try again.';
    loginMsg.className = 'error';
  }
});

// Logout functionality
logoutBtn.addEventListener('click', () => {
  clearStoredAuth();
  showAuthSection();
  jobsList.innerHTML = '';
  postJobMsg.textContent = '';
});

// Post job functionality
postJobForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const { token } = getStoredAuth();
  
  const title = document.getElementById('job-title').value;
  const description = document.getElementById('job-desc').value;
  const location = document.getElementById('job-location').value;
  const payRate = document.getElementById('job-payrate').value;
  
  try {
    const response = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, description, location, payRate })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      postJobMsg.textContent = 'Job posted successfully!';
      postJobMsg.className = 'message';
      postJobForm.reset();
      loadJobs(); // Refresh job list
    } else {
      postJobMsg.textContent = data.message || 'Failed to post job';
      postJobMsg.className = 'error';
    }
  } catch (error) {
    console.error('Post job error:', error);
    postJobMsg.textContent = 'Network error. Please try again.';
    postJobMsg.className = 'error';
  }
});

// Load jobs
async function loadJobs() {
  try {
    const response = await fetch(`${API_BASE}/jobs`);
    const data = await response.json();
    
    // Handle both response formats
    const jobs = data.jobs || data;
    
    jobsList.innerHTML = '';
    
    if (jobs && jobs.length > 0) {
      jobs.forEach(job => {
        const li = document.createElement('li');
        li.innerHTML = `
          <strong>${job.title}</strong><br>
          <em>Location:</em> ${job.location}<br>
          <em>Pay Rate:</em> $${job.payRate}<br>
          <em>Description:</em> ${job.description}<br>
          <em>Employer:</em> ${job.employer?.name || 'Unknown'}<br>
          <em>Applicants:</em> ${job.applicants?.length || 0}<br>
          ${createJobActions(job)}
        `;
        jobsList.appendChild(li);
      });
    } else {
      jobsList.innerHTML = '<li>No jobs available</li>';
    }
  } catch (error) {
    console.error('Load jobs error:', error);
    jobsList.innerHTML = '<li>Error loading jobs</li>';
  }
}

// Create job action buttons based on user role
function createJobActions(job) {
  const { role, token, userId } = getStoredAuth();
  
  if (!token) return '';
  
  if (role === 'worker') {
    const hasApplied = job.applicants && job.applicants.some(applicantId => applicantId === userId);
    if (hasApplied) {
      return `<button class="apply-btn" disabled>Applied</button>`;
    }
    return `<button onclick="applyToJob('${job._id}')" class="apply-btn">Apply</button>`;
  } else if (role === 'employer') {
    let buttons = `<button onclick="viewApplicants('${job._id}', '${job.title}')">View Applicants (${job.applicants?.length || 0})</button>`;
    if (job.employer && job.employer._id === userId) {
      buttons += `
        <button onclick="editJob('${job._id}')" class="edit-btn">Edit</button>
        <button onclick="deleteJob('${job._id}')" class="delete-btn">Delete</button>
      `;
    }
    return buttons;
  }
  
  return '';
}

// Fix 2: Enhanced apply to job function with proper error handling
async function applyToJob(jobId) {
  const { token } = getStoredAuth();
  
  if (!token) {
    alert('Please log in to apply for jobs');
    return;
  }
  
  // Find the button that was clicked for visual feedback
  const button = event.target;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Applying...';
  
  try {
    console.log('🔄 Applying to job:', jobId);
    console.log('🔄 Using token:', token ? 'exists' : 'missing');
    
    const response = await fetch(`${API_BASE}/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log('📝 Apply response status:', response.status);
    console.log('📝 Apply response data:', data);
    
    if (response.ok) {
      // Fix 2: Success confirmation
      alert('✅ Application submitted successfully!');
      button.textContent = 'Applied!';
      button.style.backgroundColor = '#28a745';
      button.style.color = 'white';
      // Keep button disabled to prevent re-application
    } else {
      // Fix 2: Clear error message
      alert(`❌ ${data.message || 'Failed to apply to job'}`);
      button.disabled = false;
      button.textContent = originalText;
    }
  } catch (error) {
    console.error('Apply job error:', error);
    alert('❌ Network error. Please try again.');
    button.disabled = false;
    button.textContent = originalText;
  }
}

// View applicants (for employers)
async function viewApplicants(jobId, jobTitle) {
  const { token } = getStoredAuth();
  
  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/applicants`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      applicantsJobTitle.textContent = jobTitle;
      applicantsList.innerHTML = '';
      
      if (data.length > 0) {
        data.forEach(applicant => {
          const li = document.createElement('li');
          li.innerHTML = `
            <strong>${applicant.name}</strong><br>
            <em>Email:</em> ${applicant.email}<br>
            <em>Role:</em> ${applicant.role}
          `;
          applicantsList.appendChild(li);
        });
      } else {
        applicantsList.innerHTML = '<li>No applicants yet</li>';
      }
      
      applicantsSection.style.display = 'block';
    } else {
      alert(data.message || 'Failed to load applicants');
    }
  } catch (error) {
    console.error('View applicants error:', error);
    alert('Network error. Please try again.');
  }
}

// Close applicants view
closeApplicantsBtn.addEventListener('click', () => {
  applicantsSection.style.display = 'none';
});

// Edit job
function editJob(jobId) {
  const newTitle = prompt("Enter new title:");
  if (newTitle) {
    updateJob(jobId, { title: newTitle });
  }
}

// Delete job
async function deleteJob(jobId) {
  if (confirm("Are you sure you want to delete this job?")) {
    const { token } = getStoredAuth();
    try {
      const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        loadJobs();
      } else {
        alert('Failed to delete job.');
      }
    } catch (error) {
      console.error('Delete job error:', error);
    }
  }
}

async function updateJob(jobId, data) {
  const { token } = getStoredAuth();
  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (response.ok) {
      loadJobs();
    } else {
      alert('Failed to update job.');
    }
  } catch (error) {
    console.error('Update job error:', error);
  }
}

// Theme Toggle Functionality
function initializeTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;
  
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
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// Fix 1: Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 App initialized');
  initializeTheme();
  checkAuth();
});
