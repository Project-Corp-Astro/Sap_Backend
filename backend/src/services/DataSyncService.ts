/**
 * Data Synchronization Service
 * Provides functionality to synchronize data between different databases
 * in the hybrid database architecture (MongoDB, PostgreSQL, Elasticsearch)
 */

import { createServiceLogger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redis';
import { getRepository } from 'typeorm';
import mongoose from 'mongoose';
import { User } from '../entities/User.entity';
import { Role } from '../entities/Role.entity';
import { Permission } from '../entities/Permission.entity';
import searchService from './SearchService';

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
      const UserModel = mongoose.model('User');
      const mongoUser = await UserModel.findById(userId).populate('role').lean();
      
      if (!mongoUser) {
        throw new Error(`User not found in MongoDB: ${userId}`);
      }
      
      // Get or create role in PostgreSQL
      const roleRepository = getRepository(Role);
      let pgRole = await roleRepository.findOne({ where: { name: mongoUser.role?.name || 'user' } });
      
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
        // Create user in PostgreSQL
        pgUser = userRepository.create({
          email: mongoUser.email,
          passwordHash: mongoUser.password || '',
          firstName: mongoUser.firstName || '',
          lastName: mongoUser.lastName || '',
          isVerified: mongoUser.isVerified || false,
          isActive: mongoUser.isActive !== false,
          role: pgRole,
          createdAt: mongoUser.createdAt,
          updatedAt: mongoUser.updatedAt
        });
        
        await userRepository.save(pgUser);
        logger.info(`Created user in PostgreSQL: ${pgUser.email}`);
      } else {
        // Update user in PostgreSQL
        pgUser.firstName = mongoUser.firstName || pgUser.firstName;
        pgUser.lastName = mongoUser.lastName || pgUser.lastName;
        pgUser.isVerified = mongoUser.isVerified || pgUser.isVerified;
        pgUser.isActive = mongoUser.isActive !== false;
        pgUser.role = pgRole;
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
      
      // Get all users from MongoDB
      const UserModel = mongoose.model('User');
      const mongoUsers = await UserModel.find({}).populate('role').lean();
      
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
    } catch (error) {
      logger.error('Error synchronizing all users', { error: (error as Error).message });
      throw error;
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
      const ContentModel = mongoose.model('Content');
      const mongoContent = await ContentModel.findById(contentId)
        .populate('author')
        .populate('categories')
        .lean();
      
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
        categories: mongoContent.categories?.map((cat: any) => 
          typeof cat === 'string' ? cat : cat._id?.toString()
        ) || [],
        createdBy: typeof mongoContent.author === 'string' 
          ? { id: mongoContent.author } 
          : {
              id: mongoContent.author?._id?.toString() || '',
              displayName: `${mongoContent.author?.firstName || ''} ${mongoContent.author?.lastName || ''}`.trim()
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
      
      // Get all content from MongoDB
      const ContentModel = mongoose.model('Content');
      const mongoContents = await ContentModel.find({})
        .populate('author')
        .populate('categories')
        .lean();
      
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
    } catch (error) {
      logger.error('Error synchronizing all content', { error: (error as Error).message });
      throw error;
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
