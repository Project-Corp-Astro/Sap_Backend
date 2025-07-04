// models/mongodb/RolePermission.model.ts

import { Schema, model, Document } from 'mongoose';
import { IRolePermission } from '../../../../shared/interfaces/permission.interface';
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
rolePermissionSchema.index({ _id: 1, application: 1 });  // For permission lookups
rolePermissionSchema.index({ 
  application: 1,
  'permissions': 1 
}, { 
  sparse: true 
});

const RolePermissionModel = model<IRolePermission & Document>('RolePermission', rolePermissionSchema);

export default RolePermissionModel;