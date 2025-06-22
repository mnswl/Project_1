// routes/userRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/profile', protect, (req, res) => {
  res.json(req.user); // Send user info without password
});

export default router;
