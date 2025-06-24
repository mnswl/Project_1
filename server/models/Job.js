import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  payRate: { type: Number, required: true },
  jobType: { type: String, required: true },
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  applicants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  applications: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    appliedAt: { type: Date, default: Date.now }
  }],
  bookmarkedApplicants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isFlagged: { type: Boolean, default: false },
  flaggedReason: { type: String, default: '' },
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

export default Job;
