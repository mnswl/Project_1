import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role }, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role }, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
