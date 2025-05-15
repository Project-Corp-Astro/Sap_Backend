/**
 * PostgreSQL Seed Script
 * Seeds the PostgreSQL database with initial data for development and testing
 */

import 'reflect-metadata';
import typeORMManager from '../shared/utils/typeorm';
import { createServiceLogger } from '../shared/utils/logger';
import { faker } from '@faker-js/faker';

const logger = createServiceLogger('pg-seed');

async function seedDatabase() {
  try {
    logger.info('Initializing TypeORM data source');
    const dataSource = await typeORMManager.initialize();
    
    logger.info('Starting database seeding');
    
    // Get repositories
    // Note: These will be created in the next steps
    const userRepository = dataSource.getRepository('User');
    const roleRepository = dataSource.getRepository('Role');
    const permissionRepository = dataSource.getRepository('Permission');
    
    // Clear existing data if in development mode
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Clearing existing data');
      await dataSource.query('TRUNCATE "permission" CASCADE');
      await dataSource.query('TRUNCATE "role" CASCADE');
      await dataSource.query('TRUNCATE "user" CASCADE');
    }
    
    // Seed roles
    logger.info('Seeding roles');
    const roles = await roleRepository.save([
      { name: 'admin', description: 'Administrator with full access' },
      { name: 'editor', description: 'Editor with content management access' },
      { name: 'author', description: 'Author with limited content creation access' },
      { name: 'viewer', description: 'Viewer with read-only access' }
    ]);
    
    // Seed permissions
    logger.info('Seeding permissions');
    const permissions = await permissionRepository.save([
      { name: 'create:content', description: 'Create content' },
      { name: 'read:content', description: 'Read content' },
      { name: 'update:content', description: 'Update content' },
      { name: 'delete:content', description: 'Delete content' },
      { name: 'manage:users', description: 'Manage users' },
      { name: 'manage:settings', description: 'Manage settings' }
    ]);
    
    // Assign permissions to roles
    logger.info('Assigning permissions to roles');
    const adminRole = roles.find(role => role.name === 'admin');
    const editorRole = roles.find(role => role.name === 'editor');
    const authorRole = roles.find(role => role.name === 'author');
    const viewerRole = roles.find(role => role.name === 'viewer');
    
    if (adminRole) {
      adminRole.permissions = permissions;
      await roleRepository.save(adminRole);
    }
    
    if (editorRole) {
      editorRole.permissions = permissions.filter(p => 
        p.name !== 'manage:users' && p.name !== 'manage:settings'
      );
      await roleRepository.save(editorRole);
    }
    
    if (authorRole) {
      authorRole.permissions = permissions.filter(p => 
        p.name === 'create:content' || p.name === 'read:content' || p.name === 'update:content'
      );
      await roleRepository.save(authorRole);
    }
    
    if (viewerRole) {
      viewerRole.permissions = permissions.filter(p => p.name === 'read:content');
      await roleRepository.save(viewerRole);
    }
    
    // Seed users
    logger.info('Seeding users');
    const users = [];
    
    // Admin user
    users.push({
      email: 'admin@example.com',
      passwordHash: '$2a$10$eCQpOi9mOvfrKOCPwO4zYeYhVXJ.ftYJ1htuRnQWyYXVx2UgBpXMq', // password: admin123
      firstName: 'Admin',
      lastName: 'User',
      isVerified: true,
      role: adminRole
    });
    
    // Editor user
    users.push({
      email: 'editor@example.com',
      passwordHash: '$2a$10$eCQpOi9mOvfrKOCPwO4zYeYhVXJ.ftYJ1htuRnQWyYXVx2UgBpXMq', // password: admin123
      firstName: 'Editor',
      lastName: 'User',
      isVerified: true,
      role: editorRole
    });
    
    // Author user
    users.push({
      email: 'author@example.com',
      passwordHash: '$2a$10$eCQpOi9mOvfrKOCPwO4zYeYhVXJ.ftYJ1htuRnQWyYXVx2UgBpXMq', // password: admin123
      firstName: 'Author',
      lastName: 'User',
      isVerified: true,
      role: authorRole
    });
    
    // Generate 10 random users
    for (let i = 0; i < 10; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      
      users.push({
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        passwordHash: '$2a$10$eCQpOi9mOvfrKOCPwO4zYeYhVXJ.ftYJ1htuRnQWyYXVx2UgBpXMq', // password: admin123
        firstName,
        lastName,
        isVerified: faker.datatype.boolean(0.8), // 80% are verified
        role: faker.helpers.arrayElement([viewerRole, authorRole])
      });
    }
    
    await userRepository.save(users);
    logger.info(`Seeded ${users.length} users`);
    
    logger.info('Database seeding completed successfully');
    
    await typeORMManager.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database', { error: (error as Error).message });
    await typeORMManager.close();
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
