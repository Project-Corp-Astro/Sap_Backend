// migrations/migrateUserRoles.ts
import mongoose from 'mongoose';
import UserModel from '../models/mongodb/User.model'; // Update path to your User model
import { RolePermissionModel } from '../models/mongodb/RolePermission.model';
import { PermissionAction, ResourceType } from '../shared/interfaces/permission.interface';

// Default permissions for each role
const DEFAULT_PERMISSIONS = {
  superadmin: {
    permissions: Object.values(PermissionAction).map(action => `${action}:*`), // All permissions
    description: 'Full access to all resources'
  },
  admin: {
    permissions: [
      'create:*',
      'read:*',
      'update:*',
      'delete:*',
      'export:*'
    ],
    description: 'Admin access with most permissions'
  },
  user: {
    permissions: [
      'read:profile',
      'update:profile',
      'read:dashboard'
    ],
    description: 'Basic user permissions'
  },
  // Add more roles as needed
};

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sap-db';

async function migrateRoles() {
  try {
    await mongoose.connect(mongoUri);
    console.log('🚀 Connected to MongoDB');

    // First, create or update role permissions
    console.log('🔄 Setting up default role permissions...');
    for (const [role, config] of Object.entries(DEFAULT_PERMISSIONS)) {
      await RolePermissionModel.findOneAndUpdate(
        { role },
        {
          role,
          application: '*',
          permissions: config.permissions,
          description: config.description,
          version: 1
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`✅ Created/Updated permissions for role: ${role}`);
    }

    // Migrate users
    console.log('🔄 Migrating users to new RBAC system...');
    // Find all users regardless of whether they have a role field or not
    const users = await UserModel.find({});
    console.log(`🔍 Found ${users.length} users in total`);

    console.log(`🔍 Found ${users.length} users to migrate`);

    for (const user of users) {
      try {
        // Skip if already migrated (has roles array with items)
        if (user.roles && user.roles.length > 0) {
          console.log(`ℹ️ User ${user.username || user.email} already migrated, skipping...`);
          continue;
        }

        // Get the role from the old field or use a default
        const oldRole = ((user as any).role || 'user').toLowerCase();
        const normalizedRole = oldRole === 'super_admin' ? 'superadmin' : oldRole;
        
        // Determine application context
        const application = normalizedRole === 'superadmin' ? '*' : 'system';

        // Create new roles array
        const newRoles = [
          {
            role: normalizedRole,
            application: application,
            permissionVersion: 1
          }
        ];

        // Update user with new roles
        user.set('roles', newRoles);
        
        // Remove the old role field if it exists
        if ((user as any).role) {
          user.set('role', undefined, { strict: false });
        }

        await user.save();
        console.log(`✅ Migrated user: ${user.username || user.email} with role: ${normalizedRole}`);
      } catch (error) {
        console.error(`❌ Error migrating user ${user.username || user.email}:`, error);
      }
    }

    console.log('🎉 Migration complete');
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateRoles();
