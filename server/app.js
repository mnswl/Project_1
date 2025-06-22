// app.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

// Load .env file before anything else
dotenv.config();

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import chatRoutes from './routes/chatRoutes.js';

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // In production, specify your frontend domain
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

// Middlewares
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Gig Worker Finder API is running ✅');
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/chat', chatRoutes);

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`✅ User ${socket.userId} connected`);
  
  // Join user to their personal room
  socket.join(`user_${socket.userId}`);
  
  // Handle joining specific chat rooms
  socket.on('join_chat', (otherUserId) => {
    const roomName = [socket.userId, otherUserId].sort().join('_');
    socket.join(roomName);
    console.log(`User ${socket.userId} joined chat room: ${roomName}`);
  });
  
  // Handle leaving chat rooms
  socket.on('leave_chat', (otherUserId) => {
    const roomName = [socket.userId, otherUserId].sort().join('_');
    socket.leave(roomName);
    console.log(`User ${socket.userId} left chat room: ${roomName}`);
  });
  
  // Handle typing indicators
  socket.on('typing', (data) => {
    const roomName = [socket.userId, data.otherUserId].sort().join('_');
    socket.to(roomName).emit('user_typing', {
      userId: socket.userId,
      isTyping: data.isTyping
    });
  });
  
  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User ${socket.userId} disconnected`);
  });
});

// Debug log to check if env variable loaded
console.log("🔍 MONGO_URI from .env:", process.env.MONGO_URI);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.IO server ready`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });