// routes/userRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/profile', protect, (req, res) => {
  res.json(req.user); // Send user info without password
});

// Admin: Get all users
router.get('/admin/users', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const users = await User.find().select('-password');
  res.json(users);
});

// Admin: Block/unblock user
router.patch('/admin/users/:id/block', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.isBlocked = !user.isBlocked;
  await user.save();
  res.json({ message: user.isBlocked ? 'User blocked' : 'User unblocked' });
});

// Admin: Delete user
router.delete('/admin/users/:id', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'User deleted' });
});

// Admin: Change user role
router.patch('/admin/users/:id/role', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const { role } = req.body;
  if (!['worker', 'employer', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.role = role;
  await user.save();
  res.json({ message: 'User role updated' });
});

export default router;
