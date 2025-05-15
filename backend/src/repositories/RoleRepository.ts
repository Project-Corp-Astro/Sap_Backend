/**
 * Role Repository
 * Handles data access for Role entities in PostgreSQL
 */

import { BaseRepository } from './BaseRepository';
import { Role } from '../entities/Role.entity';
import { Permission } from '../entities/Permission.entity';
import { In } from 'typeorm';
import { createServiceLogger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redis';

const logger = createServiceLogger('role-repository');
const CACHE_TTL = 3600; // 1 hour

export class RoleRepository extends BaseRepository<Role> {
  constructor() {
    super(Role);
  }

  /**
   * Find role by name
   * @param name - Role name
   * @returns Role or null if not found
   */
  async findByName(name: string): Promise<Role | null> {
    try {
      // Try to get from cache first
      const cacheKey = `role:name:${name}`;
      const cachedRole = await redisClient.get(cacheKey);
      
      if (cachedRole) {
        logger.debug(`Role with name ${name} found in cache`);
        return cachedRole as Role;
      }
      
      // If not in cache, get from database
      const role = await this.repository.findOne({
        where: { name },
        relations: ['permissions']
      });
      
      // Store in cache if found
      if (role) {
        await redisClient.set(cacheKey, role, CACHE_TTL);
      }
      
      return role;
    } catch (error) {
      logger.error(`Error finding role by name: ${name}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get all roles with permissions
   * @returns Array of roles with permissions
   */
  async getAllWithPermissions(): Promise<Role[]> {
    try {
      // Try to get from cache first
      const cacheKey = 'roles:all:with-permissions';
      const cachedRoles = await redisClient.get(cacheKey);
      
      if (cachedRoles) {
        logger.debug('All roles with permissions found in cache');
        return cachedRoles as Role[];
      }
      
      // If not in cache, get from database
      const roles = await this.repository.find({
        relations: ['permissions'],
        order: {
          name: 'ASC'
        }
      });
      
      // Store in cache
      await redisClient.set(cacheKey, roles, CACHE_TTL);
      
      return roles;
    } catch (error) {
      logger.error('Error getting all roles with permissions', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Add permission to role
   * @param roleId - Role ID
   * @param permissionId - Permission ID
   * @returns Updated role
   */
  async addPermission(roleId: string, permissionId: string): Promise<Role> {
    try {
      const role = await this.repository.findOne({
        where: { id: roleId },
        relations: ['permissions']
      });
      
      if (!role) {
        throw new Error(`Role with ID ${roleId} not found`);
      }
      
      const permissionRepository = this.repository.manager.getRepository(Permission);
      const permission = await permissionRepository.findOneBy({ id: permissionId });
      
      if (!permission) {
        throw new Error(`Permission with ID ${permissionId} not found`);
      }
      
      // Check if permission already exists
      const hasPermission = role.permissions.some(p => p.id === permissionId);
      
      if (!hasPermission) {
        role.permissions.push(permission);
        await this.repository.save(role);
      }
      
      // Invalidate cache
      await redisClient.del(`role:id:${roleId}`);
      await redisClient.del(`role:name:${role.name}`);
      await redisClient.del('roles:all:with-permissions');
      
      return role;
    } catch (error) {
      logger.error(`Error adding permission ${permissionId} to role ${roleId}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Remove permission from role
   * @param roleId - Role ID
   * @param permissionId - Permission ID
   * @returns Updated role
   */
  async removePermission(roleId: string, permissionId: string): Promise<Role> {
    try {
      const role = await this.repository.findOne({
        where: { id: roleId },
        relations: ['permissions']
      });
      
      if (!role) {
        throw new Error(`Role with ID ${roleId} not found`);
      }
      
      // Remove permission
      role.permissions = role.permissions.filter(p => p.id !== permissionId);
      await this.repository.save(role);
      
      // Invalidate cache
      await redisClient.del(`role:id:${roleId}`);
      await redisClient.del(`role:name:${role.name}`);
      await redisClient.del('roles:all:with-permissions');
      
      return role;
    } catch (error) {
      logger.error(`Error removing permission ${permissionId} from role ${roleId}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Set permissions for role
   * @param roleId - Role ID
   * @param permissionIds - Array of permission IDs
   * @returns Updated role
   */
  async setPermissions(roleId: string, permissionIds: string[]): Promise<Role> {
    try {
      const role = await this.repository.findOne({
        where: { id: roleId },
        relations: ['permissions']
      });
      
      if (!role) {
        throw new Error(`Role with ID ${roleId} not found`);
      }
      
      const permissionRepository = this.repository.manager.getRepository(Permission);
      const permissions = await permissionRepository.findBy({ id: In(permissionIds) });
      
      role.permissions = permissions;
      await this.repository.save(role);
      
      // Invalidate cache
      await redisClient.del(`role:id:${roleId}`);
      await redisClient.del(`role:name:${role.name}`);
      await redisClient.del('roles:all:with-permissions');
      
      return role;
    } catch (error) {
      logger.error(`Error setting permissions for role ${roleId}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Override create method to handle cache
   * @param data - Role data
   * @returns Created role
   */
  async create(data: Partial<Role>): Promise<Role> {
    try {
      const role = await super.create(data);
      
      // Invalidate cache
      await redisClient.del('roles:all:with-permissions');
      
      return role;
    } catch (error) {
      logger.error('Error creating role', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Override update method to handle cache
   * @param id - Role ID
   * @param data - Role data
   * @returns Updated role
   */
  async update(id: string, data: Partial<Role>): Promise<Role> {
    try {
      const role = await super.update(id, data);
      
      // Invalidate cache
      await redisClient.del(`role:id:${id}`);
      if (role.name) {
        await redisClient.del(`role:name:${role.name}`);
      }
      await redisClient.del('roles:all:with-permissions');
      
      return role;
    } catch (error) {
      logger.error(`Error updating role with ID: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Override delete method to handle cache
   * @param id - Role ID
   * @returns True if role was deleted
   */
  async delete(id: string): Promise<boolean> {
    try {
      // Get role before deleting to invalidate cache
      const role = await this.findById(id);
      const result = await super.delete(id);
      
      // Invalidate cache
      await redisClient.del(`role:id:${id}`);
      if (role && role.name) {
        await redisClient.del(`role:name:${role.name}`);
      }
      await redisClient.del('roles:all:with-permissions');
      
      return result;
    } catch (error) {
      logger.error(`Error deleting role with ID: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }
}
