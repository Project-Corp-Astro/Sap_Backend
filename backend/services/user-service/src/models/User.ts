import mongoose, { Schema, model } from 'mongoose';
import { UserDocument, ThemePreference } from '../interfaces/shared-types';
import { UserRole } from '@corp-astro/shared-types';

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER
  },
  permissions: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  avatar: {
    type: String
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  preferences: {
    theme: {
      type: String,
      enum: Object.values(ThemePreference),
      default: ThemePreference.SYSTEM
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    }
  },
  securityPreferences: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    loginNotifications: {
      type: Boolean,
      default: true
    },
    activityAlerts: {
      type: Boolean,
      default: true
    }
  },
  devices: [{
    deviceId: String,
    deviceName: String,
    deviceType: String,
    browser: String,
    operatingSystem: String,
    lastUsed: Date,
    ipAddress: String,
    isTrusted: Boolean,
    userAgent: String,
    location: {
      country: String,
      city: String,
      latitude: Number,
      longitude: Number
    }
  }],
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'devices.deviceId': 1 });

// Note: Password management is handled by auth-service, 
// this service only deals with user data

const User = model<UserDocument>('User', userSchema);

export default User;
