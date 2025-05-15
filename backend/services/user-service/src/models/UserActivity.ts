import mongoose, { Schema, model } from 'mongoose';
import { Document } from 'mongoose';

/**
 * Activity type enum
 */
export enum ActivityType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PROFILE_UPDATE = 'profile_update',
  SECURITY_UPDATE = 'security_update',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  DEVICE_ADDED = 'device_added',
  DEVICE_REMOVED = 'device_removed',
  FAILED_LOGIN = 'failed_login',
  PASSWORD_RESET = 'password_reset',
  EMAIL_CHANGE = 'email_change',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked'
}

/**
 * User activity interface
 */
export interface IUserActivity {
  user: mongoose.Types.ObjectId | string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  successful?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User activity document interface
 */
export interface UserActivityDocument extends IUserActivity, Document {}

/**
 * User activity schema
 * Tracks user actions and events for security and audit purposes
 */
const userActivitySchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: Object.values(ActivityType)
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  successful: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
userActivitySchema.index({ user: 1, createdAt: -1 });
userActivitySchema.index({ type: 1 });

const UserActivity = model<UserActivityDocument>('UserActivity', userActivitySchema);

export default UserActivity;
