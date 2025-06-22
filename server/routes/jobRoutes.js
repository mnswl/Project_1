// server/routes/jobRoutes.js
import express from 'express';
import Job from '../models/Job.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Create a new job (only for authenticated users)
// @route   POST /api/jobs
// @access  Private
// Create job - requires auth and employer role
router.post('/', protect, async (req, res) => {
  if (req.user.role !== 'employer') {
    return res.status(403).json({ message: 'Only employers can create jobs' });
  }
  const { title, description, location, payRate } = req.body;
  if (!title || !description || !location || !payRate) {
    return res.status(400).json({ message: 'Please fill all fields' });
  }
  try {
    const job = new Job({
      title,
      description,
      location,
      payRate,
      employer: req.user._id,
    });
    const createdJob = await job.save();
    res.status(201).json(createdJob);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @desc    Get all jobs (public)
// @route   GET /api/jobs
// @access  Public
// @desc    Get jobs posted by the current employer
// @route   GET /api/jobs/mine
// @access  Private
// Get all jobs - public access
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find().populate('employer', 'name email');
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


// @desc    Apply to a job
// @route   POST /api/jobs/:id/apply
// @access  Private
router.post('/:id/apply', protect, async (req, res) => {
  try {
    const jobId = req.params.id;
    console.log("➡️ Applying to job ID:", jobId);
    console.log("➡️ Logged in user ID:", req.user._id);

    const job = await Job.findById(jobId);

    if (!job) {
      console.log("❌ Job not found");
      return res.status(404).json({ message: 'Job not found' });
    }

    const alreadyApplied = job.applicants.some(
      (applicantId) => applicantId.toString() === req.user._id.toString()
    );

    if (alreadyApplied) {
      console.log("⚠️ Already applied");
      return res.status(400).json({ message: 'You already applied to this job' });
    }

    job.applicants.push(req.user._id);
    await job.save();

    console.log("✅ Application successful");
    res.status(200).json({ message: 'Application submitted successfully' });
  } catch (err) {
    console.error("💥 Error during application:", err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @desc    View applicants (employer only)
// @route   GET /api/jobs/:id/applicants
// @access  Private
router.get('/:id/applicants', protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('applicants', 'name email role');

    if (!job) return res.status(404).json({ message: 'Job not found' });

    if (job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(job.applicants);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
