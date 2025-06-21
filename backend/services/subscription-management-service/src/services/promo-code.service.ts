import { FindOptionsWhere, Repository, Like } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { PromoCode } from '../entities/PromoCode.entity';
import { SubscriptionPromoCode } from '../entities/SubscriptionPromoCode.entity';
import { PromoCodeApplicablePlan } from '../entities/PromoCodeApplicablePlan.entity';
import { PromoCodeApplicableUser } from '../entities/PromoCodeApplicableUser.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import logger from '../utils/logger';
import { promoCache } from '../utils/redis';

interface QueryFilters {
  page?: number;
  status?: string;
  search?: string;
  sort?: string;
}

interface PromoCodesResponse {
  items: PromoCode[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}

export class PromoCodeService {
  private promoCodeRepository!: Repository<PromoCode>;
  private subscriptionPromoCodeRepository!: Repository<SubscriptionPromoCode>;
  private applicablePlanRepository!: Repository<PromoCodeApplicablePlan>;
  private applicableUserRepository!: Repository<PromoCodeApplicableUser>;
  private planRepository!: Repository<SubscriptionPlan>;
  private readonly redisDb: number = 3; // Subscription service uses DB3

  constructor() {
    this.initializeRepositories();
  }

  private initializeRepositories() {
    try {
      this.promoCodeRepository = AppDataSource.getRepository(PromoCode);
      this.subscriptionPromoCodeRepository = AppDataSource.getRepository(SubscriptionPromoCode);
      this.applicablePlanRepository = AppDataSource.getRepository(PromoCodeApplicablePlan);
      this.applicableUserRepository = AppDataSource.getRepository(PromoCodeApplicableUser);
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
      logger.info(`Initialized repositories for PromoCodeService, using Redis DB${this.redisDb}`);
    } catch (error) {
      logger.error('Failed to initialize repositories in PromoCodeService:', error);
    }
  }

  private getPromoCodeRepository(): Repository<PromoCode> {
    if (!this.promoCodeRepository) {
      this.promoCodeRepository = AppDataSource.getRepository(PromoCode);
    }
    return this.promoCodeRepository;
  }

  private getSubscriptionPromoCodeRepository(): Repository<SubscriptionPromoCode> {
    if (!this.subscriptionPromoCodeRepository) {
      this.subscriptionPromoCodeRepository = AppDataSource.getRepository(SubscriptionPromoCode);
    }
    return this.subscriptionPromoCodeRepository;
  }

  private getApplicablePlanRepository(): Repository<PromoCodeApplicablePlan> {
    if (!this.applicablePlanRepository) {
      this.applicablePlanRepository = AppDataSource.getRepository(PromoCodeApplicablePlan);
    }
    return this.applicablePlanRepository;
  }

  private getApplicableUserRepository(): Repository<PromoCodeApplicableUser> {
    if (!this.applicableUserRepository) {
      this.applicableUserRepository = AppDataSource.getRepository(PromoCodeApplicableUser);
    }
    return this.applicableUserRepository;
  }

  private getPlanRepository(): Repository<SubscriptionPlan> {
    if (!this.planRepository) {
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
    }
    return this.planRepository;
  }

  /**
   * Invalidate cache for all promo codes
   */
  private async invalidatePromoCache(): Promise<void> {
    try {
      // Use a pattern that matches all promo-related keys, accounting for the prefix
      const pattern = `*`; // Match all keys under subscription:promos:
      const deletedCount = await promoCache.deleteByPattern(pattern);
      logger.info(`Invalidated ${deletedCount} cache keys for pattern: subscription:promos:* in Redis DB${this.redisDb}`);
    } catch (error) {
      logger.warn(`Failed to invalidate promo cache in Redis DB${this.redisDb}:`, error);
    }
  }

