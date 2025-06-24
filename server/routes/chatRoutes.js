import express from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import { protect as authMiddleware } from '../middleware/authMiddleware.js';
import cors from 'cors';

const router = express.Router();

// CORS configuration for chat routes
const chatCors = cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false // Disable credentials for null origin
});

// Apply CORS to all chat routes
router.use(chatCors);

// Pre-flight OPTIONS request handler
router.options('*', chatCors);

// Get all conversations for a user
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🔍 Fetching conversations for user:', userId);
    
    // First check if user exists
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Find all messages for this user
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    }).sort({ createdAt: -1 });

    console.log('📨 Found messages:', messages.length);

    if (messages.length === 0) {
      console.log('ℹ️ No messages found for user');
      return res.json([]);
    }

    // Get unique conversation partners
    const conversationPartners = new Set();
    messages.forEach(msg => {
      if (msg.sender.toString() === userId) {
        conversationPartners.add(msg.receiver.toString());
      } else {
        conversationPartners.add(msg.sender.toString());
      }
    });

    // Get conversation details
    const conversations = await Promise.all(
      Array.from(conversationPartners).map(async partnerId => {
        const partner = await User.findById(partnerId);
        if (!partner) return null;

        const lastMessage = messages.find(msg => 
          msg.sender.toString() === partnerId || 
          msg.receiver.toString() === partnerId
        );

        const unreadCount = messages.filter(msg => 
          msg.receiver.toString() === userId &&
          msg.sender.toString() === partnerId &&
          !msg.isRead
        ).length;

        return {
          _id: partnerId,
          otherUser: {
            _id: partner._id,
            name: partner.name,
            email: partner.email,
            role: partner.role
          },
          lastMessage,
          unreadCount
        };
      })
    );

    // Filter out null values and sort by last message date
    const validConversations = conversations
      .filter(c => c !== null)
      .sort((a, b) => 
        new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
      );

    console.log('✅ Found conversations:', validConversations.length);
    res.json(validConversations);
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
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

// Mark messages as read (using POST instead of PATCH for better compatibility)
router.post('/mark-read/:otherUserId', authMiddleware, async (req, res) => {
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

// Send a message
router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { receiver, content } = req.body;
    const sender = req.user.id;

    if (!content || !receiver) {
      return res.status(400).json({ message: 'Message content and receiver are required' });
    }

    const message = new Message({
      sender,
      receiver,
      content,
      isRead: false
    });

    await message.save();
    await message.populate('sender', 'name email role');
    await message.populate('receiver', 'name email role');

    // Emit to receiver via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiver}`).emit('new_message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;