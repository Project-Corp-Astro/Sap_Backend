/**
 * Base Repository
 * Provides common CRUD operations for all repositories
 */

import { Repository, FindOptionsWhere, FindManyOptions, DeepPartial } from 'typeorm';
import typeORMManager from '../../shared/utils/typeorm';
import { createServiceLogger } from '../../shared/utils/logger';

const logger = createServiceLogger('base-repository');

export class BaseRepository<T> {
  protected repository: Repository<T>;
  protected entityName: string;

  constructor(entityClass: any) {
    this.repository = typeORMManager.getRepository(entityClass);
    this.entityName = entityClass.name;
  }

  /**
   * Find entity by ID
   * @param id - Entity ID
   * @returns Entity or null if not found
   */
  async findById(id: string): Promise<T | null> {
    try {
      return await this.repository.findOneBy({ id } as unknown as FindOptionsWhere<T>);
    } catch (error) {
      logger.error(`Error finding ${this.entityName} by ID: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Find entities by criteria
   * @param options - Find options
   * @returns Array of entities
   */
  async find(options?: FindManyOptions<T>): Promise<T[]> {
    try {
      return await this.repository.find(options);
    } catch (error) {
      logger.error(`Error finding ${this.entityName} entities`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Find one entity by criteria
   * @param where - Where criteria
   * @returns Entity or null if not found
   */
  async findOne(where: FindOptionsWhere<T>): Promise<T | null> {
    try {
      return await this.repository.findOneBy(where);
    } catch (error) {
      logger.error(`Error finding one ${this.entityName} entity`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Count entities by criteria
   * @param where - Where criteria
   * @returns Count of entities
   */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    try {
      return await this.repository.countBy(where || {});
    } catch (error) {
      logger.error(`Error counting ${this.entityName} entities`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Create entity
   * @param data - Entity data
   * @returns Created entity
   */
  async create(data: DeepPartial<T>): Promise<T> {
    try {
      const entity = this.repository.create(data);
      return await this.repository.save(entity as any);
    } catch (error) {
      logger.error(`Error creating ${this.entityName} entity`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update entity
   * @param id - Entity ID
   * @param data - Entity data
   * @returns Updated entity
   */
  async update(id: string, data: DeepPartial<T>): Promise<T> {
    try {
      const entity = await this.findById(id);
      
      if (!entity) {
        throw new Error(`${this.entityName} with ID ${id} not found`);
      }
      
      const updatedEntity = this.repository.merge(entity, data as any);
      return await this.repository.save(updatedEntity as any);
    } catch (error) {
      logger.error(`Error updating ${this.entityName} entity with ID: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Delete entity
   * @param id - Entity ID
   * @returns True if entity was deleted
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.repository.delete(id);
      return result.affected > 0;
    } catch (error) {
      logger.error(`Error deleting ${this.entityName} entity with ID: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Soft delete entity (if supported)
   * @param id - Entity ID
   * @returns True if entity was soft deleted
   */
  async softDelete(id: string): Promise<boolean> {
    try {
      const result = await this.repository.softDelete(id);
      return result.affected > 0;
    } catch (error) {
      logger.error(`Error soft deleting ${this.entityName} entity with ID: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Restore soft deleted entity (if supported)
   * @param id - Entity ID
   * @returns True if entity was restored
   */
  async restore(id: string): Promise<boolean> {
    try {
      const result = await this.repository.restore(id);
      return result.affected > 0;
    } catch (error) {
      logger.error(`Error restoring ${this.entityName} entity with ID: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }
}
