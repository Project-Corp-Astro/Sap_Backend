const mongoose = require('mongoose');

// Simple in-memory content/posts storage for demonstration
const posts = [
  { _id: "1", title: "Welcome", content: "Hello World" }
];

module.exports = {
  getAll: () => posts,
  findById: (id) => posts.find(post => post._id === id),
  create: (post) => {
    const newPost = { ...post, _id: String(posts.length + 1) };
    posts.push(newPost);
    return newPost;
  },
  update: (id, updates) => {
    const index = posts.findIndex(post => post._id === id);
    if (index !== -1) {
      posts[index] = { ...posts[index], ...updates };
      return posts[index];
    }
    return null;
  },
  delete: (id) => {
    const index = posts.findIndex(post => post._id === id);
    if (index !== -1) {
      return posts.splice(index, 1)[0];
    }
    return null;
  }
};

const workflowHistorySchema = new mongoose.Schema({
  from: {
    type: String,
    enum: ['DRAFT', 'PENDING_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'PUBLISHED'],
    required: true
  },
  to: {
    type: String,
    enum: ['DRAFT', 'PENDING_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'PUBLISHED'],
    required: true
  },
  by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  at: {
    type: Date,
    default: Date.now
  },
  comment: String
});

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date
});

const contentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'PUBLISHED'],
    default: 'DRAFT'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  deadlineAt: Date,
  workflow: {
    history: [workflowHistorySchema],
    comments: [commentSchema]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to update the updatedAt timestamp
contentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if a state transition is valid
contentSchema.methods.canTransitionTo = function(newState, userRole) {
  const validTransitions = {
    DRAFT: {
      to: ['PENDING_REVIEW'],
      roles: ['CONTENT_MANAGER', 'EDITOR', 'ADMIN']
    },
    PENDING_REVIEW: {
      to: ['REVISION_REQUIRED', 'APPROVED'],
      roles: ['EDITOR', 'ADMIN']
    },
    REVISION_REQUIRED: {
      to: ['DRAFT'],
      roles: ['CONTENT_MANAGER', 'EDITOR', 'ADMIN']
    },
    APPROVED: {
      to: ['PUBLISHED'],
      roles: ['CONTENT_MANAGER', 'EDITOR', 'ADMIN']
    }
  };

  const currentStateTransitions = validTransitions[this.status];
  if (!currentStateTransitions) return false;

  return currentStateTransitions.to.includes(newState) && 
         currentStateTransitions.roles.includes(userRole);
};

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;