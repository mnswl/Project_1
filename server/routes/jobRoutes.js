// server/routes/jobRoutes.js
import express from 'express';
import Job from '../models/Job.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Create a new job (only for authenticated users)
// @route   POST /api/jobs
// @access  Private
// Create job - requires auth and employer or admin role
router.post('/', protect, async (req, res) => {
  if (req.user.role !== 'employer' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only employers or admins can create jobs' });
  }
  const { title, description, location, payRate, jobType } = req.body;
  if (!title || !description || !location || !payRate || !jobType) {
    return res.status(400).json({ message: 'Please fill all fields' });
  }
  try {
    const job = new Job({
      title,
      description,
      location,
      payRate,
      jobType,
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
    const { location, minPay, maxPay, jobType, keyword } = req.query;
    const filter = {};
    if (location) filter.location = new RegExp(location, 'i');
    if (jobType) filter.jobType = jobType;
    if (minPay || maxPay) filter.payRate = {};
    if (minPay) filter.payRate.$gte = Number(minPay);
    if (maxPay) filter.payRate.$lte = Number(maxPay);
    if (keyword) {
      filter.$or = [
        { title: new RegExp(keyword, 'i') },
        { description: new RegExp(keyword, 'i') }
      ];
    }
    const jobs = await Job.find(filter).populate('employer', 'name email');
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get jobs posted by the current employer
router.get('/mine', protect, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'employer') {
      filter = { employer: req.user._id };
    } else if (req.user.role === 'admin') {
      // Admin can see all jobs
      filter = {};
    } else {
      return res.status(403).json({ message: 'Only employers or admins can view their posted jobs' });
    }
    const jobs = await Job.find(filter).populate('employer', 'name email');
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Apply to a job (updated to use applications array)
// @route   POST /api/jobs/:id/apply
// @access  Private
router.post('/:id/apply', protect, async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    // Check if already applied
    const alreadyApplied = job.applications.some(app => app.user.toString() === req.user._id.toString());
    if (alreadyApplied) return res.status(400).json({ message: 'You already applied to this job' });
    job.applicants.push(req.user._id);
    job.applications.push({ user: req.user._id });
    await job.save();
    res.status(200).json({ message: 'Application submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @desc    View applicants (employer only)
// @route   GET /api/jobs/:id/applicants
// @access  Private
router.get('/:id/applicants', protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('applications.user', 'name email role');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.employer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Map applications to include isBookmarked status
    const applicants = job.applications.map(app => ({
      _id: app.user._id,
      name: app.user.name,
      email: app.user.email,
      role: app.user.role,
      status: app.status,
      isBookmarked: app.isBookmarked || false
    }));

    res.json(applicants);
  } catch (error) {
    console.error('Error getting applicants:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Update a job
// @route   PUT /api/jobs/:id
// @access  Private (Employer only)
router.put('/:id', protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Allow if user is admin or the employer who posted the job
    if (job.employer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const { title, description, location, payRate } = req.body;

    job.title = title || job.title;
    job.description = description || job.description;
    job.location = location || job.location;
    job.payRate = payRate || job.payRate;

    const updatedJob = await job.save();
    res.json(updatedJob);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Delete a job
// @route   DELETE /api/jobs/:id
// @access  Private (Employer only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Allow if user is admin or the employer who posted the job
    if (job.employer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await job.deleteOne();
    res.json({ message: 'Job removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add job to favorites
router.post('/:id/favorite', protect, async (req, res) => {
  try {
    const jobId = req.params.id;
    const user = req.user;
    if (!user.favorites) user.favorites = [];
    if (user.favorites.includes(jobId)) {
      return res.status(400).json({ message: 'Job already in favorites' });
    }
    user.favorites.push(jobId);
    await user.save();
    res.status(200).json({ message: 'Job added to favorites' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove job from favorites
router.delete('/:id/favorite', protect, async (req, res) => {
  try {
    const jobId = req.params.id;
    const user = req.user;
    user.favorites = user.favorites.filter(favId => favId.toString() !== jobId);
    await user.save();
    res.status(200).json({ message: 'Job removed from favorites' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's favorite jobs
router.get('/favorites', protect, async (req, res) => {
  try {
    await req.user.populate({ path: 'favorites', populate: { path: 'employer', select: 'name email' } });
    res.status(200).json({ jobs: req.user.favorites });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get applications for a worker
router.get('/my-applications', protect, async (req, res) => {
  try {
    const jobs = await Job.find({ 'applications.user': req.user._id })
      .select('title location payRate jobType applications')
      .lean();
    // Filter to only include the current user's application status
    const applications = jobs.map(job => {
      const app = job.applications.find(a => a.user.toString() === req.user._id.toString());
      return {
        jobId: job._id,
        title: job.title,
        location: job.location,
        payRate: job.payRate,
        jobType: job.jobType,
        status: app.status,
        appliedAt: app.appliedAt
      };
    });
    res.json({ applications });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Employer updates application status
router.put('/:jobId/applications/:userId/status', protect, async (req, res) => {
  try {
    const { jobId, userId } = req.params;
    const { status } = req.body; // 'pending', 'accepted', 'rejected'
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const app = job.applications.find(a => a.user.toString() === userId);
    if (!app) return res.status(404).json({ message: 'Application not found' });
    app.status = status;
    await job.save();
    res.json({ message: 'Application status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get bookmarked applicants for a job
router.get('/:jobId/bookmarked-applicants', protect, async (req, res) => {
  try {
    const { jobId } = req.params;
    const employerId = req.user._id;

    // Check if job exists and employer owns it
    const job = await Job.findOne({ _id: jobId, employer: employerId })
      .populate('applications.user', 'name email role');

    if (!job) {
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }

    // Get bookmarked applicants
    const bookmarkedApplicants = job.applications
      .filter(app => app.isBookmarked)
      .map(app => ({
        _id: app.user._id,
        name: app.user.name,
        email: app.user.email,
        role: app.user.role
      }));

    res.json({ bookmarkedApplicants });
  } catch (error) {
    console.error('Error getting bookmarked applicants:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bookmark an applicant
router.post('/:jobId/applications/:userId/bookmark', protect, async (req, res) => {
  try {
    const { jobId, userId } = req.params;
    const employerId = req.user._id;

    // Check if job exists and employer owns it
    const job = await Job.findOne({ _id: jobId, employer: employerId });
    if (!job) {
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }

    // Find the application
    const application = job.applications.find(app => app.user.toString() === userId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Add bookmark if not already bookmarked
    if (!application.isBookmarked) {
      application.isBookmarked = true;
      await job.save();
      res.json({ message: 'Applicant bookmarked successfully' });
    } else {
      res.status(400).json({ message: 'Applicant already bookmarked' });
    }
  } catch (error) {
    console.error('Error bookmarking applicant:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove bookmark from an applicant
router.delete('/:jobId/applications/:userId/bookmark', protect, async (req, res) => {
  try {
    const { jobId, userId } = req.params;
    const employerId = req.user._id;

    // Check if job exists and employer owns it
    const job = await Job.findOne({ _id: jobId, employer: employerId });
    if (!job) {
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }

    // Find the application
    const application = job.applications.find(app => app.user.toString() === userId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Remove bookmark if bookmarked
    if (application.isBookmarked) {
      application.isBookmarked = false;
      await job.save();
      res.json({ message: 'Bookmark removed successfully' });
    } else {
      res.status(400).json({ message: 'Applicant not bookmarked' });
    }
  } catch (error) {
    console.error('Error removing bookmark:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get job details by ID
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('bookmarkedApplicants', 'name email role');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
