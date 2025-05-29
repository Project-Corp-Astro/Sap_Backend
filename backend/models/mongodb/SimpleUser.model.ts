/**
 * Simple User Model for MongoDB
 * This is a simplified version without hooks that might cause queryStats errors
 */

import mongoose, { Schema } from 'mongoose';
import { 
  UserDocument, 
  UserRole, 
  ThemePreference
} from '../../shared/interfaces/user.interface';

// Main User Schema - simplified for seeding
const userSchema = new Schema<UserDocument>({
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
    required: true
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { 
    type: String, 
    enum: Object.values(UserRole),
    default: UserRole.USER 
  },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  preferences: {
    type: new Schema({
      theme: { 
        type: String, 
        enum: Object.values(ThemePreference),
        default: ThemePreference.SYSTEM 
      },
      notifications: {
        type: new Schema({
          email: { type: Boolean, default: true },
          push: { type: Boolean, default: false }
        }, { _id: false })
      }
    }, { _id: false }),
    default: () => ({
      theme: ThemePreference.SYSTEM,
      notifications: {
        email: true,
        push: false
      }
    })
  }
}, { 
  timestamps: true,
  versionKey: false
});

// Create and export the model
const SimpleUserModel = mongoose.model<UserDocument>('SimpleUser', userSchema);

export default SimpleUserModel;
