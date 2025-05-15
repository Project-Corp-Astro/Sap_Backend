import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { ContentDocument } from '../services/content-service/src/interfaces/content.interfaces';
import { AstrologyContentType, ZodiacSign } from '../services/content-service/src/interfaces/astrology.interfaces';

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
  },
  find: (query: any): Promise<ContentDocument[]> => {
    // Mock implementation
    return Promise.resolve([]);
  },
  findById: (id: string): Promise<ContentDocument | null> => {
    // Mock implementation
    return Promise.resolve(null);
  }
};

// Extend Express Request type to include user property
interface WorkflowHistory {
  from: string;
  to: string;
  by: string;
  comment?: string;
  timestamp?: Date;
}

interface WorkflowComment {
  content: string;
  author: string;
  createdAt?: Date;
  resolvedAt?: Date;
}

interface ContentWithWorkflow extends ContentDocument {
  workflow: {
    history: WorkflowHistory[];
    comments: (WorkflowComment & { id: (commentId: string) => WorkflowComment })[];
  };
  canTransitionTo: (status: string, role: string) => boolean;
}

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
    return res.status(400).json({ message: 'Title and content are required' });
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
    return res.status(400).json({ message: 'Title or content is required' });
  }

  const updatedPost = Content.update(id, { title, content });
  if (!updatedPost) {
    return res.status(404).json({ message: 'Post not found' });
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
    return res.status(404).json({ message: 'Post not found' });
  }
  
  res.json({ message: 'Post deleted successfully', post: deletedPost });
});

/**
 * Get content queue for review
 */
router.get('/queue', authMiddleware, async (req: Request, res: Response) => {
  try {
    const queue = await Content.find({ 
      status: 'PENDING_REVIEW',
      assignedTo: req.user?._id 
    });
    
    res.json(queue);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Submit content for review
 */
router.post('/:id/submit', authMiddleware, async (req: Request, res: Response) => {
  try {
    const content = await Content.findById(req.params.id) as ContentWithWorkflow | null;
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.canTransitionTo('PENDING_REVIEW', req.user?.role || '')) {
      return res.status(403).json({ error: 'Unauthorized to submit content for review' });
    }

    content.status = 'PENDING_REVIEW' as any;
    content.workflow.history.push({
      from: 'DRAFT',
      to: 'PENDING_REVIEW',
      by: req.user?._id || '',
      comment: req.body.comment
    });

    if (req.body.assignTo) {
      (content as any).assignedTo = req.body.assignTo;
    }

    if (req.body.deadline) {
      (content as any).deadlineAt = new Date(req.body.deadline);
    }

    await content.save();
    res.json(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Approve content
 */
router.post('/:id/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const content = await Content.findById(req.params.id) as ContentWithWorkflow | null;
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.canTransitionTo('APPROVED', req.user?.role || '')) {
      return res.status(403).json({ error: 'Unauthorized to approve content' });
    }

    content.status = 'APPROVED' as any;
    content.workflow.history.push({
      from: content.status,
      to: 'APPROVED',
      by: req.user?._id || '',
      comment: req.body.comment
    });

    await content.save();
    res.json(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Request changes
 */
router.post('/:id/request-changes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const content = await Content.findById(req.params.id) as ContentWithWorkflow | null;
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.canTransitionTo('REVISION_REQUIRED', req.user?.role || '')) {
      return res.status(403).json({ error: 'Unauthorized to request changes' });
    }

    if (!req.body.comment) {
      return res.status(400).json({ error: 'Comment required when requesting changes' });
    }

    content.status = 'REVISION_REQUIRED' as any;
    content.workflow.history.push({
      from: content.status,
      to: 'REVISION_REQUIRED',
      by: req.user?._id || '',
      comment: req.body.comment
    });

    content.workflow.comments.push({
      content: req.body.comment,
      author: req.user?._id || ''
    });

    await content.save();
    res.json(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Add comment to content
 */
router.post('/:id/comment', authMiddleware, async (req: Request, res: Response) => {
  try {
    const content = await Content.findById(req.params.id) as ContentWithWorkflow | null;
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    content.workflow.comments.push({
      content: req.body.comment,
      author: req.user?._id || ''
    });

    await content.save();
    res.json(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Mark comment as resolved
 */
router.post('/:id/comment/:commentId/resolve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const content = await Content.findById(req.params.id) as ContentWithWorkflow | null;
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const comment = content.workflow.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    comment.resolvedAt = new Date();
    await content.save();
    res.json(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Publish approved content
 */
router.post('/:id/publish', authMiddleware, async (req: Request, res: Response) => {
  try {
    const content = await Content.findById(req.params.id) as ContentWithWorkflow | null;
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.canTransitionTo('PUBLISHED', req.user?.role || '')) {
      return res.status(403).json({ error: 'Unauthorized to publish content' });
    }

    content.status = 'PUBLISHED' as any;
    content.workflow.history.push({
      from: content.status,
      to: 'PUBLISHED',
      by: req.user?._id || '',
      comment: req.body.comment
    });

    await content.save();
    res.json(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get content workflow history
 */
router.get('/:id/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const content = await Content.findById(req.params.id) as ContentWithWorkflow | null;
      
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({
      history: content.workflow.history,
      comments: content.workflow.comments
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
