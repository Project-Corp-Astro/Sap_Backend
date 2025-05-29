const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const authMiddleware = require('../middleware/authMiddleware');

// Get all posts (protected route)
router.get('/', authMiddleware, (req, res) => {
  const posts = Content.getAll();
  res.json(posts);
});

// Create new post (protected route)
router.post('/', authMiddleware, (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required' });
  }

  const newPost = Content.create({ title, content });
  res.status(201).json(newPost);
});

// Update post (protected route)
router.put('/:id', authMiddleware, (req, res) => {
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

// Delete post (protected route)
router.delete('/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  
  const deletedPost = Content.delete(id);
  if (!deletedPost) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  res.json({ message: 'Post deleted successfully', post: deletedPost });
});

// Get content queue for review
router.get('/queue', authMiddleware, async (req, res) => {
  try {
    const queue = await Content.find({ 
      status: 'PENDING_REVIEW',
      assignedTo: req.user._id 
    })
    .populate('author', 'name email')
    .populate('assignedTo', 'name email')
    .sort('-updatedAt');
    
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit content for review
router.post('/:id/submit', authMiddleware, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.canTransitionTo('PENDING_REVIEW', req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized to submit content for review' });
    }

    content.status = 'PENDING_REVIEW';
    content.workflow.history.push({
      from: 'DRAFT',
      to: 'PENDING_REVIEW',
      by: req.user._id,
      comment: req.body.comment
    });

    if (req.body.assignTo) {
      content.assignedTo = req.body.assignTo;
    }

    if (req.body.deadline) {
      content.deadlineAt = new Date(req.body.deadline);
    }

    await content.save();
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve content
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.canTransitionTo('APPROVED', req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized to approve content' });
    }

    content.status = 'APPROVED';
    content.workflow.history.push({
      from: content.status,
      to: 'APPROVED',
      by: req.user._id,
      comment: req.body.comment
    });

    await content.save();
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request changes
router.post('/:id/request-changes', authMiddleware, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.canTransitionTo('REVISION_REQUIRED', req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized to request changes' });
    }

    if (!req.body.comment) {
      return res.status(400).json({ error: 'Comment required when requesting changes' });
    }

    content.status = 'REVISION_REQUIRED';
    content.workflow.history.push({
      from: content.status,
      to: 'REVISION_REQUIRED',
      by: req.user._id,
      comment: req.body.comment
    });

    content.workflow.comments.push({
      content: req.body.comment,
      author: req.user._id
    });

    await content.save();
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment to content
router.post('/:id/comment', authMiddleware, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    content.workflow.comments.push({
      content: req.body.comment,
      author: req.user._id
    });

    await content.save();
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark comment as resolved
router.post('/:id/comment/:commentId/resolve', authMiddleware, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Publish approved content
router.post('/:id/publish', authMiddleware, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.canTransitionTo('PUBLISHED', req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized to publish content' });
    }

    content.status = 'PUBLISHED';
    content.workflow.history.push({
      from: content.status,
      to: 'PUBLISHED',
      by: req.user._id,
      comment: req.body.comment
    });

    await content.save();
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get content workflow history
router.get('/:id/history', authMiddleware, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id)
      .populate('workflow.history.by', 'name email')
      .populate('workflow.comments.author', 'name email');
      
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({
      history: content.workflow.history,
      comments: content.workflow.comments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;