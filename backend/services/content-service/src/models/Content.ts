import mongoose, { Schema, model, Document } from 'mongoose';
import { ContentDocument } from '../interfaces/shared-types';
import { ContentStatus } from '@corp-astro/shared-types';

const contentSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  status: {
    type: String,
    enum: Object.values(ContentStatus),
    default: ContentStatus.DRAFT,
  },
  author: {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  featuredImage: {
    type: String,
  },
  seoMetadata: {
    title: String,
    description: String,
    keywords: [String],
  },
  relatedContent: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
  }],
  viewCount: {
    type: Number,
    default: 0,
  },
  publishedAt: {
    type: Date,
  },
  archivedAt: {
    type: Date,
  },
  approvedBy: {
    id: {
      type: String,
    },
    name: {
      type: String,
    },
    approvedAt: {
      type: Date,
    },
  },
  revisionHistory: [{
    modifiedBy: {
      id: {
        type: String,
      },
      name: {
        type: String,
      },
    },
    modifiedAt: {
      type: Date,
    },
    changes: Object,
  }],
  _modifiedBy: {
    id: String,
    name: String,
  },
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  },
});

// Create slug from title before saving
contentSchema.pre('save', function(this: ContentDocument & { _modifiedBy?: { id: string, name: string } }, next) {
  if (this.isNew || this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove non-word chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim();
  }
  next();
});

// Set publishedAt date when status is changed to published
contentSchema.pre('save', function(this: ContentDocument, next) {
  if (this.isModified('status') && this.status === ContentStatus.PUBLISHED && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  if (this.isModified('status') && this.status === ContentStatus.ARCHIVED && !this.archivedAt) {
    this.archivedAt = new Date();
  }

  next();
});

// Add revision history for content changes
contentSchema.pre('save', function(this: ContentDocument & { _modifiedBy?: { id: string, name: string } }, next) {
  const changedFields = this.modifiedPaths().reduce((changes: Record<string, any>, path: string) => {
    if (path !== 'updatedAt' && path !== 'revisionHistory') {
      changes[path] = (this as any)[path];
    }
    return changes;
  }, {});

  if (Object.keys(changedFields).length > 0 && !this.isNew) {
    this.revisionHistory = this.revisionHistory || [];
    this.revisionHistory.push({
      modifiedBy: this._modifiedBy || { id: 'system', name: 'system' },
      modifiedAt: new Date(),
      changes: changedFields,
    });
  }

  next();
});

// Create indexes
contentSchema.index({ title: 'text', description: 'text', 'meta.keywords': 'text' });
contentSchema.index({ slug: 1 }, { unique: true });
contentSchema.index({ 'author.id': 1 });
contentSchema.index({ category: 1 });
contentSchema.index({ status: 1 });
contentSchema.index({ publishedAt: 1 });
contentSchema.index({ 'meta.primaryKeyword': 'text' });

const Content = model<ContentDocument>('Content', contentSchema);

export default Content;
