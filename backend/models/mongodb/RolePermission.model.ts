// models/mongodb/RolePermission.model.ts

import { Schema, model, Document } from 'mongoose';
import { IRolePermission } from '../../shared/interfaces/permission.interface';

const rolePermissionSchema = new Schema<IRolePermission & Document>({
  role: { 
    type: String, 
    required: true,
    index: true
  },
  application: { 
    type: String, 
    required: true,
    index: true
  },
  permissions: [{
    type: String,
    required: true
  }],
  version: { 
    type: Number, 
    default: 1 
  }
}, { 
  timestamps: true,
  versionKey: false 
});

// Compound index for faster lookups
rolePermissionSchema.index({ _id: 1 });  // implicit, double check exists
rolePermissionSchema.index({ role: 1, application: 1 }, { unique: true });
rolePermissionSchema.index({ application: 1 });  // if querying often by app
rolePermissionSchema.index({ permissions: 1 });  // if querying often by permission

const RolePermissionModel = model<IRolePermission & Document>('RolePermission', rolePermissionSchema);

export default RolePermissionModel;