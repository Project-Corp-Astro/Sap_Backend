/**
 * User Repository
 * Handles data access for User entities in PostgreSQL
 */

import { FindOptionsWhere, ILike } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { User } from '../entities/User.entity';
import { createServiceLogger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redis';

const logger = createServiceLogger('user-repository');
const CACHE_TTL = 3600; // 1 hour

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User);
  }

  /**
   * Find user by email
   * @param email - User email
   * @returns User or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      // Try to get from cache first
      const cacheKey = `user:email:${email.toLowerCase()}`;
      const cachedUser = await redisClient.get(cacheKey);
      
      if (cachedUser) {
        logger.debug(`User with email ${email} found in cache`);
        return cachedUser as User;
      }
      
      // If not in cache, get from database
      const user = await this.repository.findOne({
        where: { email: email.toLowerCase() },
        relations: ['role', 'role.permissions']
      });
      
      // Store in cache if found
      if (user) {
        await redisClient.set(cacheKey, user, CACHE_TTL);
      }
      
      return user;
    } catch (error) {
      logger.error(`Error finding user by email: ${email}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Find users by role
   * @param roleId - Role ID
   * @returns Array of users
   */
  async findByRole(roleId: string): Promise<User[]> {
    try {
      return await this.repository.find({
        where: { roleId },
        relations: ['role']
      });
    } catch (error) {
      logger.error(`Error finding users by role: ${roleId}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Search users by name or email
   * @param query - Search query
   * @param limit - Maximum number of results
   * @param offset - Offset for pagination
   * @returns Array of users
   */
  async search(query: string, limit: number = 10, offset: number = 0): Promise<{ users: User[], total: number }> {
    try {
      const searchQuery = `%${query}%`;
      
      const [users, total] = await this.repository.findAndCount({
        where: [
          { email: ILike(searchQuery) },
          { firstName: ILike(searchQuery) },
          { lastName: ILike(searchQuery) }
        ],
        take: limit,
        skip: offset,
        order: {
          createdAt: 'DESC'
        }
      });
      
      return { users, total };
    } catch (error) {
      logger.error(`Error searching users with query: ${query}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get active users
   * @returns Array of active users
   */
  async getActiveUsers(): Promise<User[]> {
    try {
      return await this.repository.find({
        where: { isActive: true },
        order: {
          lastLogin: 'DESC'
        }
      });
    } catch (error) {
      logger.error('Error getting active users', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Override create method to handle cache
   * @param data - User data
   * @returns Created user
   */
  async create(data: Partial<User>): Promise<User> {
    try {
      const user = await super.create(data);
      
      // Invalidate cache
      if (user.email) {
        await redisClient.del(`user:email:${user.email.toLowerCase()}`);
      }
      
      return user;
    } catch (error) {
      logger.error('Error creating user', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Override update method to handle cache
   * @param id - User ID
   * @param data - User data
   * @returns Updated user
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    try {
      const user = await super.update(id, data);
      
      // Invalidate cache
      if (user.email) {
        await redisClient.del(`user:email:${user.email.toLowerCase()}`);
      }
      await redisClient.del(`user:id:${id}`);
      
      return user;
    } catch (error) {
      logger.error(`Error updating user with ID: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Override delete method to handle cache
   * @param id - User ID
   * @returns True if user was deleted
   */
  async delete(id: string): Promise<boolean> {
    try {
      // Get user before deleting to invalidate cache
      const user = await this.findById(id);
      const result = await super.delete(id);
      
      // Invalidate cache
      if (user && user.email) {
        await redisClient.del(`user:email:${user.email.toLowerCase()}`);
      }
      await redisClient.del(`user:id:${id}`);
      
      return result;
    } catch (error) {
      logger.error(`Error deleting user with ID: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }
}
