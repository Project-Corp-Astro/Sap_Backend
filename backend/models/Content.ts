import mongoose, { Document, Schema, Model } from 'mongoose';
import { ContentDocument } from '../services/content-service/src/interfaces/content.interfaces';
import { AstrologyContentType, ZodiacSign } from '../services/content-service/src/interfaces/astrology.interfaces';

// Simple in-memory content/posts storage for demonstration
interface Post {
  _id: string;
  title: string;
  content: string;
  status?: string;
  contentType?: AstrologyContentType;
  relatedSigns?: ZodiacSign[];
  [key: string]: any;
}

const posts: Post[] = [
  { _id: "1", title: "Welcome", content: "Hello World" }
];

// Default post for initialization
const defaultPost: Post = {
  _id: "",
  title: "Default Title",
  content: "Default Content"
};

/**
 * Get all posts
 * @returns Array of posts
 */
const getAll = (): Post[] => posts;

/**
 * Find a post by ID
 * @param id - Post ID
 * @returns Promise resolving to post or null if not found
 */
const findById = (id: string): Promise<Post | null> => {
  // Mock implementation
  const post = posts.find(post => post._id === id);
  if (!post) return Promise.resolve(null);
  return Promise.resolve(post);
};

/**
 * Create a new post
 * @param post - Post object to create
 * @returns Created post
 */
const create = (post: Omit<Post, '_id'>): Post => {
  // Ensure post has required fields
  if (!post.title || !post.content) {
    throw new Error('Post must have title and content');
  }
  const newPost = { ...post, _id: String(posts.length + 1) } as Post;
  posts.push(newPost);
  return newPost;
};

/**
 * Update a post
 * @param id - Post ID
 * @param updates - Object with fields to update
 * @returns Updated post or null if not found
 */
const update = (id: string, updates: Partial<Post>): Post | null => {
  const index = posts.findIndex(post => post._id === id);
  if (index !== -1) {
    posts[index] = { ...posts[index], ...updates } as Post;
    return posts[index];
  }
  return null;
};

/**
 * Delete a post
 * @param id - Post ID
 * @returns Deleted post or null if not found
 */
const delete_ = (id: string): Post | null => {
  const index = posts.findIndex(post => post._id === id);
  if (index !== -1) {
    return posts.splice(index, 1)[0];
  }
  return null;
};

/**
 * Find posts by query
 * @param query - Query object
 * @returns Promise resolving to array of posts
 */
const find = (query: any): Promise<Post[]> => {
  // Mock implementation
  return Promise.resolve(posts.filter(post => {
    if (query.status && post.status !== query.status) return false;
    if (query['author.id'] && post.author?.id !== query['author.id']) return false;
    return true;
  }));
};

// MongoDB Schema Definitions
interface WorkflowHistory {
  from: string;
  to: string;
  by: mongoose.Types.ObjectId;
  at: Date;
  comment?: string;
}

interface Comment {
  content: string;
  author: mongoose.Types.ObjectId;
  createdAt: Date;
  resolvedAt?: Date;
}

interface ContentModel extends Document {
  title: string;
  body: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'REVISION_REQUIRED' | 'APPROVED' | 'PUBLISHED';
  author: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId[];
  deadlineAt?: Date;
  workflow: {
    history: WorkflowHistory[];
    comments: Comment[];
  };
  createdAt: Date;
  updatedAt: Date;
  canTransitionTo(newState: string, userRole: string): boolean;
}

const workflowHistorySchema = new Schema<WorkflowHistory>({
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
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  at: {
    type: Date,
    default: Date.now
  },
  comment: String
});

const commentSchema = new Schema<Comment>({
  content: {
    type: String,
    required: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date
});

const contentSchema = new Schema<ContentModel>({
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
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: [{
    type: Schema.Types.ObjectId,
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
contentSchema.pre('save', function(this: ContentModel, next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if a state transition is valid
contentSchema.methods.canTransitionTo = function(this: ContentModel, newState: string, userRole: string): boolean {
  const validTransitions: Record<string, { to: string[], roles: string[] }> = {
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

const ContentModel: Model<ContentModel> = mongoose.model<ContentModel>('Content', contentSchema);

// Export both the in-memory mock and the Mongoose model
export {
  getAll,
  findById,
  create,
  update,
  delete_ as delete,
  find,
  ContentModel as default
};
