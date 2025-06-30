import { FindOptionsWhere, Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { PlanStatus, BillingCycle } from '../entities/SubscriptionPlan.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import { PlanFeature } from '../entities/PlanFeature.entity';
import logger from '../utils/logger';
import { planCache } from '../utils/redis';
import { SubscriptionPlanServiceError, SubscriptionPlanError } from '../types/subscription-plan.errors';
import { App } from '../entities/App.entity';
import { NotFoundError, BadRequestError } from '../errors/api-error';

export class SubscriptionPlanService {
  private planRepository!: Repository<SubscriptionPlan>;
  private featureRepository!: Repository<PlanFeature>;
  private appRepository!: Repository<App>;
  private readonly redisDb: number = 3; // Subscription service uses DB3

  constructor() {
    this.initializeRepositories();
  }

  private async initializeRepositories() {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        logger.info('Database connection initialized');
      }
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
      this.featureRepository = AppDataSource.getRepository(PlanFeature);
      this.appRepository = AppDataSource.getRepository(App);
      logger.info(`Initialized repositories for SubscriptionPlanService, using Redis DB${this.redisDb}`);
    } catch (error: any) {
      logger.error('Failed to initialize repositories in SubscriptionPlanService:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get all apps for dropdown
   * @returns Array of {id, name} objects
   */
  async getAppsForDropdown(): Promise<{ id: string; name: string; color: string; logo: string }[]> {
    try {
      const cacheKey = 'apps:dropdown';
      const fullCacheKey = `subscription:apps:${cacheKey}`;

      // Try to get from cache first
      const cachedResult = await planCache.get<{ id: string; name: string; color: string; logo: string }[]>(cacheKey).catch((cacheError: Error) => {
        logger.warn(`Error fetching from cache for key ${fullCacheKey} in Redis DB${this.redisDb}:`, {
          error: cacheError.message,
          stack: cacheError.stack,
        });
        return null;
      });

      if (cachedResult) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedResult;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      // Get apps from database
      const apps = await this.appRepository.find({
        select: ['id', 'name', 'color', 'logo'],
        order: { name: 'ASC' }
      });

      // Transform to dropdown format
      const dropdownApps = apps.map(app => ({
        id: app.id,
        name: app.name,
        color: app.color,
        logo: app.logo
      }));

      // Cache the results for 1 hour
      try {
        const success = await planCache.set(cacheKey, dropdownApps, 60 * 60); // Cache for 1 hour
        if (success) {
          logger.debug(`Stored apps dropdown in cache key: ${fullCacheKey} with TTL 1 hour in Redis DB${this.redisDb}`);
        } else {
          logger.warn(`Failed to store apps dropdown in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        }
      } catch (cacheError: any) {
        logger.error(`Error caching apps dropdown for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
      }

      return dropdownApps;
    } catch (error: any) {
      logger.error('Error fetching apps for dropdown:', {
        error: error.message,
        stack: error.stack,
      });
      throw new SubscriptionPlanServiceError(SubscriptionPlanError.VALIDATION_FAILED, 'Failed to fetch apps');
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
   * Invalidate cache for plan-related data
   * @param planId Optional specific plan ID to invalidate
   * @param appId Optional app ID to invalidate app-specific caches
   */
  private async invalidatePlanCache(planId?: string, appId?: string): Promise<void> {
    try {
      const patterns = [
        'plans:*',                  // All plan listings and filtered lists
        'plan:*',                   // Individual plan caches
        'subscription:*:plan:*',    // Subscription data referencing plans
        'billing:*:plan:*',         // Billing data referencing plans
        'cache:plans:*',            // Miscellaneous plan caches
        'featured:plans*',          // Featured plans
        'popular:plans*'            // Popular plans
      ];

      // Add specific patterns for planId if provided
      if (planId) {
        patterns.push(
          `plan:${planId}`,                    // Specific plan
          `plans:*:${planId}`,                 // Listings containing this plan
          `subscriptions:*:plan:${planId}`,    // Subscriptions for this plan
          `billing:*:plan:${planId}`,          // Billing for this plan
          `cache:plans:${planId}`              // Direct plan cache
        );
      }

      // Add app-specific patterns if appId is provided
      if (appId) {
        patterns.push(
          `app:${appId}:plans`,     // App-specific plan lists
          `apps:${appId}:plans`,    // App-specific plan caches
          `plans:app:${appId}:*`    // Plans tied to this app
        );
      }

      let totalDeleted = 0;
      const batchSize = 50;

      // Use Set to avoid duplicate patterns
      const uniquePatterns = [...new Set(patterns)];

      for (const pattern of uniquePatterns) {
        try {
          const deleted = await planCache.deleteByPattern(pattern, batchSize);
          totalDeleted += deleted;
          if (deleted > 0) {
            logger.debug(`Invalidated ${deleted} cache keys for pattern '${pattern}' in Redis DB${this.redisDb}`);
          }
        } catch (error) {
          logger.warn(`Failed to invalidate cache for pattern '${pattern}':`, {
            error: error instanceof Error ? error.message : String(error),
            planId,
            appId
          });
        }
      }

      logger.info(`Invalidated total ${totalDeleted} plan-related cache keys in Redis DB${this.redisDb}${planId ? ` for plan ${planId}` : ''}${appId ? ` for app ${appId}` : ''}`);
    } catch (error: any) {
      logger.warn(`Failed to invalidate plan cache in Redis DB${this.redisDb}:`, {
        error: error.message,
        stack: error.stack,
        planId,
        appId
      });
    }
  }

  /**
   * Get all subscription plans with pagination and filtering
   */
  async getAllPlans(
    filters: {
      appId?: string;
      status?: PlanStatus;
      name?: string;
      description?: string;
      price?: number;
      billingCycle?: BillingCycle;
      trialDays?: number;
      sortPosition?: number;
      highlight?: string;
      includeInactive?: boolean;
    } = {
      includeInactive: false
    },
    page = 1,
    limit = 10
  ): Promise<{ plans: SubscriptionPlan[]; total: number }> {
    try {
      // Initialize filters with default values
      const finalFilters = {
        appId: filters.appId,
        status: filters.status,
        name: filters.name,
        sortPosition: filters.sortPosition,
        highlight: filters.highlight,
        billingCycle: filters.billingCycle,
        includeInactive: filters.includeInactive || false
      };

      // Validate status if provided
      const validStatuses = ['active', 'draft', 'archived'];
      if (finalFilters.status) {
        const lowerCaseStatus = finalFilters.status.toLowerCase() as PlanStatus;
        if (!validStatuses.includes(lowerCaseStatus)) {
          throw new Error(`Invalid status value. Must be one of: ${validStatuses.join(', ')}`);
        }
        finalFilters.status = lowerCaseStatus;
      }

      const cacheKey = `plans:${JSON.stringify(finalFilters)}:${page}:${limit}`;
      const fullCacheKey = `subscription:plans:${cacheKey}`;

      // Try to get from cache first
      const cachedResult = await planCache.get<{ plans: SubscriptionPlan[]; total: number }>(cacheKey).catch((cacheError: Error) => {
        logger.warn(`Error fetching from cache for key ${fullCacheKey} in Redis DB${this.redisDb}:`, {
          error: cacheError.message,
          stack: cacheError.stack,
        });
        return null;
      });

      if (cachedResult) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedResult;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      // Build where clause
      const where: FindOptionsWhere<SubscriptionPlan> = {};
      
      // Handle each filter parameter
      if (filters.appId) {
        where.appId = filters.appId;
      }
      if (filters.status) {
        where.status = filters.status;
      }
      if (filters.name) {
        where.name = filters.name;
      }
      if (filters.description) {
        where.description = filters.description;
      }
      if (filters.price !== undefined) {
        where.price = filters.price;
      }
      if (filters.billingCycle) {
        where.billingCycle = filters.billingCycle;
      }
      if (filters.trialDays !== undefined) {
        where.trialDays = filters.trialDays;
      }
      if (filters.sortPosition !== undefined) {
        where.sortPosition = filters.sortPosition;
      }
      if (filters.highlight) {
        where.highlight = filters.highlight;
      }
      if (!filters.includeInactive && !filters.status) {
        where.status = PlanStatus.ACTIVE;
      }

      // Get plans with features from database with pagination
      const [plans, total] = await this.getPlanRepository()
        .createQueryBuilder('plan')
        .leftJoinAndSelect('plan.features', 'features')
        .where(where)
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const result = { plans, total };

      // Cache the results for 5 minutes
      try {
        const success = await planCache.set(cacheKey, result, 60 * 5); // Cache for 5 minutes
        if (success) {
          logger.debug(`Stored ${plans.length} plans in cache key: ${fullCacheKey} with TTL 5 minutes in Redis DB${this.redisDb}`);
        } else {
          logger.warn(`Failed to store plans in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        }
      } catch (cacheError: any) {
        logger.warn(`Error caching plans for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
      }

      return result;
    } catch (error: any) {
      logger.error('Error in getAllPlans:', {
        error: error.message,
        stack: error.stack,
        filters: {
          appId: filters.appId,
          status: filters.status,
          name: filters.name,
          sortPosition: filters.sortPosition,
          highlight: filters.highlight,
          billingCycle: filters.billingCycle,
          includeInactive: filters.includeInactive
        },
        page,
        limit
      });
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
      const cachedPlan = await planCache.get<SubscriptionPlan>(cacheKey).catch((cacheError: Error) => {
        logger.warn(`Error fetching from cache for key ${fullCacheKey} in Redis DB${this.redisDb}:`, {
          error: cacheError.message,
          stack: cacheError.stack,
        });
        return null;
      });

      if (cachedPlan) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedPlan;
      }
      logger.debug(`Cache miss for key ${cacheKey} in Redis DB${this.redisDb}, querying database`);

      // Fetch from database
      const plan = await this.getPlanRepository().findOne({
        where: { id },
        relations: ['features'],
      });

      if (plan) {
        // Cache the result for 5 minutes
        try {
          const success = await planCache.set(cacheKey, plan, 60 * 5); // Cache for 5 minutes
          if (success) {
            logger.debug(`Stored plan in cache key: ${fullCacheKey} with TTL 5 minutes in Redis DB${this.redisDb}`);
          } else {
            logger.warn(`Failed to store plan in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
          }
        } catch (cacheError: any) {
          logger.warn(`Error caching plan for key ${fullCacheKey} in Redis DB${this.redisDb}:`, {
            error: cacheError.message,
            stack: cacheError.stack,
          });
        }
      } else {
        logger.debug(`No plan found for ID ${id}, not caching in Redis DB${this.redisDb}`);
      }

      return plan;
    } catch (error: any) {
      logger.error(`Error getting subscription plan ${id}:`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Create a new subscription plan - Admin access
   */
  async createPlan(planData: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager: EntityManager) => {
      try {
        const planRepository = transactionalEntityManager.getRepository(SubscriptionPlan);
        const featureRepository = transactionalEntityManager.getRepository(PlanFeature);

        // Business logic validation for creation
        if (!planData.features || planData.features.length === 0) {
          throw new BadRequestError('A subscription plan must have at least one feature.');
        }
        if (!planData.name || planData.name.trim() === '') {
          throw new BadRequestError('Plan name cannot be empty.');
        }
        if (!planData.appId) {
          throw new BadRequestError('A plan must be associated with an app.');
        }
        const existingPlan = await planRepository.findOne({ where: { name: planData.name, appId: planData.appId } });
        if (existingPlan) {
          throw new BadRequestError(`A plan with the name "${planData.name}" already exists for this app.`);
        }

        // Create the plan entity
        const { features, ...planOnlyData } = planData;
        const plan = planRepository.create(planOnlyData);
        const savedPlan = await transactionalEntityManager.save(plan);
        logger.debug(`Saved plan with ID ${savedPlan.id}`);

        // Process features
        const savedFeatures: PlanFeature[] = [];
        for (const feature of features!) {
          if (String(feature.id).startsWith('temp-')) {
            // Omit the temporary ID to let TypeORM generate a UUID
            logger.debug(`Omitting temporary feature ID ${feature.id} for new feature`);
            const { id: tempId, ...featureData } = feature;
            const featureToCreate = featureRepository.create({
              ...featureData,
              planId: savedPlan.id,
              createdAt: new Date(),
            });
            const savedFeature = await transactionalEntityManager.save(featureToCreate);
            savedFeatures.push(savedFeature);
            logger.debug(`Saved new feature with ID ${savedFeature.id} for plan ${savedPlan.id}`);
          } else {
            // Existing feature (should not happen in create, but handle for robustness)
            logger.warn(`Unexpected non-temporary feature ID ${feature.id} in createPlan, treating as new feature`);
            const { id: featureId, ...featureData } = feature;
            const featureToCreate = featureRepository.create({
              ...featureData,
              planId: savedPlan.id,
              createdAt: new Date(),
            });
            const savedFeature = await transactionalEntityManager.save(featureToCreate);
            savedFeatures.push(savedFeature);
            logger.debug(`Saved new feature with ID ${savedFeature.id} for plan ${savedPlan.id}`);
          }
        }

        // Attach saved features to the plan
        savedPlan.features = savedFeatures;

        // Invalidate caches
        await this.invalidatePlanCache(savedPlan.id, savedPlan.appId);
        logger.info(`Created new subscription plan with ID ${savedPlan.id}, invalidated caches in Redis DB${this.redisDb}`);

        return savedPlan;
      } catch (error: any) {
        logger.error(`Error creating subscription plan:`, {
          error: error.message,
          stack: error.stack,
          planData: {
            name: planData.name,
            appId: planData.appId,
            featureCount: planData.features?.length
          }
        });
        throw error;
      }
    });
  }

  /**
   * Update an existing subscription plan - Admin access
   */
  async updatePlan(id: string, planData: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | null> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager: EntityManager) => {
      try {
        const planRepository = transactionalEntityManager.getRepository(SubscriptionPlan);
        const featureRepository = transactionalEntityManager.getRepository(PlanFeature);

        const plan = await planRepository.findOne({ where: { id } });
        if (!plan) {
          throw new NotFoundError('Plan not found');
        }

        // Prevent duplicate plan names within the same app
        if (planData.name && planData.appId && (planData.name !== plan.name || planData.appId !== plan.appId)) {
          const existingPlan = await planRepository.findOne({ where: { name: planData.name, appId: planData.appId } });
          if (existingPlan) {
            throw new BadRequestError(`A plan with the name "${planData.name}" already exists for this app.`);
          }
        }

        // Separate features from the rest of the plan data
        const { features, ...planOnlyData } = planData;

        // 1. Update the plan's own properties
        planRepository.merge(plan, planOnlyData);
        await transactionalEntityManager.save(plan);
        logger.debug(`Updated plan with ID ${id}`);

        // 2. Handle features if they are part of the update
        if (features) {
          const existingFeatures = await featureRepository.findBy({ planId: id });
          const existingFeatureIds = existingFeatures.map(f => f.id);
          const incomingFeatureIds = features
            .map(f => f.id)
            .filter(fid => fid && !String(fid).startsWith('temp-'));

          // Features to delete
          const featuresToDelete = existingFeatureIds.filter(fid => !incomingFeatureIds.includes(fid));

          // Calculate final feature count for logging
          const finalFeatureCount = existingFeatureIds.length - featuresToDelete.length + features.filter(f => String(f.id).startsWith('temp-')).length;
          logger.debug(`Updating plan ${id} with ${finalFeatureCount} features`);
          if (featuresToDelete.length > 0) {
            await featureRepository.delete(featuresToDelete);
            logger.debug(`Deleted ${featuresToDelete.length} features for plan ${id}`);
          }

          // Features to update or create
          for (const feature of features) {
            if (String(feature.id).startsWith('temp-')) {
              // Omit the temporary ID to let TypeORM generate a UUID
              logger.debug(`Omitting temporary feature ID ${feature.id} for new feature`);
              const { id: tempId, ...featureData } = feature;
              const featureToCreate = featureRepository.create({
                ...featureData,
                planId: id,
                createdAt: new Date(),
              });
              const savedFeature = await transactionalEntityManager.save(featureToCreate);
              logger.debug(`Saved new feature with ID ${savedFeature.id} for plan ${id}`);
            } else {
              // Update existing feature
              const { id: featureId, ...featureUpdateData } = feature;
              await featureRepository.update({ id: featureId, planId: id }, featureUpdateData);
              logger.debug(`Updated feature with ID ${featureId} for plan ${id}`);
            }
          }
        }

        // Invalidate caches
        await this.invalidatePlanCache(id, planData.appId || plan.appId);
        logger.info(`Updated plan with ID ${id}, invalidated caches in Redis DB${this.redisDb}`);

        // Return the fully updated plan with its features
        const updatedPlan = await planRepository.findOne({ where: { id }, relations: ['features'] });
        return updatedPlan;
      } catch (error: any) {
        logger.error(`Error updating subscription plan ${id}:`, {
          error: error.message,
          stack: error.stack,
          planData: {
            name: planData.name,
            appId: planData.appId,
            featureCount: planData.features?.length
          }
        });
        throw error;
      }
    });
  }

  /**
   * Delete a plan - Admin access (soft delete)
   */
  async deletePlan(id: string): Promise<void> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      const planRepository = transactionalEntityManager.getRepository(SubscriptionPlan);
      const plan = await planRepository.findOne({ where: { id } });

      if (!plan) {
        throw new NotFoundError('Plan not found');
      }

      await transactionalEntityManager.update(SubscriptionPlan, { id }, {
        status: PlanStatus.ARCHIVED,
        updatedAt: new Date(),
      });

      // Invalidate caches
      await this.invalidatePlanCache(id, plan.appId);
      logger.info(`Soft deleted plan with ID ${id}, invalidated caches in Redis DB${this.redisDb}`);
    });
  }

  /**
   * Hard delete a plan - Super Admin only
   */
  async hardDeletePlan(id: string): Promise<void> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      const planRepository = transactionalEntityManager.getRepository(SubscriptionPlan);
      const plan = await planRepository.findOne({ where: { id } });

      if (!plan) {
        throw new NotFoundError('Plan not found');
      }

      await transactionalEntityManager.delete(SubscriptionPlan, { id });

      // Invalidate caches
      await this.invalidatePlanCache(id, plan.appId);
      logger.info(`Hard deleted plan with ID ${id}, invalidated caches in Redis DB${this.redisDb}`);
    });
  }

  /**
   * Add a feature to a subscription plan - Admin access
   */
  async addFeature(planId: string, featureData: Partial<PlanFeature>): Promise<PlanFeature> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      const planRepository = transactionalEntityManager.getRepository(SubscriptionPlan);
      const featureRepository = transactionalEntityManager.getRepository(PlanFeature);

      const plan = await planRepository.findOne({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundError('Subscription plan not found');
      }

      // Omit any provided ID to let TypeORM generate a UUID
      const { id, ...featureDataWithoutId } = featureData;
      const feature = featureRepository.create({
        ...featureDataWithoutId,
        planId,
        createdAt: new Date(),
      });

      const savedFeature = await transactionalEntityManager.save(feature);
      logger.debug(`Saved new feature with ID ${savedFeature.id} for plan ${planId}`);

      // Invalidate caches
      await this.invalidatePlanCache(planId, plan.appId);
      logger.info(`Added feature to plan ${planId}, invalidated caches in Redis DB${this.redisDb}`);

      return savedFeature;
    });
  }

  /**
   * Update a plan feature - Admin access
   */
  async updateFeature(featureId: string, featureData: Partial<PlanFeature>): Promise<PlanFeature | null> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      const featureRepository = transactionalEntityManager.getRepository(PlanFeature);
      const planRepository = transactionalEntityManager.getRepository(SubscriptionPlan);

      const featureToUpdate = await featureRepository.findOne({ where: { id: featureId } });
      if (!featureToUpdate) {
        throw new NotFoundError('Feature not found');
      }

      // Omit any provided ID in featureData to prevent overwriting
      const { id, ...featureUpdateData } = featureData;
      await featureRepository.update({ id: featureId }, featureUpdateData);
      const updatedFeature = await featureRepository.findOne({ where: { id: featureId } });

      if (updatedFeature) {
        const plan = await planRepository.findOne({ where: { id: updatedFeature.planId } });
        if (plan) {
          await this.invalidatePlanCache(updatedFeature.planId, plan.appId);
          logger.info(`Updated feature ${featureId}, invalidated caches in Redis DB${this.redisDb}`);
        }
      }

      return updatedFeature;
    });
  }

  /**
   * Delete a plan feature - Admin access
   */
  async deleteFeature(featureId: string): Promise<void> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      const featureRepository = transactionalEntityManager.getRepository(PlanFeature);
      const planRepository = transactionalEntityManager.getRepository(SubscriptionPlan);

      const feature = await featureRepository.findOne({ where: { id: featureId } });
      if (!feature) {
        throw new NotFoundError('Feature not found');
      }

      const planId = feature.planId;
      await transactionalEntityManager.delete(PlanFeature, { id: featureId });

      // Invalidate caches
      const plan = await planRepository.findOne({ where: { id: planId } });
      if (plan) {
        await this.invalidatePlanCache(planId, plan.appId);
        logger.info(`Deleted feature ${featureId}, invalidated caches in Redis DB${this.redisDb}`);
      }
    });
  }

  /**
   * Clear all plan-related caches (use with caution in production)
   */
  async clearAllPlanCaches(): Promise<{ success: boolean; message: string }> {
    try {
      const patterns = [
        'plans:*',
        'plan:*',
        'apps:dropdown',
        'subscription:*:plan:*',
        'billing:*:plan:*',
        'cache:plans:*',
        'featured:plans*',
        'popular:plans*'
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        totalDeleted += await planCache.deleteByPattern(pattern, 100);
      }

      logger.info(`Cleared all plan caches, removed ${totalDeleted} keys`);
      
      return {
        success: true,
        message: `Successfully cleared ${totalDeleted} cache keys related to plans`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to clear plan caches:', { error: errorMessage });
      return {
        success: false,
        message: `Failed to clear plan caches: ${errorMessage}`
      };
    }
  }
}

export default new SubscriptionPlanService();