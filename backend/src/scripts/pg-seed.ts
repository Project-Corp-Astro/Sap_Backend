/**
 * PostgreSQL Database Seed Script
 * Populates the PostgreSQL database with initial data
 */

import { createConnection, getRepository } from 'typeorm';
import { createServiceLogger } from '../../shared/utils/logger';
import { Permission } from '../entities/Permission.entity';
import { Role } from '../entities/Role.entity';
import { User } from '../entities/User.entity';
import { UserPreference } from '../entities/UserPreference.entity';
import { typeormConfig } from '../config/database.config';
import * as bcrypt from 'bcrypt';

const logger = createServiceLogger('pg-seed');

// Define initial permissions
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

// Define initial roles
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

// Define initial admin user
const adminUser = {
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  password: 'Admin123!',
  isVerified: true,
  isActive: true,
  role: 'admin'
};

/**
 * Seed permissions
 */
async function seedPermissions() {
  logger.info('Seeding permissions...');
  const permissionRepository = getRepository(Permission);
  
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
  
  logger.info('Permissions seeded successfully');
}

/**
 * Seed roles
 */
async function seedRoles() {
  logger.info('Seeding roles...');
  const roleRepository = getRepository(Role);
  const permissionRepository = getRepository(Permission);
  
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
  
  logger.info('Roles seeded successfully');
}

/**
 * Seed admin user
 */
async function seedAdminUser() {
  logger.info('Seeding admin user...');
  const userRepository = getRepository(User);
  const roleRepository = getRepository(Role);
  const preferenceRepository = getRepository(UserPreference);
  
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
    logger.info(`Created admin user: ${user.email}`);
    
    // Create user preferences
    const preferences = preferenceRepository.create({
      user,
      theme: 'system',
      language: 'en',
      emailNotifications: true,
      pushNotifications: true,
      inAppNotifications: true
    });
    
    await preferenceRepository.save(preferences);
    logger.info('Created admin user preferences');
  } else {
    logger.info(`Admin user already exists: ${adminUser.email}`);
  }
  
  logger.info('Admin user seeded successfully');
}

/**
 * Main seed function
 */
async function seed() {
  logger.info('Starting database seed...');
  
  try {
    // Create TypeORM connection
    const connection = await createConnection(typeormConfig);
    logger.info('Database connection established');
    
    // Seed data
    await seedPermissions();
    await seedRoles();
    await seedAdminUser();
    
    // Close connection
    await connection.close();
    logger.info('Database connection closed');
    
    logger.info('Database seed completed successfully');
  } catch (error) {
    logger.error('Error seeding database', { error: (error as Error).message });
    process.exit(1);
  }
}

// Run seed function
seed();
