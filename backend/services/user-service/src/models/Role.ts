import mongoose, { Schema, model } from 'mongoose';
import { UserRole } from '@corp-astro/shared-types';

export interface RoleDocument extends mongoose.Document {
  name: string;
  description: string;
  systemRole: string; // Maps to UserRole enum
  permissions: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  systemRole: {
    type: String,
    enum: Object.values(UserRole),
    unique: true
  },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }]
}, {
  timestamps: true
});

// Indexes for faster lookups
roleSchema.index({ name: 1 }, { unique: true });
roleSchema.index({ systemRole: 1 }, { unique: true });

const Role = model<RoleDocument>('Role', roleSchema);

export default Role;
