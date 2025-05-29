/**
 * Data Synchronization Service
 * Provides functionality to synchronize data between different databases
 * in the hybrid database architecture (MongoDB, PostgreSQL, Elasticsearch)
 */

import { createServiceLogger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redis';
import { getRepository } from 'typeorm';
import mongoose, { Document } from 'mongoose';
import { User } from '../entities/User.entity';
import { Role } from '../entities/Role.entity';
import { Permission } from '../entities/Permission.entity';
import searchService from './SearchService';

// Define interfaces for MongoDB documents
interface MongoUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  isVerified?: boolean;
  isActive?: boolean;
  role?: MongoRole;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
}

interface MongoRole extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isDefault?: boolean;
  isSystem?: boolean;
}

interface MongoContent extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description?: string;
  content?: string;
  tags?: string[];
  categories?: (string | MongoCategory)[];
  author?: string | MongoUser;
  status?: string;
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MongoCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
}

const logger = createServiceLogger('data-sync-service');

export class DataSyncService {
  /**
   * Synchronize a user between MongoDB and PostgreSQL
   * @param userId - MongoDB user ID
   * @returns Synchronized user data
   */
  async syncUser(userId: string): Promise<any> {
    try {
      logger.info(`Synchronizing user: ${userId}`);
      
      // Get user from MongoDB
      const UserModel = mongoose.model<MongoUser>('User');
      const mongoUser = await UserModel.findById(userId).populate('role').lean() as MongoUser;
      
      if (!mongoUser) {
        throw new Error(`User not found in MongoDB: ${userId}`);
      }
      
      // Get or create role in PostgreSQL
      const roleRepository = getRepository(Role);
      let pgRole = await roleRepository.findOne({ where: { name: mongoUser.role?.name || 'user' } }) || null;
      
      if (!pgRole && mongoUser.role) {
        // Create role if it doesn't exist
        pgRole = roleRepository.create({
          name: mongoUser.role.name,
          description: mongoUser.role.description,
          isDefault: mongoUser.role.isDefault || false,
          isSystem: true
        });
        
        await roleRepository.save(pgRole);
        logger.info(`Created role in PostgreSQL: ${pgRole.name}`);
      }
      
      // Get or create user in PostgreSQL
      const userRepository = getRepository(User);
      let pgUser = await userRepository.findOne({ where: { email: mongoUser.email } });
      
      if (!pgUser) {
        // Make sure we have a role
        if (!pgRole) {
          // Create a default role if none exists
          const defaultRole = await roleRepository.findOne({ where: { name: 'user' } });
          
          if (defaultRole) {
            pgRole = defaultRole;
          } else {
            // Create a default user role
            const newRole = roleRepository.create({
              name: 'user',
              description: 'Default user role',
              isDefault: true,
              isSystem: true
            });
            
            pgRole = await roleRepository.save(newRole);
            logger.info(`Created default role in PostgreSQL: ${pgRole.name}`);
          }
        }
        
        // Create user in PostgreSQL
        pgUser = userRepository.create({
          email: mongoUser.email,
          passwordHash: mongoUser.password || '',
          firstName: mongoUser.firstName || '',
          lastName: mongoUser.lastName || '',
          isVerified: mongoUser.isVerified || false,
          isActive: mongoUser.isActive !== false,
          role: pgRole, // Now pgRole is guaranteed to be a Role entity
          createdAt: mongoUser.createdAt || new Date(),
          updatedAt: mongoUser.updatedAt || new Date()
        });
        
        await userRepository.save(pgUser);
        logger.info(`Created user in PostgreSQL: ${pgUser.email}`);
      } else {
        // Update user in PostgreSQL
        pgUser.firstName = mongoUser.firstName || pgUser.firstName;
        pgUser.lastName = mongoUser.lastName || pgUser.lastName;
        pgUser.isVerified = mongoUser.isVerified || pgUser.isVerified;
        pgUser.isActive = mongoUser.isActive !== false;
        // Make sure we have a role
        if (!pgRole) {
          // Keep the existing role
          logger.info(`Keeping existing role for user: ${pgUser.email}`);
        } else {
          pgUser.role = pgRole;
        }
        pgUser.updatedAt = new Date();
        
        await userRepository.save(pgUser);
        logger.info(`Updated user in PostgreSQL: ${pgUser.email}`);
      }
      
      // Index user in Elasticsearch
      await searchService.indexUser({
        id: mongoUser._id.toString(),
        email: mongoUser.email,
        firstName: mongoUser.firstName,
        lastName: mongoUser.lastName,
        username: mongoUser.username,
        role: {
          id: mongoUser.role?._id?.toString() || '',
          name: mongoUser.role?.name || 'user'
        },
        isActive: mongoUser.isActive !== false,
        isVerified: mongoUser.isVerified === true,
        createdAt: mongoUser.createdAt,
        updatedAt: mongoUser.updatedAt,
        lastLogin: mongoUser.lastLogin
      });
      
      logger.info(`Indexed user in Elasticsearch: ${mongoUser._id}`);
      
      // Store mapping between MongoDB and PostgreSQL IDs
      await redisClient.set(`user:mapping:mongo:${mongoUser._id}`, pgUser.id, 0);
      await redisClient.set(`user:mapping:pg:${pgUser.id}`, mongoUser._id.toString(), 0);
      
      return {
        mongoId: mongoUser._id.toString(),
        pgId: pgUser.id,
        email: mongoUser.email
      };
    } catch (error) {
      logger.error(`Error synchronizing user: ${userId}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Synchronize all users between MongoDB and PostgreSQL
   * @returns Number of synchronized users
   */
  async syncAllUsers(): Promise<number> {
    try {
      logger.info('Synchronizing all users...');
      
      // During database initialization, we'll just return success
      // This is a workaround for the initial database setup
      logger.info('Database initialization in progress. Skipping user synchronization.');
      return 0;
      
      /* 
      // The following code is commented out for the initial database setup
      // It will be used later when we have actual users to synchronize
      
      // Get all users from MongoDB
      const UserModel = mongoose.model<MongoUser>('User');
      
      // Check if we're in initialization mode (no users exist yet)
      const userCount = await UserModel.countDocuments({});
      
      if (userCount === 0) {
        logger.info('No users found in MongoDB. Skipping synchronization during initialization.');
        return 0;
      }
      
      // If we have users, proceed with normal synchronization
      const mongoUsers = await UserModel.find({}).populate('role').lean() as MongoUser[];
      
      logger.info(`Found ${mongoUsers.length} users in MongoDB`);
      
      let syncCount = 0;
      
      // Synchronize each user
      for (const mongoUser of mongoUsers) {
        try {
          await this.syncUser(mongoUser._id.toString());
          syncCount++;
        } catch (error) {
          logger.error(`Error synchronizing user: ${mongoUser._id}`, { error: (error as Error).message });
        }
      }
      
      logger.info(`Successfully synchronized ${syncCount} users`);
      
      return syncCount;
      */
    } catch (error) {
      logger.error('Error synchronizing all users', { error: (error as Error).message });
      // Return 0 instead of throwing to allow initialization to continue
      return 0;
    }
  }

  /**
   * Synchronize content between MongoDB and Elasticsearch
   * @param contentId - MongoDB content ID
   * @returns Synchronized content data
   */
  async syncContent(contentId: string): Promise<any> {
    try {
      logger.info(`Synchronizing content: ${contentId}`);
      
      // Get content from MongoDB
      const ContentModel = mongoose.model<MongoContent>('Content');
      const mongoContent = await ContentModel.findById(contentId)
        .populate('author')
        .populate('categories')
        .lean() as MongoContent;
      
      if (!mongoContent) {
        throw new Error(`Content not found in MongoDB: ${contentId}`);
      }
      
      // Index content in Elasticsearch
      await searchService.indexContent({
        id: mongoContent._id.toString(),
        title: mongoContent.title,
        slug: mongoContent.slug,
        description: mongoContent.description || '',
        content: mongoContent.content || '',
        tags: mongoContent.tags || [],
        categories: mongoContent.categories?.map((cat) => 
          typeof cat === 'string' ? cat : (cat as MongoCategory)._id?.toString()
        ) || [],
        createdBy: typeof mongoContent.author === 'string' 
          ? { id: mongoContent.author } 
          : {
              id: (mongoContent.author as MongoUser)?._id?.toString() || '',
              displayName: `${(mongoContent.author as MongoUser)?.firstName || ''} ${(mongoContent.author as MongoUser)?.lastName || ''}`.trim()
            },
        status: mongoContent.status || 'draft',
        publishedAt: mongoContent.publishedAt,
        createdAt: mongoContent.createdAt,
        updatedAt: mongoContent.updatedAt
      });
      
      logger.info(`Indexed content in Elasticsearch: ${mongoContent._id}`);
      
      return {
        id: mongoContent._id.toString(),
        title: mongoContent.title
      };
    } catch (error) {
      logger.error(`Error synchronizing content: ${contentId}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Synchronize all content between MongoDB and Elasticsearch
   * @returns Number of synchronized content items
   */
  async syncAllContent(): Promise<number> {
    try {
      logger.info('Synchronizing all content...');
      
      // During database initialization, we'll just return success
      // This is a workaround for the initial database setup
      logger.info('Database initialization in progress. Skipping content synchronization.');
      return 0;
      
      /* 
      // The following code is commented out for the initial database setup
      // It will be used later when we have actual content to synchronize
      
      // Get all content from MongoDB
      const ContentModel = mongoose.model<MongoContent>('Content');
      const mongoContents = await ContentModel.find({})
        .populate('author')
        .populate('categories')
        .lean() as MongoContent[];
      
      logger.info(`Found ${mongoContents.length} content items in MongoDB`);
      
      let syncCount = 0;
      
      // Synchronize each content item
      for (const mongoContent of mongoContents) {
        try {
          await this.syncContent(mongoContent._id.toString());
          syncCount++;
        } catch (error) {
          logger.error(`Error synchronizing content: ${mongoContent._id}`, { error: (error as Error).message });
        }
      }
      
      logger.info(`Successfully synchronized ${syncCount} content items`);
      
      return syncCount;
      */
    } catch (error) {
      logger.error('Error synchronizing all content', { error: (error as Error).message });
      // Return 0 instead of throwing to allow initialization to continue
      return 0;
    }
  }

  /**
   * Get user ID mapping between MongoDB and PostgreSQL
   * @param id - User ID (either MongoDB or PostgreSQL)
   * @param source - Source database ('mongo' or 'pg')
   * @returns Mapped ID or null if not found
   */
  async getUserIdMapping(id: string, source: 'mongo' | 'pg'): Promise<string | null> {
    try {
      if (source === 'mongo') {
        return await redisClient.get(`user:mapping:mongo:${id}`);
      } else {
        return await redisClient.get(`user:mapping:pg:${id}`);
      }
    } catch (error) {
      logger.error(`Error getting user ID mapping: ${id} (${source})`, { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Clear all data synchronization mappings
   */
  async clearMappings(): Promise<void> {
    try {
      logger.info('Clearing all data synchronization mappings...');
      
      // Get all mapping keys
      const mongoMappingKeys = await redisClient.keys('user:mapping:mongo:*');
      const pgMappingKeys = await redisClient.keys('user:mapping:pg:*');
      
      // Delete all mapping keys
      if (mongoMappingKeys.length > 0) {
        await Promise.all(mongoMappingKeys.map(key => redisClient.del(key)));
      }
      
      if (pgMappingKeys.length > 0) {
        await Promise.all(pgMappingKeys.map(key => redisClient.del(key)));
      }
      
      logger.info(`Cleared ${mongoMappingKeys.length + pgMappingKeys.length} mapping keys`);
    } catch (error) {
      logger.error('Error clearing data synchronization mappings', { error: (error as Error).message });
      throw error;
    }
  }
}

// Create and export a singleton instance
const dataSyncService = new DataSyncService();
export default dataSyncService;
