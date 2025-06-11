import mongoose, { Schema, model } from 'mongoose';
import { UserDocument, ThemePreference, AppAccess } from '../interfaces/shared-types';
import { UserRole /*, VALID_PERMISSIONS */ } from '@corp-astro/shared-types';

// Temporary hardcoded permissions to bypass VALID_PERMISSIONS undefined error
// TODO: Revert to `enum: VALID_PERMISSIONS.map(p => p.id)` after fixing import
const PERMISSION_IDS = [
  'system.view',
  'system.configure',
  'system.manage_roles',
  'system.view_logs',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'users.impersonate',
  'content.view',
  'content.create',
  'content.edit',
  'content.delete',
  'content.publish',
  'content.approve',
  'analytics.view',
  'analytics.export',
  'analytics.configure',
  'app.corpastra.manage',
  'app.grahvani.manage',
  'app.tellmystars.manage'
];

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    trim: true
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
  password: {
    type: String,
    required: true
  },
  // Legacy permissions field (for backward compatibility)
  permissionsLegacy: [{
    type: String,
    enum: PERMISSION_IDS
  }],
  // New references to Permission model
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  // References to Role model
  roles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  }],
  department: {
    type: String
  },
  position: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isMfaEnabled: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  profileImage: {
    type: String
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  managedDepartments: {
    type: [String],
    default: undefined
  },
  securityLevel: {
    type: Number,
    default: 0
  },
  canImpersonate: {
    type: Boolean,
    default: false
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
  },
  appAccess: [{
    type: String,
    enum: Object.values(AppAccess),
    default: [AppAccess.CORP_ASTRO]
  }]
}, {
  timestamps: true
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'devices.deviceId': 1 });

const User = model<UserDocument>('User', userSchema);

export default User;