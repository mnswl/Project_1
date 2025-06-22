import express from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import { protect as authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all conversations for a user
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all unique conversations this user is part of
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', userId] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'otherUser'
        }
      },
      {
        $unwind: '$otherUser'
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          unreadCount: 1,
          otherUser: {
            _id: '$otherUser._id',
            name: '$otherUser.name',
            email: '$otherUser.email',
            role: '$otherUser.role'
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages between two users
router.get('/messages/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = req.params.otherUserId;

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId }
      ]
    })
    .populate('sender', 'name email role')
    .populate('receiver', 'name email role')
    .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      {
        sender: otherUserId,
        receiver: userId,
        isRead: false
      },
      { isRead: true }
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, jobId } = req.body;
    const senderId = req.user.id;

    // Validate receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Create new message
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      jobId: jobId || null,
      isRead: false
    });

    await message.save();

    // Populate sender and receiver info
    await message.populate('sender', 'name email role');
    await message.populate('receiver', 'name email role');

    // Emit to both users via Socket.IO (if connected)
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiverId}`).emit('new_message', message);
      io.to(`user_${senderId}`).emit('message_sent', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start a conversation (typically when applying for a job)
router.post('/start-conversation', authMiddleware, async (req, res) => {
  try {
    const { employerId, jobId, initialMessage } = req.body;
    const workerId = req.user.id;

    // Check if job exists and get employer info
    const job = await Job.findById(jobId).populate('employer', 'name email');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Verify the employer ID matches the job's employer
    if (job.employer._id.toString() !== employerId) {
      return res.status(400).json({ message: 'Invalid employer for this job' });
    }

    // Create initial message
    const message = new Message({
      sender: workerId,
      receiver: employerId,
      content: initialMessage || `Hi! I'm interested in your job posting: ${job.title}`,
      jobId: jobId,
      isRead: false
    });

    await message.save();
    await message.populate('sender', 'name email role');
    await message.populate('receiver', 'name email role');

    // Emit to employer via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${employerId}`).emit('new_message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.patch('/mark-read/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = req.params.otherUserId;

    await Message.updateMany(
      {
        sender: otherUserId,
        receiver: userId,
        isRead: false
      },
      { isRead: true }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread message count
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const unreadCount = await Message.countDocuments({
      receiver: userId,
      isRead: false
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;