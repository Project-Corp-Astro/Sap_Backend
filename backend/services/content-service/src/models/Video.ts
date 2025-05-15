import mongoose, { Schema } from 'mongoose';
import { VideoDocument, IVideo } from '../interfaces/video.interfaces.js';
// Import slugify directly using ESM import with type assertion
import slugifyPkg from 'slugify';
// Handle both ESM and CommonJS module formats
const slugify = (typeof slugifyPkg === 'function') ? slugifyPkg : (slugifyPkg as any).default;

// Create Video schema
const VideoSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot be more than 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot be more than 5000 characters']
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true
    },
    url: {
      type: String,
      required: [true, 'Video URL is required'],
      trim: true
    },
    thumbnailUrl: {
      type: String,
      trim: true
    },
    duration: {
      type: Number,
      min: [0, 'Duration cannot be negative']
    },
    fileSize: {
      type: Number,
      min: [0, 'File size cannot be negative']
    },
    resolution: {
      width: {
        type: Number,
        min: [0, 'Width cannot be negative']
      },
      height: {
        type: Number,
        min: [0, 'Height cannot be negative']
      }
    },
    format: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      trim: true,
      default: 'Uncategorized'
    },
    tags: [{
      type: String,
      trim: true
    }],
    author: {
      id: {
        type: String,
        required: [true, 'Author ID is required']
      },
      name: {
        type: String,
        required: [true, 'Author name is required']
      },
      email: {
        type: String,
        trim: true,
        lowercase: true
      }
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived', 'pending_review', 'rejected'],
        message: '{VALUE} is not a valid status'
      },
      default: 'draft'
    },
    publishedAt: {
      type: Date
    },
    viewCount: {
      type: Number,
      default: 0,
      min: [0, 'View count cannot be negative']
    },
    likeCount: {
      type: Number,
      default: 0,
      min: [0, 'Like count cannot be negative']
    },
    dislikeCount: {
      type: Number,
      default: 0,
      min: [0, 'Dislike count cannot be negative']
    },
    commentCount: {
      type: Number,
      default: 0,
      min: [0, 'Comment count cannot be negative']
    },
    shareCount: {
      type: Number,
      default: 0,
      min: [0, 'Share count cannot be negative']
    },
    videoProvider: {
      type: String,
      enum: {
        values: ['youtube', 'vimeo', 'internal', 'other'],
        message: '{VALUE} is not a valid video provider'
      },
      default: 'internal'
    },
    videoId: {
      type: String,
      trim: true
    },
    transcript: {
      type: String,
      trim: true
    },
    captions: [{
      language: {
        type: String,
        required: true,
        trim: true
      },
      url: {
        type: String,
        required: true,
        trim: true
      }
    }],
    isPrivate: {
      type: Boolean,
      default: false
    },
    isDownloadable: {
      type: Boolean,
      default: false
    },
    isEmbeddable: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Create slug from title before saving
VideoSchema.pre<VideoDocument>('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title.toString(), { lower: true, strict: true });
  }
  
  // If status is changed to published and publishedAt is not set, set it
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Create Video model
const Video = mongoose.model<VideoDocument>('Video', VideoSchema);

export default Video;
