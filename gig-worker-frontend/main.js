// FIXED main.js - addresses both issues

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
const apiUrl = "http://localhost:5000/api";

// Fix 1: Better role validation and debugging
console.log("🔍 Debug - Token:", token);
console.log("🔍 Debug - Role:", role);

if (!token || !role) {
  console.log("❌ Missing token or role, redirecting to login");
  window.location.href = "index.html";
}

// Fix 1: Add role validation check
if (role !== "employer" && role !== "worker") {
  console.log("❌ Invalid role detected:", role);
  localStorage.clear();
  window.location.href = "index.html";
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

const employerView = document.getElementById("employerView");
const workerView = document.getElementById("workerView");

// Fix 1: More explicit role handling with debugging
if (role === "employer") {
  console.log("✅ Loading employer view");
  employerView.style.display = "block";
  workerView.style.display = "none"; // Explicitly hide worker view
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
        document.getElementById("jobForm").reset(); // Clear form
        loadMyJobs(); // Refresh job list
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
  employerView.style.display = "none"; // Explicitly hide employer view
  loadJobs();
  
  document.getElementById("filterBtn").addEventListener("click", loadJobs);
}

// Fix 1: Add fallback if neither role matches
if (role !== "employer" && role !== "worker") {
  console.log("❌ Unrecognized role, clearing storage");
  localStorage.clear();
  window.location.href = "index.html";
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
    
    // Handle both response formats
    const jobs = data.jobs || data;
    
    if (jobs && jobs.length > 0) {
      jobs.forEach((job) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${job.title}</strong> — ${job.location} — Rs. ${job.payRate}
          <br/>
          <small>Posted by: ${job.employer?.name || 'Unknown'}</small>
          <br/>
          <button onclick="applyToJob('${job._id}')">Apply</button>
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
    // Use the /mine endpoint if you added it, otherwise filter on frontend
    const res = await fetch(`${apiUrl}/jobs`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    const data = await res.json();
    const postedJobs = document.getElementById("postedJobs");
    postedJobs.innerHTML = "";
    
    // Handle both response formats
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

// Fix 2: Enhanced apply function with proper confirmation
async function applyToJob(jobId) {
  // Add visual feedback - disable button temporarily
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
    
    // Fix 2: Proper confirmation handling
    if (res.ok) {
      alert("✅ Application submitted successfully!");
      applyButton.textContent = "Applied!";
      applyButton.style.backgroundColor = "#28a745";
      // Keep button disabled to prevent re-application
    } else {
      alert(`❌ ${data.message || "Error applying to job"}`);
      // Re-enable button on error
      applyButton.disabled = false;
      applyButton.textContent = originalText;
    }
  } catch (err) {
    console.error("Error applying to job:", err);
    alert("❌ Error applying to job. Please try again.");
    // Re-enable button on error
    applyButton.disabled = false;
    applyButton.textContent = originalText;
  }
}