import mongoose, { Schema, model, Document } from 'mongoose';

/**
 * User role enum
 */
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  AUTHOR = 'author',
  VIEWER = 'viewer'
}

/**
 * Theme enum
 */
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

/**
 * Social links interface
 */
export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
  website?: string;
}

/**
 * Notification preferences interface
 */
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
}

/**
 * User preferences interface
 */
export interface UserPreferences {
  notifications: NotificationPreferences;
  theme: Theme;
  language: string;
}

/**
 * User stats interface
 */
export interface UserStats {
  contentCount: number;
  followers: number;
  following: number;
}

/**
 * User metadata interface
 */
export interface UserMetadata {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User interface
 */
export interface IUser {
  username: string;
  email: string;
  displayName?: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  socialLinks?: SocialLinks;
  preferences: UserPreferences;
  stats: UserStats;
  isActive: boolean;
  lastLogin?: Date;
  metadata: UserMetadata;
}

/**
 * User document interface
 */
export interface UserDocument extends IUser, Document {
  getFullName(): string;
  url: string;
}

/**
 * User model interface
 */
export interface UserModel extends mongoose.Model<UserDocument> {
  findActive(): Promise<UserDocument[]>;
}

// Prevent model from being redefined if already exists
let User: UserModel;

if (mongoose.models.User) {
  User = mongoose.model<UserDocument, UserModel>('User');
} else {
  const userSchema = new Schema<UserDocument, UserModel>({
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.VIEWER,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
    },
    socialLinks: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String,
      website: String,
    },
    preferences: {
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: true,
        },
      },
      theme: {
        type: String,
        enum: Object.values(Theme),
        default: Theme.SYSTEM,
      },
      language: {
        type: String,
        default: 'en',
      },
    },
    stats: {
      contentCount: {
        type: Number,
        default: 0,
      },
      followers: {
        type: Number,
        default: 0,
      },
      following: {
        type: Number,
        default: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    metadata: {
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  }, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  });

  // Indexes for better query performance
  userSchema.index({ username: 1 }, { unique: true });
  userSchema.index({ email: 1 }, { unique: true });
  userSchema.index({ role: 1 });
  userSchema.index({ 'metadata.createdAt': -1 });

  // Virtual for user's full URL
  userSchema.virtual('url').get(function(this: UserDocument): string {
    return `/users/${this.username}`;
  });

  // Pre-save hook to update timestamps
  userSchema.pre('save', function(this: UserDocument, next) {
    this.metadata.updatedAt = new Date();
    next();
  });

  // Method to get user's full name
  userSchema.methods.getFullName = function(this: UserDocument): string {
    return this.displayName || this.username;
  };

  // Static method to find active users
  userSchema.statics.findActive = function(this: UserModel): Promise<UserDocument[]> {
    return this.find({ isActive: true });
  };

  User = model<UserDocument, UserModel>('User', userSchema);
}

export default User;