  /**
   * Invalidate cache for a specific promo code
   */
  private async invalidateSinglePromoCache(promoCodeId: string): Promise<void> {
    try {
      const cacheKey = `promo:${promoCodeId}`;
      const success = await promoCache.del(cacheKey);
      if (success) {
        logger.debug(`Deleted cache key: ${cacheKey} in Redis DB${this.redisDb}`);
      } else {
        logger.debug(`Cache key not found for deletion: ${cacheKey} in Redis DB${this.redisDb}`);
      }
      const validationPattern = `promo:validate:*:${promoCodeId}:*`;
      const deletedValidationCount = await promoCache.deleteByPattern(validationPattern);
      logger.debug(`Deleted ${deletedValidationCount} validation cache keys for pattern: subscription:promos:${validationPattern} in Redis DB${this.redisDb}`);


    } catch (error) {
      logger.warn(`Failed to invalidate cache for promo ${promoCodeId} in Redis DB${this.redisDb}:`, error);
    }
  }

  /**
   * Get all promo codes - Admin access
   */
  async getAllPromoCodes(filters: QueryFilters = {}): Promise<PromoCodesResponse> {
    try {
      const page = filters.page || 1;
      const pageSize = 10; // Match frontend pageSize
      const skip = (page - 1) * pageSize;
      const status = filters.status;
      const search = filters.search;
      const sort = filters.sort || 'createdAt_desc';

      // Build cache key
      const filterKey = JSON.stringify({ status, search, sort });
      const cacheKey = `promos:filters:${filterKey}:page:${page}`;
      const fullCacheKey = `subscription:promos:${cacheKey}`;

      // Try to get from cache
      const cachedResult = await promoCache.get<PromoCodesResponse>(cacheKey);
      if (cachedResult) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedResult;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      // Build query
      const queryBuilder = this.getPromoCodeRepository()
        .createQueryBuilder('promoCode')
        .leftJoinAndSelect('promoCode.applicablePlans', 'applicablePlans')
        .leftJoinAndSelect('promoCode.applicableUsers', 'applicableUsers');

      // Apply filters
      if (status) {
        if (status === 'active') {
          queryBuilder.andWhere('promoCode.isActive = :isActive', { isActive: true });
          queryBuilder.andWhere(
            '(promoCode.endDate IS NULL OR promoCode.endDate > :now)',
            { now: new Date() }
          );
        } else if (status === 'expired') {
          queryBuilder.andWhere(
            '(promoCode.isActive = :isActive OR promoCode.endDate < :now)',
            { isActive: false, now: new Date() }
          );
        } else if (status === 'percentage' || status === 'fixed') {
          queryBuilder.andWhere('promoCode.discountType = :discountType', { discountType: status });
        }
      }

      if (search) {
        queryBuilder.andWhere(
          '(promoCode.code LIKE :search OR promoCode.description LIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Apply sorting
      const [sortField, sortOrder] = sort.split('_');
      const orderField = sortField === 'createdAt' ? 'promoCode.createdAt' : 'promoCode.code';
      queryBuilder.orderBy(orderField, sortOrder.toUpperCase() as 'ASC' | 'DESC');

      // Get total count for pagination
      const totalItems = await queryBuilder.getCount();

      // Apply pagination
      queryBuilder.skip(skip).take(pageSize);

      // Execute query
      const promoCodes = await queryBuilder.getMany();

      const result: PromoCodesResponse = {
        items: promoCodes,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
        totalItems,
      };

      // Cache the results for 1 hour
      try {
        const success = await promoCache.set(cacheKey, result, 60 * 60);
        if (success) {
          logger.debug(`Stored promo codes in cache key: ${fullCacheKey} with TTL 1 hour in Redis DB${this.redisDb}`);
        } else {
          logger.warn(`Failed to store promo codes in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        }
      } catch (cacheError) {
        logger.warn(`Error caching promo codes for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
      }

      return result;
    } catch (error: unknown) {
      logger.error('Error getting all promo codes:', error);
      throw new Error(`Failed to fetch promo codes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get promo code by ID - Admin access
   */
  async getPromoCodeById(id: string): Promise<PromoCode | null> {
    try {
      const cacheKey = `promo:${id}`;
      const fullCacheKey = `subscription:promos:${cacheKey}`;

      // Try to get from cache first
      const cachedPromoCode = await promoCache.get<PromoCode>(cacheKey);
      if (cachedPromoCode) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedPromoCode;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      // Fetch from database
      const promoCode = await this.getPromoCodeRepository().findOne({
        where: { id },
        relations: ['applicablePlans', 'applicableUsers'],
      });

      if (promoCode) {
        // Cache the result for 1 hour
        try {
          const success = await promoCache.set(cacheKey, promoCode, 60 * 60);
          if (success) {
            logger.debug(`Stored promo code in cache key: ${fullCacheKey} with TTL 1 hour in Redis DB${this.redisDb}`);
          } else {
            logger.warn(`Failed to store promo code in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
          }
        } catch (cacheError) {
          logger.warn(`Error caching promo code for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
        }
      } else {
        logger.debug(`No promo code found for ID ${id}, not caching in Redis DB${this.redisDb}`);
      }

      return promoCode;
    } catch (error) {
      logger.error(`Error getting promo code ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new promo code - Admin access
   */
  async createPromoCode(promoCodeData: Partial<PromoCode>): Promise<PromoCode> {
    try {
      const promoCode = this.getPromoCodeRepository().create({
        ...promoCodeData,
        isActive: promoCodeData.isActive ?? true,
        usageCount: promoCodeData.usageCount ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedPromoCode = await this.getPromoCodeRepository().save(promoCode);

      // Invalidate cache to ensure fresh data
      await this.invalidatePromoCache();
      logger.info(`Created promo code with ID ${savedPromoCode.id}, invalidated cache in Redis DB${this.redisDb}`);

      return savedPromoCode;
    } catch (error) {
      logger.error('Error creating promo code:', error);
      throw error;
    }
  }

  /**
   * Update a promo code - Admin access
   */
  async updatePromoCode(id: string, promoCodeData: Partial<PromoCode>): Promise<PromoCode | null> {
    try {
      // First update the main promo code fields
      await this.getPromoCodeRepository().update(id, {
        ...promoCodeData,
        updatedAt: new Date(),
        // Remove relationship fields from update
        applicablePlans: undefined,
        applicableUsers: undefined
      });

      // If applicablePlans were provided, update them separately
      if (promoCodeData.applicablePlans) {
        // First remove existing plans
        await this.getApplicablePlanRepository().delete({ promoCodeId: id });
        // Then add new plans
        const newPlans = promoCodeData.applicablePlans.map(plan => ({
          promoCodeId: id,
          planId: plan.id
        }));
        await this.getApplicablePlanRepository().save(newPlans);
      }

      // If applicableUsers were provided, update them separately
      if (promoCodeData.applicableUsers) {
        // First remove existing users
        await this.getApplicableUserRepository().delete({ promoCodeId: id });
        // Then add new users
        const newUsers = promoCodeData.applicableUsers.map(user => ({
          promoCodeId: id,
          userId: user.id
        }));
        await this.getApplicableUserRepository().save(newUsers);
      }

      // Get the updated promo code
      const updatedPromoCode = await this.getPromoCodeById(id);

      if (updatedPromoCode) {
        // Invalidate caches
        await this.invalidatePromoCache();
        await this.invalidateSinglePromoCache(id);
        logger.info(`Updated promo code with ID ${id}, invalidated caches in Redis DB${this.redisDb}`);
      }

      return updatedPromoCode;
    } catch (error) {
      logger.error(`Error updating promo code ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a promo code - Admin access
   */
  async deletePromoCode(id: string): Promise<void> {
    try {
      const promoCode = await this.getPromoCodeById(id);
      if (!promoCode) {
        throw new Error('Promo code not found');
      }
  
      // Delete related records first to maintain referential integrity
      await this.getApplicablePlanRepository().delete({ promoCodeId: id });
      await this.getApplicableUserRepository().delete({ promoCodeId: id });
      await this.getSubscriptionPromoCodeRepository().delete({ promoCodeId: id });
  
      // Delete the promo code
      await this.getPromoCodeRepository().delete(id);
  
      // Invalidate all promo-related caches
      await this.invalidatePromoCache();
      await this.invalidateSinglePromoCache(id);
      logger.info(`Deleted promo code with ID ${id} and related records, invalidated caches in Redis DB${this.redisDb}`);
    } catch (error) {
      logger.error(`Error deleting promo code ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add applicable plans to a promo code - Admin access
   */
  async addApplicablePlans(promoCodeId: string, planIds: string[]): Promise<PromoCodeApplicablePlan[]> {
    try {
      const entries = planIds.map(planId => ({
        promoCodeId,
        planId,
      }));

      const savedEntries = await this.getApplicablePlanRepository().save(entries);

      // Invalidate caches since applicable plans affect promo code applicability
      await this.invalidatePromoCache();
      await this.invalidateSinglePromoCache(promoCodeId);
      logger.info(`Added ${planIds.length} applicable plans to promo code ${promoCodeId}, invalidated caches in Redis DB${this.redisDb}`);

      return savedEntries;
    } catch (error) {
      logger.error(`Error adding applicable plans to promo code ${promoCodeId}:`, error);
      throw error;
    }
  }

  /**
   * Add applicable users to a promo code - Admin access
   */
  async addApplicableUsers(promoCodeId: string, userIds: string[]): Promise<PromoCodeApplicableUser[]> {
    try {
      const entries = userIds.map(userId => ({
        promoCodeId,
        userId,
      }));

      const savedEntries = await this.getApplicableUserRepository().save(entries);

      // Invalidate caches since applicable users affect promo code applicability
      await this.invalidatePromoCache();
      await this.invalidateSinglePromoCache(promoCodeId);
      logger.info(`Added ${userIds.length} applicable users to promo code ${promoCodeId}, invalidated caches in Redis DB${this.redisDb}`);

      return savedEntries;
    } catch (error) {
      logger.error(`Error adding applicable users to promo code ${promoCodeId}:`, error);
      throw error;
    }
  }

  /**
   * Validate a promo code for a specific user and plan
   * Returns validation result and discount information
   */
  async validatePromoCode(code: string, userId: string, planId: string): Promise<{
    isValid: boolean;
    promoCode?: PromoCode;
    discountAmount?: number;
    message: string;
  }> {
    try {
      const cacheKey = `promo:validate:${code}:${userId}:${planId}`;
      const fullCacheKey = `subscription:promos:${cacheKey}`;

      // Try to get from cache first
      const cachedResult = await promoCache.get<{
        isValid: boolean;
        promoCode?: PromoCode;
        discountAmount?: number;
        message: string;
      }>(cacheKey);
      if (cachedResult) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedResult;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, validating promo code`);

      // Find the promo code
      const promoCode = await this.getPromoCodeRepository().findOne({
        where: { code, isActive: true },
      });

      if (!promoCode) {
        const result = { isValid: false, message: 'Invalid promo code' };
        await this.cacheValidationResult(cacheKey, fullCacheKey, result);
        return result;
      }

      // Check if expired
      if (promoCode.endDate && new Date() > new Date(promoCode.endDate)) {
        const result = { isValid: false, message: 'Promo code has expired' };
        await this.cacheValidationResult(cacheKey, fullCacheKey, result);
        return result;
      }

      // Check usage limit
      if (promoCode.usageLimit && (promoCode.usageCount || 0) >= promoCode.usageLimit) {
        const result = { isValid: false, message: 'Promo code usage limit reached' };
        await this.cacheValidationResult(cacheKey, fullCacheKey, result);
        return result;
      }

      // Check applicable type
      if (promoCode.applicableTo === 'specific_plans') {
        const planMatch = await this.getApplicablePlanRepository().findOne({
          where: { promoCodeId: promoCode.id, planId },
        });

        if (!planMatch) {
          const result = { isValid: false, message: 'Promo code not applicable to this plan' };
          await this.cacheValidationResult(cacheKey, fullCacheKey, result);
          return result;
        }
      }

      if (promoCode.applicableTo === 'specific_users') {
        const userMatch = await this.getApplicableUserRepository().findOne({
          where: { promoCodeId: promoCode.id, userId },
        });

        if (!userMatch) {
          const result = { isValid: false, message: 'Promo code not applicable to this user' };
          await this.cacheValidationResult(cacheKey, fullCacheKey, result);
          return result;
        }
      }

      // Check if first-time only
      if (promoCode.isFirstTimeOnly) {
        const previousUsage = await this.getSubscriptionPromoCodeRepository().findOne({
          where: { promoCodeId: promoCode.id } as FindOptionsWhere<SubscriptionPromoCode>,
        });

        if (previousUsage) {
          const result = { isValid: false, message: 'Promo code can only be used once per user' };
          await this.cacheValidationResult(cacheKey, fullCacheKey, result);
          return result;
        }
      }

      // Calculate discount
      const plan = await this.getPlanRepository().findOne({ where: { id: planId } });
      if (!plan) {
        const result = { isValid: false, message: 'Invalid subscription plan' };
        await this.cacheValidationResult(cacheKey, fullCacheKey, result);
        return result;
      }

      const discountAmount = this.calculateDiscount(promoCode, plan.price);
      const result = {
        isValid: true,
        promoCode,
        discountAmount,
        message: 'Promo code applied successfully',
      };

      // Cache the result for 5 minutes
      await this.cacheValidationResult(cacheKey, fullCacheKey, result, 60 * 5);

      return result;
    } catch (error) {
      logger.error(`Error validating promo code ${code}:`, error);
      throw error;
    }
  }

  /**
   * Helper method to cache validation results
   */
  private async cacheValidationResult(
    cacheKey: string,
    fullCacheKey: string,
    result: { isValid: boolean; promoCode?: PromoCode; discountAmount?: number; message: string },
    ttl: number = 60 * 5
  ): Promise<void> {
    try {
      const success = await promoCache.set(cacheKey, result, ttl);
      if (success) {
        logger.debug(`Stored validation result in cache key: ${fullCacheKey} with TTL ${ttl / 60} minutes in Redis DB${this.redisDb}`);
      } else {
        logger.warn(`Failed to store validation result in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
      }
    } catch (cacheError) {
      logger.warn(`Error caching validation result for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
    }
  }

  /**
   * Apply a promo code to a subscription
   */
  async applyPromoCode(subscriptionId: string, userId: string, promoCodeId: string, discountAmount: number): Promise<SubscriptionPromoCode> {
    try {
      // Increment usage count
      await this.getPromoCodeRepository().increment(
        { id: promoCodeId },
        'usageCount',
        1
      );

      // Create subscription-promo code link
      const subscriptionPromoCode = this.getSubscriptionPromoCodeRepository().create({
        promoCode: { id: promoCodeId } as PromoCode,
        discountAmount,
        appliedDate: new Date(),
        isActive: true,
      });

      const savedPromoCode = await this.getSubscriptionPromoCodeRepository().save(subscriptionPromoCode);

      // Invalidate caches since usage count affects validation
      await this.invalidatePromoCache();
      await this.invalidateSinglePromoCache(promoCodeId);
      logger.info(`Applied promo code ${promoCodeId} to subscription ${subscriptionId}, invalidated caches in Redis DB${this.redisDb}`);

      return savedPromoCode;
    } catch (error) {
      logger.error(`Error applying promo code ${promoCodeId} to subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate discount amount based on promo code type and plan price
   */
  private calculateDiscount(promoCode: PromoCode, planPrice: number): number {
    if (promoCode.discountType === 'percentage') {
      let discount = (planPrice * promoCode.discountValue) / 100;
      if (promoCode.maxDiscountAmount) {
        discount = Math.min(discount, promoCode.maxDiscountAmount);
      }
      return discount;
    } else if (promoCode.discountType === 'fixed') {
      return Math.min(promoCode.discountValue, planPrice);
    }
    return 0;
  }
}

export default new PromoCodeService();