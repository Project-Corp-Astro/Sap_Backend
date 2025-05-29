import mongoose, { Schema, Document } from 'mongoose';
import { AstrologyContentType, ZodiacSign } from '../../services/content-service/src/interfaces/astrology.interfaces';

// Define interfaces for MongoDB Content model
export interface ContentDocument extends Document {
  title: string;
  body: string;
  slug: string;
  summary?: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'REVISION_REQUIRED' | 'APPROVED' | 'PUBLISHED';
  author: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId[];
  deadlineAt?: Date;
  tags?: string[];
  categories?: string[];
  contentType?: AstrologyContentType;
  relatedSigns?: ZodiacSign[];
  featuredImage?: string;
  publishedAt?: Date;
  workflow: {
    history: WorkflowHistory[];
    comments: Comment[];
  };
  createdAt: Date;
  updatedAt: Date;
  canTransitionTo(newState: string, userRole: string): boolean;
}

// Define interfaces for sub-documents
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

// Define schemas for sub-documents
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
}, { _id: false });

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
}, { _id: false });

// Define the main Content schema
const contentSchema = new Schema<ContentDocument>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  summary: {
    type: String,
    trim: true
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
  tags: [String],
  categories: [String],
  contentType: {
    type: String,
    enum: Object.values(AstrologyContentType)
  },
  relatedSigns: [{
    type: String,
    enum: Object.values(ZodiacSign)
  }],
  featuredImage: String,
  publishedAt: Date,
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
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  versionKey: false // Don't include __v field
});

// Create indexes (excluding text index which is not supported in API strict mode)
contentSchema.index({ slug: 1 }, { unique: true });
contentSchema.index({ status: 1 });
contentSchema.index({ author: 1 });
contentSchema.index({ contentType: 1 });
contentSchema.index({ relatedSigns: 1 });
contentSchema.index({ publishedAt: -1 });

// Note: Text indexes are not supported in MongoDB API strict mode
// If text search is needed, we'll need to disable API strict mode or use alternative search methods

// Middleware to update the updatedAt timestamp
contentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if a state transition is valid
contentSchema.methods.canTransitionTo = function(newState: string, userRole: string): boolean {
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

// Create and export the model
const ContentModel = mongoose.model<ContentDocument>('Content', contentSchema);

export default ContentModel;
