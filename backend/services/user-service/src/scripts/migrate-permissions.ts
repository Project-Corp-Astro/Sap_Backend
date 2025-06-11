import mongoose from 'mongoose';
import User from '../models/User';
import Permission from '../models/Permission';
import Role from '../models/Role';
import logger from '../utils/logger';
import { UserRole } from '@corp-astro/shared-types';

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sap-users';

async function migratePermissions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    
    logger.info('Connected to MongoDB, starting permission migration');
    
    // Ensure permissions are initialized
    const permissionCount = await Permission.countDocuments();
    if (permissionCount === 0) {
      logger.error('Permissions collection is empty. Please run the application first to initialize permissions.');
      process.exit(1);
    }
    
    // Ensure roles are initialized
    const roleCount = await Role.countDocuments();
    if (roleCount === 0) {
      logger.error('Roles collection is empty. Please run the application first to initialize roles.');
      process.exit(1);
    }
    
    // Get all users with legacy permissions
    const users = await User.find({ permissionsLegacy: { $exists: true, $ne: [] } });
    logger.info(`Found ${users.length} users with legacy permissions to migrate`);
    
    // Get all permissions for lookup
    const allPermissions = await Permission.find();
    const permissionMap = new Map(allPermissions.map(p => [p.id, p._id]));
    
    // Get all roles for lookup
    const adminRole = await Role.findOne({ systemRole: UserRole.ADMIN });
    const managerRole = await Role.findOne({ systemRole: UserRole.MANAGER });
    const userRole = await Role.findOne({ systemRole: UserRole.USER });
    
    if (!adminRole || !managerRole || !userRole) {
      logger.error('Could not find all required roles. Please run the application first to initialize roles.');
      process.exit(1);
    }
    
    // Process each user
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        // Map legacy permissions to new permission references
        const permissionIds = user.permissionsLegacy.filter(p => permissionMap.has(p))
          .map(p => permissionMap.get(p));
        
        // Assign appropriate role based on user's role field
        let roleId;
        switch (user.role) {
          case UserRole.ADMIN:
            roleId = adminRole._id;
            break;
          case UserRole.MANAGER:
            roleId = managerRole._id;
            break;
          default:
            roleId = userRole._id;
        }
        
        // Update user with new permission and role references
        user.permissions = permissionIds;
        user.roles = [roleId];
        
        // Clear legacy permissions
        user.permissionsLegacy = [];
        
        await user.save();
        logger.info(`Successfully migrated permissions for user ${user._id} (${user.email})`);
        successCount++;
      } catch (error) {
        logger.error(`Error migrating permissions for user ${user._id}:`, { error: (error as Error).message });
        errorCount++;
      }
    }
    
    logger.info('Permission migration completed');
    logger.info(`Successfully migrated ${successCount} users`);
    
    if (errorCount > 0) {
      logger.warn(`Failed to migrate ${errorCount} users`);
    }
    
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    
  } catch (error) {
    logger.error('Error during permission migration:', { error: (error as Error).message });
    process.exit(1);
  }
}

// Run the migration
migratePermissions();
