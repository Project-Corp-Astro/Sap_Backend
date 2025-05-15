const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// Get all users (protected route)
router.get('/', authMiddleware, (req, res) => {
  const users = User.getAll();
  res.json(users);
});

// Create new user (protected route)
router.post('/', authMiddleware, (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email and password are required' });
  }
  
  const existingUser = User.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const newUser = User.create({ username, email, password });
  res.status(201).json(newUser);
});

// Update user (protected route)
router.put('/:id', authMiddleware, (req, res) => {
  const { username, email } = req.body;
  const id = req.params.id;
  
  if (!username && !email) {
    return res.status(400).json({ message: 'Username or email is required' });
  }

  const updatedUser = User.update(id, { username, email });
  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  res.json(updatedUser);
});

// Delete user (protected route)
router.delete('/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  
  const deletedUser = User.delete(id);
  if (!deletedUser) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  res.json({ message: 'User deleted successfully', user: deletedUser });
});

module.exports = router;