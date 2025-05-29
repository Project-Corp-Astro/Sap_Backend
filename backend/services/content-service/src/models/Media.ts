import mongoose, { Schema, model } from 'mongoose';
import { MediaDocument, MediaType, VideoProvider } from '../interfaces/media.interfaces';
import { ContentStatus } from '../interfaces/content.interfaces';

const mediaSchema = new Schema({
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
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  type: {
    type: String,
    enum: Object.values(MediaType),
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
  },
  mimeType: {
    type: String,
  },
  dimensions: {
    width: Number,
    height: Number,
    duration: Number, // For videos/audio (in seconds)
  },
  thumbnailUrl: {
    type: String,
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
  status: {
    type: String,
    enum: Object.values(ContentStatus),
    default: ContentStatus.DRAFT,
  },
  publishedAt: {
    type: Date,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // For videos
  videoProvider: {
    type: String,
    enum: Object.values(VideoProvider),
  },
  videoId: {
    type: String, // YouTube/Vimeo ID if applicable
  },
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
mediaSchema.pre('save', function(this: MediaDocument & { _modifiedBy?: { id: string, name: string } }, next) {
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
mediaSchema.pre('save', function(this: MediaDocument, next) {
  if (this.isModified('status') && this.status === ContentStatus.PUBLISHED && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// Create indexes
mediaSchema.index({ title: 'text', description: 'text' });
mediaSchema.index({ slug: 1 }, { unique: true });
mediaSchema.index({ 'author.id': 1 });
mediaSchema.index({ category: 1 });
mediaSchema.index({ type: 1 });
mediaSchema.index({ status: 1 });
mediaSchema.index({ publishedAt: 1 });
mediaSchema.index({ tags: 1 });

const Media = model<MediaDocument>('Media', mediaSchema);

export default Media;
