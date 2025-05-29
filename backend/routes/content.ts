import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

// Define ContentDocument interface locally to avoid import errors
interface ContentDocument {
  _id: string;
  title: string;
  content: string;
  status?: string;
  assignedTo?: string;
  [key: string]: any;
}

const router = express.Router();

// Mock Content model for demonstration
// In a real application, this would be properly imported
const Content = {
  getAll: (): ContentDocument[] => {
    // Mock implementation
    return [];
  },
  create: (contentData: { title: string; content: string }): ContentDocument => {
    // Mock implementation
    return {} as ContentDocument;
  },
  update: (id: string, contentData: { title?: string; content?: string }): ContentDocument | null => {
    // Mock implementation
    return null;
  },
  delete: (id: string): ContentDocument | null => {
    // Mock implementation
    return null;
  }
};

/**
 * Get all posts (protected route)
 */
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const posts = Content.getAll();
  res.json(posts);
});

/**
 * Create new post (protected route)
 */
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { title, content } = req.body;
  if (!title || !content) {
    res.status(400).json({ message: 'Title and content are required' });
    return;
  }

  const newPost = Content.create({ title, content });
  res.status(201).json(newPost);
});

/**
 * Update post (protected route)
 */
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const { title, content } = req.body;
  const id = req.params.id;
  
  if (!title && !content) {
    res.status(400).json({ message: 'Title or content is required' });
    return;
  }

  const updatedPost = Content.update(id, { title, content });
  if (!updatedPost) {
    res.status(404).json({ message: 'Post not found' });
    return;
  }
  
  res.json(updatedPost);
});

/**
 * Delete post (protected route)
 */
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const id = req.params.id;
  
  const deletedPost = Content.delete(id);
  if (!deletedPost) {
    res.status(404).json({ message: 'Post not found' });
    return;
  }
  
  res.json({ message: 'Post deleted successfully', post: deletedPost });
});

export default router;
