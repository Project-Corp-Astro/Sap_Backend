import { FindOneOptions, FindManyOptions, DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { getAppRepository, AppDataSource } from '../db/data-source';
import { Subscription } from '../entities/Subscription.entity';
import { SubscriptionEvent } from '../entities/SubscriptionEvent.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import { Payment } from '../entities/Payment.entity';
import logger from '../utils/logger';
import { userSubsCache } from '../utils/redis';
import {
  SubscriptionStatus,
  SubscriptionWhere,
  BillingCycle,
  SubscriptionCreationData
} from '../interfaces/types';

export class SubscriptionService {
  private subscriptionRepository!: Repository<Subscription>;
  private subscriptionEventRepository!: Repository<SubscriptionEvent>;
  private planRepository!: Repository<SubscriptionPlan>;
  private paymentRepository!: Repository<Payment>;
  private readonly redisDb: number = 3; // Subscription service uses DB3

  constructor() {
    this.initializeRepositories();
  }

  private initializeRepositories() {
    try {
      this.subscriptionRepository = AppDataSource.getRepository(Subscription);
      this.subscriptionEventRepository = AppDataSource.getRepository(SubscriptionEvent);
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
      this.paymentRepository = AppDataSource.getRepository(Payment);
      logger.info(`Initialized repositories for SubscriptionService, using Redis DB${this.redisDb}`);
    } catch (error) {
      logger.error('Failed to initialize repositories in SubscriptionService:', error);
    }
  }

  private getSubscriptionRepository(): Repository<Subscription> {
    if (!this.subscriptionRepository) {
      this.subscriptionRepository = AppDataSource.getRepository(Subscription);
      if (!this.subscriptionRepository) {
        logger.error('Failed to initialize subscription repository');
        throw new Error('Subscription repository not initialized');
      }
    }
    return this.subscriptionRepository;
  }

  private getSubscriptionEventRepository(): Repository<SubscriptionEvent> {
    if (!this.subscriptionEventRepository) {
      this.subscriptionEventRepository = AppDataSource.getRepository(SubscriptionEvent);
      if (!this.subscriptionEventRepository) {
        logger.error('Failed to initialize subscription event repository');
        throw new Error('Subscription event repository not initialized');
      }
    }
    return this.subscriptionEventRepository;
  }

  private getPlanRepository(): Repository<SubscriptionPlan> {
    if (!this.planRepository) {
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
      if (!this.planRepository) {
        logger.error('Failed to initialize plan repository');
        throw new Error('Plan repository not initialized');
      }
    }
    return this.planRepository;
  }

  private getPaymentRepository(): Repository<Payment> {
    if (!this.paymentRepository) {
      this.paymentRepository = AppDataSource.getRepository(Payment);
      if (!this.paymentRepository) {
        logger.error('Failed to initialize payment repository');
        throw new Error('Payment repository not initialized');
      }
    }
    return this.paymentRepository;
  }

  /**
   * Invalidate cache for all subscriptions or specific filters
   */
  private async invalidateSubscriptionCache(filters?: Partial<Subscription>): Promise<void> {
    try {
      const pattern = filters ? `subscriptions:${JSON.stringify(filters)}` : `subscriptions:*`;
      const fullPattern = `subscription:user-subscriptions:${pattern}`;
      const deletedCount = await userSubsCache.deleteByPattern(pattern);
      logger.info(`Invalidated ${deletedCount} cache keys for pattern: ${fullPattern} in Redis DB${this.redisDb}`);
    } catch (error) {
      logger.warn(`Failed to invalidate subscription cache in Redis DB${this.redisDb}:`, error);
    }
  }

  /**
   * Invalidate cache for a specific subscription
   */
  private async invalidateSingleSubscriptionCache(subscriptionId: string, userId?: string): Promise<void> {
    try {
      const cacheKey = `subscription:${subscriptionId}:${userId || 'admin'}`;
      const fullCacheKey = `subscription:user-subscriptions:${cacheKey}`;
      const success = await userSubsCache.del(cacheKey);
      if (success) {
        logger.debug(`Deleted cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
      } else {
        logger.debug(`Cache key not found for deletion: ${fullCacheKey} in Redis DB${this.redisDb}`);
      }
    } catch (error) {
      logger.warn(`Failed to invalidate cache for subscription ${subscriptionId} in Redis DB${this.redisDb}:`, error);
    }
  }

  /**
   * Invalidate cache for user subscriptions
   */
  private async invalidateUserSubscriptionsCache(userId: string, appId?: string): Promise<void> {
    try {
      const cacheKey = `subscriptions:user:${userId}:${appId || 'all'}`;
      const fullCacheKey = `subscription:user-subscriptions:${cacheKey}`;
      const success = await userSubsCache.del(cacheKey);
      if (success) {
        logger.debug(`Deleted cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
      } else {
        logger.debug(`Cache key not found for deletion: ${fullCacheKey} in Redis DB${this.redisDb}`);
      }
    } catch (error) {
      logger.warn(`Failed to invalidate cache for user ${userId} subscriptions in Redis DB${this.redisDb}:`, error);
    }
  }

  /**
   * Get all subscriptions - Admin access
   */
  async getAllSubscriptions(filters: Partial<Subscription> = {}): Promise<Subscription[]> {
    try {
      const cacheKey = `subscriptions:${JSON.stringify(filters)}`;
      const fullCacheKey = `subscription:user-subscriptions:${cacheKey}`;

      // Try to get from cache first
      const cachedSubscriptions = await userSubsCache.get<Subscription[]>(cacheKey);
      if (cachedSubscriptions) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedSubscriptions;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      // Fetch from database
      const subscriptions = await this.getSubscriptionRepository().find({
        where: filters,
        relations: ['plan', 'payments', 'events'],
      });

      // Cache the results for 1 hour
      try {
        const success = await userSubsCache.set(cacheKey, subscriptions, 60 * 60); // Cache for 1 hour
        if (success) {
          logger.debug(`Stored ${subscriptions.length} subscriptions in cache key: ${fullCacheKey} with TTL 1 hour in Redis DB${this.redisDb}`);
        } else {
          logger.warn(`Failed to store subscriptions in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        }
      } catch (cacheError) {
        logger.warn(`Error caching subscriptions for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
      }

      return subscriptions;
    } catch (error) {
      logger.error('Error getting all subscriptions:', error);
      throw error;
    }
  }

  /**
   * Get subscriptions by app ID
   */
  async getSubscriptionsByApp(appId: string): Promise<Subscription[]> {
    try {
      const cacheKey = `subscriptions:app:${appId}`;
      const fullCacheKey = `subscription:user-subscriptions:${cacheKey}`;

      // Try to get from cache first
      const cachedSubscriptions = await userSubsCache.get<Subscription[]>(cacheKey);
      if (cachedSubscriptions) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedSubscriptions;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      // Fetch from database
      const subscriptions = await this.getSubscriptionRepository().find({
        where: { appId },
        relations: ['plan', 'payments'],
      });

      // Cache the results for 1 hour
      try {
        const success = await userSubsCache.set(cacheKey, subscriptions, 60 * 60); // Cache for 1 hour
        if (success) {
          logger.debug(`Stored ${subscriptions.length} subscriptions in cache key: ${fullCacheKey} with TTL 1 hour in Redis DB${this.redisDb}`);
        } else {
          logger.warn(`Failed to store subscriptions in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        }
      } catch (cacheError) {
        logger.warn(`Error caching subscriptions for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
      }

      return subscriptions;
    } catch (error) {
      logger.error(`Error getting subscriptions for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Get a user's subscriptions
   */
  async getUserSubscriptions(userId: string, appId?: string): Promise<Subscription[]> {
    try {
      const cacheKey = `subscriptions:user:${userId}:${appId || 'all'}`;
      const fullCacheKey = `subscription:user-subscriptions:${cacheKey}`;

      // Try to get from cache first
      const cachedSubscriptions = await userSubsCache.get<Subscription[]>(cacheKey);
      if (cachedSubscriptions) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedSubscriptions;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      // Fetch from database
      const where: any = { userId };
      if (appId) {
        where.appId = appId;
      }
      const options: FindManyOptions<Subscription> = {
        where,
        relations: ['plan', 'payments', 'events'],
      };
      const subscriptions = await this.getSubscriptionRepository().find(options);

      // Cache the results for 1 hour
      try {
        const success = await userSubsCache.set(cacheKey, subscriptions, 60 * 60); // Cache for 1 hour
        if (success) {
          logger.debug(`Stored ${subscriptions.length} subscriptions in cache key: ${fullCacheKey} with TTL 1 hour in Redis DB${this.redisDb}`);
        } else {
          logger.warn(`Failed to store subscriptions in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        }
      } catch (cacheError) {
        logger.warn(`Error caching subscriptions for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
      }

      return subscriptions;
    } catch (error) {
      logger.error(`Error getting subscriptions for user ${userId}:`, {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        userId,
        appId
      });
      return [];
    }
  }

  /**
   * Get a specific subscription by ID
   */
  async getSubscriptionById(subscriptionId: string, userId?: string): Promise<Subscription | null> {
    try {
      const cacheKey = `subscription:${subscriptionId}:${userId || 'admin'}`;
      const fullCacheKey = `subscription:user-subscriptions:${cacheKey}`;

      // Try to get from cache first
      const cachedSubscription = await userSubsCache.get<Subscription>(cacheKey);
      if (cachedSubscription) {
        logger.debug(`Cache hit for key: ${fullCacheKey} in Redis DB${this.redisDb}`);
        return cachedSubscription;
      }
      logger.debug(`Cache miss for key: ${fullCacheKey} in Redis DB${this.redisDb}, querying database`);

      // Fetch from database
      const where: any = { id: subscriptionId };
      if (userId) {
        where.userId = userId;
      }
      const subscription = await this.getSubscriptionRepository().findOne({
        where,
        relations: ['plan', 'payments', 'events', 'promoCodes', 'promoCodes.promoCode'],
      });

      if (subscription) {
        // Cache the result for 1 hour
        try {
          const success = await userSubsCache.set(cacheKey, subscription, 60 * 60); // Cache for 1 hour
          if (success) {
            logger.debug(`Stored subscription in cache key: ${fullCacheKey} with TTL 1 hour in Redis DB${this.redisDb}`);
          } else {
            logger.warn(`Failed to store subscription in cache key: ${fullCacheKey} in Redis DB${this.redisDb}`);
          }
        } catch (cacheError) {
          logger.warn(`Error caching subscription for key ${fullCacheKey} in Redis DB${this.redisDb}:`, cacheError);
        }
      } else {
        logger.debug(`No subscription found for ID ${subscriptionId}, not caching in Redis DB${this.redisDb}`);
      }

      return subscription;
    } catch (error) {
      logger.error(`Error getting subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(planId: string, userId: string, appId: string, promoCodeId?: string): Promise<Subscription> {
    try {
      // Find the subscription plan
      const plan = await this.getPlanRepository().findOne({
        where: { id: planId, status: 'active' as any },
        relations: ['features'],
      });

      if (!plan) {
        throw new Error('Subscription plan not found');
      }

      // Create subscription
      const subscription = this.getSubscriptionRepository().create({
        userId,
        appId,
        planId: plan.id,
        plan,
        billingCycle: plan.billingCycle,
        price: plan.price,
        currency: plan.currency,
        status: plan.trialDays > 0 ? 'trialing' : 'active',
        trialStart: plan.trialDays > 0 ? new Date() : undefined,
        trialEnd: plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000) : undefined,
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculateEndDate(30, plan.billingCycle)
      } as any);

      const savedSubscription = await this.getSubscriptionRepository().save(subscription as any);

      // Log subscription event
      const eventType = plan.trialDays > 0 ? 'trial_started' : 'created';
      await this.getSubscriptionEventRepository().save({
        subscriptionId: savedSubscription.id,
        userId: savedSubscription.userId,
        eventType,
        eventData: {
          planId: plan.id,
          planName: plan.name,
          billingCycle: plan.billingCycle
        },
        createdAt: new Date()
      } as any);

      // Invalidate caches
      await this.invalidateSubscriptionCache({ appId });
      await this.invalidateUserSubscriptionsCache(userId, appId);
      logger.info(`Created subscription with ID ${savedSubscription.id} for user ${userId}, invalidated caches in Redis DB${this.redisDb}`);

      return savedSubscription;
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, userId?: string, cancelImmediately = false): Promise<Subscription> {
    try {
      // Find the subscription
      const subscription = await this.getSubscriptionRepository().findOne({
        where: { id: subscriptionId },
        relations: ['plan']
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // If userId is provided, ensure the subscription belongs to the user
      if (userId && subscription.userId !== userId) {
        throw new Error('Subscription does not belong to the user');
      }

      // Update subscription status
      if (cancelImmediately) {
        subscription.status = 'canceled' as any;
        subscription.canceledAt = new Date();
      } else {
        subscription.cancelAtPeriodEnd = true;
        subscription.canceledAt = new Date();
      }

      // Log cancellation event
      await this.getSubscriptionEventRepository().save({
        subscriptionId: subscription.id,
        userId: subscription.userId,
        eventType: 'canceled',
        eventData: {
          cancelImmediately,
          canceledAt: new Date(),
          cancelAt: subscription.canceledAt
        },
        createdAt: new Date()
      } as any);

      const updatedSubscription = await this.getSubscriptionRepository().save(subscription);

      // Invalidate caches
      await this.invalidateSubscriptionCache({ appId: subscription.appId });
      await this.invalidateUserSubscriptionsCache(subscription.userId, subscription.appId);
      await this.invalidateSingleSubscriptionCache(subscriptionId, userId);
      logger.info(`Canceled subscription with ID ${subscriptionId}, invalidated caches in Redis DB${this.redisDb}`);

      return updatedSubscription;
    } catch (error) {
      logger.error(`Error canceling subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Update subscription status (admin function)
   */
  async updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus): Promise<Subscription | null> {
    try {
      await this.getSubscriptionRepository().update({ id: subscriptionId }, { status: status as any });
      const updatedSubscription = await this.getSubscriptionById(subscriptionId);

      if (updatedSubscription) {
        // Invalidate caches
        await this.invalidateSubscriptionCache({ appId: updatedSubscription.appId });
        await this.invalidateUserSubscriptionsCache(updatedSubscription.userId, updatedSubscription.appId);
        await this.invalidateSingleSubscriptionCache(subscriptionId);
        logger.info(`Updated status of subscription ${subscriptionId} to ${status}, invalidated caches in Redis DB${this.redisDb}`);
      }

      return updatedSubscription;
    } catch (error) {
      logger.error(`Error updating subscription status ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Process renewal of subscription
   */
  async renewSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const subscription = await this.getSubscriptionRepository().findOne({
        where: { id: subscriptionId },
        relations: ['plan', 'promoCodes', 'promoCodes.promoCode']
      });

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      // Update subscription status to expired
      subscription.status = 'expired' as any;

      // Log expiration event
      await this.getSubscriptionEventRepository().save({
        subscriptionId: subscription.id,
        userId: subscription.userId,
        eventType: 'expired',
        eventData: {
          expiredAt: new Date()
        },
        createdAt: new Date()
      } as any);

      // Process payment
      const currentPeriodStart = new Date();
      const currentPeriodEnd = this.calculateEndDate(30, subscription.plan.billingCycle);
      await this.getPaymentRepository().save({
        subscriptionId: subscription.id,
        userId: subscription.userId,
        amount: (subscription as any).price || 0,
        currency: subscription.currency || 'USD',
        status: 'succeeded',
        billingPeriodStart: currentPeriodStart,
        billingPeriodEnd: currentPeriodEnd,
        paymentMethod: subscription.paymentMethod,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      const updatedSubscription = await this.getSubscriptionRepository().save(subscription);

      // Invalidate caches
      await this.invalidateSubscriptionCache({ appId: subscription.appId });
      await this.invalidateUserSubscriptionsCache(subscription.userId, subscription.appId);
      await this.invalidateSingleSubscriptionCache(subscriptionId);
      logger.info(`Renewed subscription with ID ${subscriptionId}, invalidated caches in Redis DB${this.redisDb}`);

      return updatedSubscription;
    } catch (error) {
      logger.error(`Error renewing subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate the end date based on billing cycle and duration
   */
  private calculateEndDate(durationDays: number, billingCycle: string, startDate = new Date()): Date {
    const endDate = new Date(startDate);
    
    switch (billingCycle) {
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'daily':
        endDate.setDate(endDate.getDate() + 1);
        break;
      default:
        endDate.setDate(endDate.getDate() + durationDays);
    }
    
    return endDate;
  }

  /**
   * Calculate payment amount considering any active promo codes
   */
  private calculatePaymentAmount(subscription: Subscription): number {
    let amount = subscription.plan.price;
    
    if (subscription.promoCodes && subscription.promoCodes.length > 0) {
      const activePromoCodes = subscription.promoCodes.filter(pc => pc.isActive);
      
      for (const promoCodeLink of activePromoCodes) {
        amount -= promoCodeLink.discountAmount;
      }
    }
    
    return Math.max(0, amount);
  }
}

export default new SubscriptionService();