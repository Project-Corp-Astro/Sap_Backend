import { Schema, model, Document, Types } from 'mongoose';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, IUserPreferences, IUserAddress, IUserDevice } from '../../shared/interfaces/user.interface';

// Extend the IUser interface to include Mongoose Document properties
export interface IUserDocument extends Omit<IUser, '_id'>, Document {
  _id: Types.ObjectId;
  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName: string; // Virtual field
}
const userPreferencesSchema = new Schema<IUserPreferences>({
  theme: { 
    type: String, 
    enum: ['light', 'dark', 'system'],
    default: 'system'
  },
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: false }
  },
  language: { 
    type: String, 
    default: 'en' 
  },
  timezone: { 
    type: String, 
    default: 'UTC' 
  }
}, { _id: false });

const userAddressSchema = new Schema<IUserAddress>({
  street: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },
  country: { type: String }
}, { _id: false });

const userDeviceSchema = new Schema<IUserDevice>({
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
    required: true 
  },
  os: { type: String },
  browser: { type: String },
  ipAddress: { type: String },
  lastUsed: { 
    type: Date, 
    default: Date.now 
  },
  isTrusted: { 
    type: Boolean, 
    default: false 
  }
}, { _id: false });

// Main User Schema
const userSchema = new Schema<IUserDocument>({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
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
    required: true,
    select: false
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
  phoneNumber: { 
    type: String,
    trim: true
  },
  avatar: { 
    type: String 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isEmailVerified: { 
    type: Boolean, 
    default: false 
  },
  lastLogin: { 
    type: Date 
  },
 roles: [{
     type: mongoose.Schema.Types.ObjectId,
     ref: 'RolePermission'
   }],
  address: userAddressSchema,
  preferences: { 
    type: userPreferencesSchema, 
    default: () => ({}) 
  },
  devices: [userDeviceSchema]
}, { 
  timestamps: true,
  versionKey: false 
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ 'roles.role': 1 });
userSchema.index({ 'roles.application': 1 });


// Pre-save hook to hash password
userSchema.pre<IUserDocument>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(this.password, salt);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(
  this: IUserDocument,
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
userSchema.virtual('fullName').get(function(this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are included when converting to JSON
userSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    return ret;
  }
});

userSchema.set('toObject', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    return ret;
  }
});

// Create and export the model
const UserModel = model<IUserDocument>('User', userSchema);

export default UserModel;