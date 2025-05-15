import mongoose, { Schema, model, Document } from 'mongoose';

/**
 * Device type enum
 */
export enum DeviceType {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
  OTHER = 'other'
}

/**
 * Location interface
 */
export interface DeviceLocation {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * User device interface
 */
export interface IUserDevice {
  user: mongoose.Types.ObjectId | string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  browser?: string;
  operatingSystem?: string;
  ipAddress?: string;
  lastUsed: Date;
  isTrusted: boolean;
  userAgent?: string;
  location?: DeviceLocation;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User device document interface
 */
export interface UserDeviceDocument extends IUserDevice, Document {}

/**
 * User device schema
 * Tracks devices used to access the application for security purposes
 */
const userDeviceSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceId: {
    type: String,
    required: true
  },
  deviceName: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    enum: Object.values(DeviceType),
    default: DeviceType.OTHER
  },
  browser: {
    type: String,
    default: ''
  },
  operatingSystem: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  isTrusted: {
    type: Boolean,
    default: false
  },
  userAgent: {
    type: String,
    default: ''
  },
  location: {
    type: {
      country: String,
      city: String,
      latitude: Number,
      longitude: Number
    },
    default: null
  }
}, {
  timestamps: true
});

// Compound index for uniqueness per user
userDeviceSchema.index({ user: 1, deviceId: 1 }, { unique: true });
userDeviceSchema.index({ user: 1, lastUsed: -1 });

const UserDevice = model<UserDeviceDocument>('UserDevice', userDeviceSchema);

export default UserDevice;
