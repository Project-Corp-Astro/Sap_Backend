import mongoose, { Schema, model } from 'mongoose';
import { Permission as PermissionType } from '@corp-astro/shared-types';

export interface PermissionDocument extends mongoose.Document {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  resource: {
    type: String,
    required: true,
    trim: true
  },
  action: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for faster lookups
permissionSchema.index({ id: 1 }, { unique: true });
permissionSchema.index({ resource: 1 });
permissionSchema.index({ action: 1 });

const Permission = model<PermissionDocument>('Permission', permissionSchema);

export default Permission;
