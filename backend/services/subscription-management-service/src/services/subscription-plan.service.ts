import { FindOptionsWhere, Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { PlanStatus } from '../entities/SubscriptionPlan.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import { PlanFeature } from '../entities/PlanFeature.entity';
import logger from '../utils/logger';
import { planCache } from '../utils/redis';

export class SubscriptionPlanService {
  private planRepository!: Repository<SubscriptionPlan>;
  private featureRepository!: Repository<PlanFeature>;
  private readonly redisDb: number = 3; // Subscription service uses DB3

  constructor() {
    this.initializeRepositories();
  }

  private initializeRepositories() {
    try {
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
      this.featureRepository = AppDataSource.getRepository(PlanFeature);
      logger.info(`Initialized repositories for SubscriptionPlanService, using Redis DB${this.redisDb}`);
    } catch (error) {
      logger.error('Failed to initialize repositories in SubscriptionPlanService:', error);
    }
  }

  private getPlanRepository(): Repository<SubscriptionPlan> {
    if (!this.planRepository) {
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
    }
    return this.planRepository;
  }

  private getFeatureRepository(): Repository<PlanFeature> {
    if (!this.featureRepository) {
      this.featureRepository = AppDataSource.getRepository(PlanFeature);
    }
    return this.featureRepository;
  }

  /**
   * Invalidate cache for all plans or a specific appId
   */
  private async invalidatePlanCache(appId?: string): Promise<void> {
    try {
      const pattern = appId ? `plans:${appId}:*` : `plans:*`;
      const fullPattern = `subscription:plans:${pattern}`;
      const deletedCount = await planCache.deleteByPattern(pattern);
      logger.info(`Invalidated ${deletedCount} cache keys for pattern: ${fullPattern} in Redis DB${this.redisDb}`);
    } catch (error) {
      logger.warn(`Failed to invalidate plan cache for appId=${appId || 'all'} in Redis DB${this.redisDb}:`, error);
    }
  }

  /**
   * Invalidate cache for a specific plan
   */
  private async invalidateSinglePlanCache(planId: string): Promise<void> {
    try {
      const cacheKey = `plan:${planId}`;
      const fullCacheKey = `subscription:plans:${cacheKey}`;
      const success = await planCache.del(cacheKey);
      if (success) {
        logger.debug(`Deleted cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
      } else {
        logger.debug(`Cache key not found for deletion: ${fullCacheKey} in Redis DB${this.redisDb}`);
      }
    } catch (error) {
      logger.warn(`Failed to invalidate cache for plan ${planId} in Redis DB${this.redisDb}:`, error);
    }
  }

  /**
   * Get all subscription plans
   * For admin access or filtered by appId for regular users
   */
  async getAllPlans(appId?: string, includeInactive = false): Promise<SubscriptionPlan[]> {
    try {
      const cacheKey = `plans:${appId || 'all'}:${includeInactive ? 'all' : 'active'}`;
      const fullCacheKey = `subscription:plans:${cacheKey}`;

      // Try to get from cache first
      const cachedPlans = await planCache.get<SubscriptionPlan[]>(cacheKey);
      if (cachedPlans) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedPlans;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      const where: any = {};
      if (appId) {
        where.appId = appId;
      }
      if (!includeInactive) {
        where.status = PlanStatus.ACTIVE;
      }

      // Get plans with features from database
      const plans = await this.getPlanRepository()
        .createQueryBuilder('plan')
        .leftJoinAndSelect('plan.features', 'features')
        .where(where)
        .getMany();

      // Cache the results for 1 hour
      try {
        const success = await planCache.set(cacheKey, plans, 60 * 60); // Cache for 1 hour
        if (success) {
          logger.debug(`Stored ${plans.length} plans in cache key: ${fullCacheKey} with TTL 1 hour in Redis DB${this.redisDb}`);
        } else {
          logger.warn(`Failed to store plans in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        }
      } catch (cacheError) {
        logger.warn(`Error caching plans for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
      }

      return plans;
    } catch (error) {
      logger.error('Error in getAllPlans:', error);
      throw error;
    }
  }

  /**
   * Get a specific plan by ID
   */
  async getPlanById(id: string): Promise<SubscriptionPlan | null> {
    try {
      const cacheKey = `plan:${id}`;
      const fullCacheKey = `subscription:plans:${cacheKey}`;

      // Try to get from cache first
      const cachedPlan = await planCache.get<SubscriptionPlan>(cacheKey);
      if (cachedPlan) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedPlan;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      // Fetch from database
      const plan = await this.getPlanRepository().findOne({
        where: { id },
        relations: ['features'],
      });

      if (plan) {
        // Cache the result for 1 hour
        try {
          const success = await planCache.set(cacheKey, plan, 60 * 60); // Cache for 1 hour
          if (success) {
            logger.debug(`Stored plan in cache key: ${fullCacheKey} with TTL 1 hour in Redis DB${this.redisDb}`);
          } else {
            logger.warn(`Failed to store plan in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
          }
        } catch (cacheError) {
          logger.warn(`Error caching plan for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
        }
      } else {
        logger.debug(`No plan found for ID ${id}, not caching in Redis DB${this.redisDb}`);
      }

      return plan;
    } catch (error) {
      logger.error(`Error getting subscription plan ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new subscription plan - Admin access
   */
  async createPlan(planData: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    try {
      const plan = this.getPlanRepository().create({
        ...planData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedPlan = await this.getPlanRepository().save(plan);

      // Invalidate cache to ensure fresh data
      await this.invalidatePlanCache(planData.appId);
      logger.info(`Created plan with ID ${savedPlan.id}, invalidated cache for appId=${planData.appId || 'all'} in Redis DB${this.redisDb}`);

      return savedPlan;
    } catch (error) {
      logger.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  /**
   * Update an existing subscription plan - Admin access
   */
  async updatePlan(id: string, planData: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | null> {
    try {
      const { createdAt, ...updateData } = planData as any;
      updateData.updatedAt = new Date();

      await this.getPlanRepository().update({ id }, updateData);
      const updatedPlan = await this.getPlanById(id);

      if (updatedPlan) {
        // Invalidate caches
        await this.invalidatePlanCache(updatedPlan.appId);
        await this.invalidateSinglePlanCache(id);
        logger.info(`Updated plan with ID ${id}, invalidated caches in Redis DB${this.redisDb}`);
      }

      return updatedPlan;
    } catch (error) {
      logger.error(`Error updating subscription plan ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a subscription plan - Admin access
   * Typically plans are just marked as inactive rather than deleted
   */
  async deletePlan(id: string): Promise<void> {
    try {
      const plan = await this.getPlanById(id);
      if (!plan) {
        throw new Error('Plan not found');
      }

      await this.getPlanRepository().update(
        { id },
        {
          status: PlanStatus.ARCHIVED,
          updatedAt: new Date(),
        }
      );

      // Invalidate caches
      await this.invalidatePlanCache(plan.appId);
      await this.invalidateSinglePlanCache(id);
      logger.info(`Archived plan with ID ${id}, invalidated caches in Redis DB${this.redisDb}`);
    } catch (error) {
      logger.error(`Error deleting subscription plan ${id}:`, error);
      throw error;
    }
  }

  /**
   * Hard delete a plan - Super Admin only
   */
  async hardDeletePlan(id: string): Promise<void> {
    try {
      const plan = await this.getPlanById(id);
      if (!plan) {
        throw new Error('Plan not found');
      }

      await this.getPlanRepository().delete({ id });

      // Invalidate caches
      await this.invalidatePlanCache(plan.appId);
      await this.invalidateSinglePlanCache(id);
      logger.info(`Hard deleted plan with ID ${id}, invalidated caches in Redis DB${this.redisDb}`);
    } catch (error) {
      logger.error(`Error hard deleting subscription plan ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add a feature to a subscription plan - Admin access
   */
  async addFeature(planId: string, featureData: Partial<PlanFeature>): Promise<PlanFeature> {
    try {
      const plan = await this.getPlanRepository().findOne({ where: { id: planId } });
      if (!plan) {
        throw new Error('Subscription plan not found');
      }

      const feature = this.getFeatureRepository().create({
        ...featureData,
        planId,
        createdAt: new Date(),
      });

      const savedFeature = await this.getFeatureRepository().save(feature);

      // Invalidate caches since features are included in plan data
      await this.invalidatePlanCache(plan.appId);
      await this.invalidateSinglePlanCache(planId);
      logger.info(`Added feature to plan ${planId}, invalidated caches in Redis DB${this.redisDb}`);

      return savedFeature;
    } catch (error) {
      logger.error(`Error adding feature to plan ${planId}:`, error);
      throw error;
    }
  }

  /**
   * Update a plan feature - Admin access
   */
  async updateFeature(featureId: string, featureData: Partial<PlanFeature>): Promise<PlanFeature | null> {
    try {
      await this.getFeatureRepository().update({ id: featureId }, featureData);
      const updatedFeature = await this.getFeatureRepository().findOne({ where: { id: featureId } });

      if (updatedFeature) {
        // Find the associated plan to invalidate caches
        const feature = await this.getFeatureRepository().findOne({
          where: { id: featureId },
          relations: ['plan'],
        });
        if (feature?.planId) {
          const plan = await this.getPlanRepository().findOne({ where: { id: feature.planId } });
          await this.invalidatePlanCache(plan?.appId);
          await this.invalidateSinglePlanCache(feature.planId);
          logger.info(`Updated feature ${featureId}, invalidated caches in Redis DB${this.redisDb}`);
        }
      }

      return updatedFeature;
    } catch (error) {
      logger.error(`Error updating feature ${featureId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a plan feature - Admin access
   */
  async deleteFeature(featureId: string): Promise<void> {
    try {
      const feature = await this.getFeatureRepository().findOne({
        where: { id: featureId },
        relations: ['plan'],
      });
      if (!feature) {
        throw new Error('Feature not found');
      }

      await this.getFeatureRepository().delete({ id: featureId });

      // Invalidate caches
      if (feature.planId) {
        const plan = await this.getPlanRepository().findOne({ where: { id: feature.planId } });
        await this.invalidatePlanCache(plan?.appId);
        await this.invalidateSinglePlanCache(feature.planId);
        logger.info(`Deleted feature ${featureId}, invalidated caches in Redis DB${this.redisDb}`);
      }
    } catch (error) {
      logger.error(`Error deleting feature ${featureId}:`, error);
      throw error;
    }
  }
}

export default new SubscriptionPlanService();