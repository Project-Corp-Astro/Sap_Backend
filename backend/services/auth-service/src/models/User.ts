import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { encryptionPlugin, decrypt } from '../../../../shared/utils/encryption';
import { 
  UserDocument, 
  IUser, 
  UserRole, 
  UserAddress, 
  OAuthProfile, 
  MFAType, 
  UserPreferences, 
  SecurityPreferences,
  LoginAttempt,
  MFASettings,
  EmailVerification,
  PasswordReset
} from '../interfaces/auth.interfaces';

// Define the schema
// Use a type assertion to avoid TypeScript errors with schema properties
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
  password: {
    type: String,
    required: true
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
  // OAuth profiles
  oauthProfiles: [{
    provider: {
      type: String,
      required: true,
      enum: ['local', 'google', 'facebook', 'github', 'twitter', 'linkedin', 'apple']
    },
    id: {
      type: String,
      required: true
    },
    username: String,
    email: String,
    displayName: String,
    firstName: String,
    lastName: String,
    profileUrl: String,
    photoUrl: String,
    accessToken: {
      type: String,
      encrypt: true
    },
    refreshToken: {
      type: String,
      encrypt: true
    },
    tokenExpiresAt: Date
  }],
  // Multi-factor authentication
  mfa: {
    enabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: Object.values(MFAType),
      default: MFAType.TOTP
    },
    secret: {
      type: String,
      encrypt: true
    },
    backupCodes: [{
      type: String
    }],
    verified: {
      type: Boolean,
      default: false
    },
    lastVerified: Date
  },
  // Security features
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  accountLockedUntil: {
    type: Date
  },
  passwordLastChanged: {
    type: Date
  },
  loginAttempts: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    successful: {
      type: Boolean,
      default: false
    }
  }],
  passwordReset: {
    token: String,
    expiresAt: Date
  },
  emailVerification: {
    token: String,
    expiresAt: Date
  },
  // Personal information (encrypted)
  phoneNumber: {
    type: String,
    encrypt: true
  },
  address: {
    street: { type: String, encrypt: true },
    city: { type: String, encrypt: true },
    state: { type: String, encrypt: true },
    postalCode: { type: String, encrypt: true },
    country: { type: String, encrypt: true }
  },
  // Profile information
  avatar: {
    type: String
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  // User preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
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
    },
    language: String,
    timezone: String
  },
  // Security preferences
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
    },
    trustedDevicesOnly: {
      type: Boolean,
      default: false
    },
    passwordExpiryDays: {
      type: Number,
      default: 90
    }
  },
  // Subscription
  subscriptionId: String
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    // Use type assertion to access the password property
    const userDoc = this as unknown as UserDocument;
    userDoc.password = await bcrypt.hash(userDoc.password, salt);
    
    // Update password change date
    userDoc.passwordLastChanged = new Date();
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    // Get the password value (which may be encrypted)
    const storedPassword = this.password;
    
    // If the password is encrypted, decrypt it first
    if (this._encrypted && this._encrypted.password) {
      const decryptedPassword = await decrypt(this._encrypted.password, {
        key: process.env.ENCRYPTION_KEY || 'your-secret-key',
        iv: process.env.ENCRYPTION_IV || 'your-initialization-vector',
        algorithm: 'aes-256-gcm'
      });
      return await bcrypt.compare(candidatePassword, decryptedPassword);
    }
    
    // If not encrypted, compare directly
    return await bcrypt.compare(candidatePassword, storedPassword);
  } catch (error) {
    throw error;
  }
};

// Check if account is locked
userSchema.methods.isAccountLocked = function(): boolean {
  // Check if account is locked and lock period hasn't expired
  if (this.accountLocked && this.accountLockedUntil && this.accountLockedUntil > new Date()) {
    return true;
  }
  
  // If lock period has expired, unlock the account
  if (this.accountLocked && this.accountLockedUntil && this.accountLockedUntil <= new Date()) {
    this.accountLocked = false;
    this.accountLockedUntil = undefined;
    this.loginAttempts = this.loginAttempts.filter((attempt: LoginAttempt) => attempt.successful);
    return false;
  }
  
  return false;
};

// Check if password should be changed (expired)
userSchema.methods.shouldChangePassword = function(): boolean {
  if (!this.passwordLastChanged || !this.securityPreferences?.passwordExpiryDays) {
    return false;
  }
  
  const expiryDays = this.securityPreferences.passwordExpiryDays;
  const now = new Date();
  const passwordAge = (now.getTime() - this.passwordLastChanged.getTime()) / (1000 * 60 * 60 * 24);
  
  return passwordAge > expiryDays;
};

// Add pre-save middleware to ensure password is properly hashed
userSchema.pre('save', async function(this: UserDocument, next) {
  // Only hash password if it's modified
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Apply encryption plugin to encrypt sensitive fields
// We don't need to exclude password since it's already handled by bcrypt
userSchema.plugin(encryptionPlugin);

// Create and export the User model
// Use type assertion to avoid TypeScript errors
const User = mongoose.model('User', userSchema) as Model<UserDocument>;

export default User;
