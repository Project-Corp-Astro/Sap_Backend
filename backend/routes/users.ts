import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { UserDocument } from '../shared/interfaces/user.interface';

const router = express.Router();

// Mock User model for demonstration
// In a real application, this would be properly imported
const User = {
  getAll: (): UserDocument[] => {
    // Mock implementation
    return [];
  },
  findByEmail: (email: string): UserDocument | null => {
    // Mock implementation
    return null;
  },
  create: (userData: { username: string; email: string; password: string }): UserDocument => {
    // Mock implementation
    return {} as UserDocument;
  },
  update: (id: string, userData: { username?: string; email?: string }): UserDocument | null => {
    // Mock implementation
    return null;
  },
  delete: (id: string): UserDocument | null => {
    // Mock implementation
    return null;
  }
};

/**
 * Get all users (protected route)
 */
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const users = User.getAll();
  res.json(users);
});

/**
 * Create new user (protected route)
 */
router.post('/', authMiddleware, (req: Request, res: Response): void => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ message: 'Username, email and password are required' });
    return;
  }
  
  const existingUser = User.findByEmail(email);
  if (existingUser) {
    res.status(400).json({ message: 'User already exists' });
    return;
  }

  const newUser = User.create({ username, email, password });
  res.status(201).json(newUser);
});

/**
 * Update user (protected route)
 */
router.put('/:id', authMiddleware, (req: Request, res: Response): void => {
  const { username, email } = req.body;
  const id = req.params.id;
  
  if (!username && !email) {
    res.status(400).json({ message: 'Username or email is required' });
    return;
  }

  const updatedUser = User.update(id, { username, email });
  if (!updatedUser) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  
  res.json(updatedUser);
});

/**
 * Delete user (protected route)
 */
router.delete('/:id', authMiddleware, (req: Request, res: Response): void => {
  const id = req.params.id;
  
  const deletedUser = User.delete(id);
  if (!deletedUser) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  
  res.json({ message: 'User deleted successfully', user: deletedUser });
});

export default router;
