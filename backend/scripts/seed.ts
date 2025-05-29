/**
 * Database Seed Script
 * 
 * This script populates both PostgreSQL and MongoDB databases with initial data.
 * It ensures that the application has the necessary base data to function properly.
 */

import { createServiceLogger } from '../shared/utils/logger';
import mongoose, { Types } from 'mongoose';
import { getRepository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

// Import database utilities
import dbManager from '../src/utils/DatabaseManager';
import typeORMManager from '../shared/utils/typeorm';
import { mockMongoClient } from '../shared/utils/mock-database';
import mongoDbConnection from '../shared/utils/database';

// Import MongoDB models
import { UserModel } from '../models/mongodb/index';
import { ContentModel } from '../models/mongodb/index';
import SimpleUserModel from '../models/mongodb/SimpleUser.model';

// Import PostgreSQL entities
import { Permission } from '../src/entities/Permission.entity';
import { Role } from '../src/entities/Role.entity';
import { User } from '../src/entities/User.entity';
import { UserPreference } from '../src/entities/UserPreference.entity';

// Import user roles enum
import { UserRole } from '../shared/interfaces/user.interface';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const logger = createServiceLogger('seed-script');

// Define initial permissions for PostgreSQL
const initialPermissions = [
  { name: 'user:read', description: 'Read user information', resource: 'user', action: 'read', isSystem: true },
  { name: 'user:create', description: 'Create users', resource: 'user', action: 'create', isSystem: true },
  { name: 'user:update', description: 'Update user information', resource: 'user', action: 'update', isSystem: true },
  { name: 'user:delete', description: 'Delete users', resource: 'user', action: 'delete', isSystem: true },
  { name: 'role:read', description: 'Read role information', resource: 'role', action: 'read', isSystem: true },
  { name: 'role:create', description: 'Create roles', resource: 'role', action: 'create', isSystem: true },
  { name: 'role:update', description: 'Update role information', resource: 'role', action: 'update', isSystem: true },
  { name: 'role:delete', description: 'Delete roles', resource: 'role', action: 'delete', isSystem: true },
  { name: 'permission:read', description: 'Read permission information', resource: 'permission', action: 'read', isSystem: true },
  { name: 'permission:create', description: 'Create permissions', resource: 'permission', action: 'create', isSystem: true },
  { name: 'permission:update', description: 'Update permission information', resource: 'permission', action: 'update', isSystem: true },
  { name: 'permission:delete', description: 'Delete permissions', resource: 'permission', action: 'delete', isSystem: true },
  { name: 'content:read', description: 'Read content', resource: 'content', action: 'read', isSystem: true },
  { name: 'content:create', description: 'Create content', resource: 'content', action: 'create', isSystem: true },
  { name: 'content:update', description: 'Update content', resource: 'content', action: 'update', isSystem: true },
  { name: 'content:delete', description: 'Delete content', resource: 'content', action: 'delete', isSystem: true },
  { name: 'content:publish', description: 'Publish content', resource: 'content', action: 'publish', isSystem: true },
  { name: 'content:unpublish', description: 'Unpublish content', resource: 'content', action: 'unpublish', isSystem: true },
  { name: 'system:settings', description: 'Manage system settings', resource: 'system', action: 'settings', isSystem: true },
  { name: 'system:logs', description: 'View system logs', resource: 'system', action: 'logs', isSystem: true },
];

// Define initial roles for PostgreSQL
const initialRoles = [
  {
    name: 'admin',
    description: 'Administrator with full access',
    isDefault: false,
    isSystem: true,
    permissions: [
      'user:read', 'user:create', 'user:update', 'user:delete',
      'role:read', 'role:create', 'role:update', 'role:delete',
      'permission:read', 'permission:create', 'permission:update', 'permission:delete',
      'content:read', 'content:create', 'content:update', 'content:delete', 'content:publish', 'content:unpublish',
      'system:settings', 'system:logs'
    ]
  },
  {
    name: 'editor',
    description: 'Editor with content management access',
    isDefault: false,
    isSystem: true,
    permissions: [
      'user:read',
      'content:read', 'content:create', 'content:update', 'content:delete', 'content:publish', 'content:unpublish'
    ]
  },
  {
    name: 'user',
    description: 'Regular user with basic access',
    isDefault: true,
    isSystem: true,
    permissions: [
      'user:read',
      'content:read'
    ]
  }
];

// Define initial admin user for PostgreSQL
const adminUser = {
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  password: 'Admin123!',
  isVerified: true,
  isActive: true,
  role: 'admin'
};

// Define initial users for MongoDB
const initialMongoUsers = [
  {
    username: 'admin',
    email: 'admin@example.com',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    isActive: true,
    isEmailVerified: true,
    preferences: {
      theme: 'system',
      notifications: {
        email: true,
        push: false
      }
    }
  },
  {
    username: 'user1',
    email: 'user1@example.com',
    password: 'User123!',
    firstName: 'Regular',
    lastName: 'User',
    role: UserRole.USER,
    isActive: true,
    isEmailVerified: true,
    preferences: {
      theme: 'light',
      notifications: {
        email: true,
        push: true
      }
    }
  }
];

// Define initial content for MongoDB
const initialMongoContent = [
  {
    title: 'Welcome to SAP Backend',
    slug: 'welcome-to-sap-backend',
    body: 'This is the first post in our system. Welcome to the SAP Backend application!',
    status: 'PUBLISHED',
    author: null, // Will be set to admin user ID during seeding
    tags: ['welcome', 'introduction'],
    categories: ['announcements'],
    publishedAt: new Date(),
  },
  {
    title: 'Getting Started with Astrology',
    slug: 'getting-started-with-astrology',
    body: 'Learn the basics of astrology and how to interpret your birth chart.',
    status: 'PUBLISHED',
    author: null, // Will be set to admin user ID during seeding
    tags: ['astrology', 'beginners', 'birth chart'],
    categories: ['astrology', 'education'],
    publishedAt: new Date(),
  }
];

/**
 * Seed PostgreSQL permissions
 */
async function seedPgPermissions() {
  logger.info('Seeding PostgreSQL permissions...');
  const dataSource = typeORMManager.getDataSource();
  if (!dataSource) {
    throw new Error('TypeORM data source not initialized');
  }
  
  const permissionRepository = dataSource.getRepository(Permission);
  
  for (const permissionData of initialPermissions) {
    const existingPermission = await permissionRepository.findOne({ where: { name: permissionData.name } });
    
    if (!existingPermission) {
      const permission = permissionRepository.create(permissionData);
      await permissionRepository.save(permission);
      logger.info(`Created permission: ${permission.name}`);
    } else {
      logger.info(`Permission already exists: ${permissionData.name}`);
    }
  }
  
  logger.info('PostgreSQL permissions seeded successfully');
}

/**
 * Seed PostgreSQL roles
 */
async function seedPgRoles() {
  logger.info('Seeding PostgreSQL roles...');
  const dataSource = typeORMManager.getDataSource();
  if (!dataSource) {
    throw new Error('TypeORM data source not initialized');
  }
  
  const roleRepository = dataSource.getRepository(Role);
  const permissionRepository = dataSource.getRepository(Permission);
  
  for (const roleData of initialRoles) {
    const { permissions: permissionNames, ...roleInfo } = roleData;
    
    let role = await roleRepository.findOne({ where: { name: roleInfo.name } });
    
    if (!role) {
      role = roleRepository.create(roleInfo);
      await roleRepository.save(role);
      logger.info(`Created role: ${role.name}`);
    } else {
      logger.info(`Role already exists: ${roleInfo.name}`);
    }
    
    // Assign permissions to role
    const permissions = await permissionRepository.createQueryBuilder('permission')
      .where('permission.name IN (:...names)', { names: permissionNames })
      .getMany();
    
    role.permissions = permissions;
    await roleRepository.save(role);
    logger.info(`Assigned ${permissions.length} permissions to role: ${role.name}`);
  }
  
  logger.info('PostgreSQL roles seeded successfully');
}

/**
 * Seed PostgreSQL admin user
 */
async function seedPgAdminUser() {
  logger.info('Seeding PostgreSQL admin user...');
  const dataSource = typeORMManager.getDataSource();
  if (!dataSource) {
    throw new Error('TypeORM data source not initialized');
  }
  
  const userRepository = dataSource.getRepository(User);
  const roleRepository = dataSource.getRepository(Role);
  const preferenceRepository = dataSource.getRepository(UserPreference);
  
  // Check if admin user already exists
  const existingUser = await userRepository.findOne({ where: { email: adminUser.email } });
  
  if (!existingUser) {
    // Get admin role
    const adminRole = await roleRepository.findOne({ where: { name: adminUser.role } });
    
    if (!adminRole) {
      throw new Error('Admin role not found');
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminUser.password, salt);
    
    // Create user
    const user = userRepository.create({
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      passwordHash,
      isVerified: adminUser.isVerified,
      isActive: adminUser.isActive,
      role: adminRole
    });
    
    await userRepository.save(user);
    logger.info(`Created PostgreSQL admin user: ${user.email}`);
    
    // Create user preferences
    const preferences = preferenceRepository.create({
      userId: user.id,
      theme: 'system' as any, // Type casting to avoid Theme enum issues
      language: 'en',
      emailNotifications: true,
      pushNotifications: true,
      inAppNotifications: true
    });
    
    await preferenceRepository.save(preferences);
    logger.info('Created PostgreSQL admin user preferences');
  } else {
    logger.info(`PostgreSQL admin user already exists: ${adminUser.email}`);
  }
  
  logger.info('PostgreSQL admin user seeded successfully');
}

/**
 * Seed MongoDB users
 */
async function seedMongoUsers() {
  logger.info('Seeding MongoDB users...');
  
  let adminUserId = null;
  
  try {
    // Get direct access to the MongoDB connection
    const connection = mongoose.connection;
    if (!connection || connection.readyState !== 1) {
      logger.error('MongoDB connection not available');
      return null;
    }
    
    // Get direct access to the users collection
    if (!connection.db) {
      logger.error('MongoDB database not available');
      return null;
    }
    const usersCollection = connection.db.collection('users');
    
    for (const userData of initialMongoUsers) {
      try {
        // Check if user already exists using direct collection query
        const existingUser = await usersCollection.findOne({ email: userData.email });
        
        if (!existingUser) {
          // Hash the password directly
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(userData.password, salt);
          
          // Create a plain object without methods to avoid potential issues
          const userDataToSave = {
            username: userData.username,
            email: userData.email,
            password: hashedPassword,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            isActive: userData.isActive,
            isEmailVerified: userData.isEmailVerified,
            preferences: userData.preferences,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Insert directly into the collection to bypass Mongoose middleware
          const result = await usersCollection.insertOne(userDataToSave);
          
          if (userData.role === UserRole.ADMIN) {
            adminUserId = result.insertedId;
          }
          
          logger.info(`Created MongoDB user: ${userData.email}`);
        } else {
          logger.info(`MongoDB user already exists: ${userData.email}`);
          
          if (userData.role === UserRole.ADMIN) {
            adminUserId = existingUser._id;
          }
        }
      } catch (userError) {
        logger.error(`Error creating MongoDB user ${userData.email}`, { error: (userError as Error).message });
      }
    }
    
    logger.info('MongoDB users seeding completed');
    return adminUserId;
  } catch (error) {
    logger.error('Error in MongoDB user seeding process', { error: (error as Error).message });
    return null;
  }
}

/**
 * Seed MongoDB content
 */
async function seedMongoContent(adminUserId: Types.ObjectId) {
  logger.info('Seeding MongoDB content...');
  
  try {
    // Get direct access to the MongoDB connection
    const connection = mongoose.connection;
    if (!connection || connection.readyState !== 1) {
      logger.error('MongoDB connection not available');
      return;
    }
    
    // Get direct access to the content collection
    if (!connection.db) {
      logger.error('MongoDB database not available');
      return;
    }
    const contentCollection = connection.db.collection('contents');
    
    for (const contentData of initialMongoContent) {
      try {
        // Check if content already exists using direct collection query
        const existingContent = await contentCollection.findOne({ slug: contentData.slug });
        
        if (!existingContent) {
          // Create content document with author ID
          const contentToSave = {
            ...contentData,
            author: adminUserId,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Insert directly into the collection to bypass Mongoose middleware
          await contentCollection.insertOne(contentToSave);
          logger.info(`Created MongoDB content: ${contentData.title}`);
        } else {
          logger.info(`MongoDB content already exists: ${contentData.title}`);
        }
      } catch (contentError) {
        logger.error(`Error creating MongoDB content ${contentData.title}`, { error: (contentError as Error).message });
      }
    }
    
    logger.info('MongoDB content seeded successfully');
  } catch (error) {
    logger.error('Error in MongoDB content seeding process', { error: (error as Error).message });
  }
}

/**
 * Seed PostgreSQL database
 */
async function seedPostgres() {
  logger.info('Seeding PostgreSQL database...');
  
  try {
    // Initialize TypeORM
    await dbManager.connectPostgres();
    await dbManager.initializeTypeORM();
    
    // Seed PostgreSQL data
    await seedPgPermissions();
    await seedPgRoles();
    await seedPgAdminUser();
    
    logger.info('PostgreSQL database seeded successfully');
  } catch (error) {
    logger.error('Error seeding PostgreSQL database', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Seed MongoDB database
 */
async function seedMongo() {
  logger.info('Seeding MongoDB database...');
  
  try {
    // Check if we're using mock databases
    const useMockDatabases = process.env.USE_MOCK_DATABASES === 'true';
    
    if (useMockDatabases) {
      logger.info('Using mock MongoDB for seeding');
      // No need to connect to mock MongoDB, it's already initialized
    } else {
      // Connect to real MongoDB
      logger.info('Connecting to real MongoDB for seeding');
      await dbManager.connectMongo();
    }
    
    // Seed MongoDB data
    const adminUserId = await seedMongoUsers();
    
    if (adminUserId) {
      // Convert string ID to ObjectId if needed
      const adminObjectId = typeof adminUserId === 'string' ? new Types.ObjectId(adminUserId) : adminUserId;
      await seedMongoContent(adminObjectId);
    } else {
      logger.warn('Admin user not found or created, skipping content seeding');
    }
    
    logger.info('MongoDB database seeded successfully');
  } catch (error) {
    logger.error('Error seeding MongoDB database', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Main seed function
 */
async function seed() {
  logger.info('Starting database seed...');
  
  try {
    // Seed PostgreSQL
    await seedPostgres();
    
    // Seed MongoDB
    await seedMongo();
    
    // Close all database connections
    await dbManager.closeAll();
    
    logger.info('Database seed completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding databases', { error: (error as Error).message });
    
    // Close all database connections
    try {
      await dbManager.closeAll();
    } catch (closeError) {
      logger.error('Error closing database connections', { error: (closeError as Error).message });
    }
    
    process.exit(1);
  }
}

// Run seed function
seed();
