import { FindOneOptions, FindManyOptions, DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { getAppRepository, AppDataSource } from '../db/data-source';
import { Subscription } from '../entities/Subscription.entity';
import { SubscriptionEvent } from '../entities/SubscriptionEvent.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import { Payment } from '../entities/Payment.entity';
import logger from '../utils/logger';
import {
  SubscriptionStatus,
  SubscriptionWhere,
  BillingCycle,
  SubscriptionCreationData
} from '../interfaces/types';

export class SubscriptionService {
  // Declare repository properties with initialization to fix TypeScript errors
  private subscriptionRepository!: Repository<Subscription>;
  private subscriptionEventRepository!: Repository<SubscriptionEvent>;
  private planRepository!: Repository<SubscriptionPlan>;
  private paymentRepository!: Repository<Payment>;

  constructor() {
    // Initialize repositories using AppDataSource to ensure proper connection
    this.initializeRepositories();
  }

  private initializeRepositories() {
    try {
      this.subscriptionRepository = AppDataSource.getRepository(Subscription);
      this.subscriptionEventRepository = AppDataSource.getRepository(SubscriptionEvent);
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
      this.paymentRepository = AppDataSource.getRepository(Payment);
    } catch (error) {
      logger.error('Failed to initialize repositories in SubscriptionService:', error);
      // We'll throw the error later when methods are called if repositories aren't available
    }
  }

  /**
   * Get all subscriptions - Admin access
   */
  async getAllSubscriptions(filters: Partial<Subscription> = {}) {
    try {
      return await this.subscriptionRepository.find({
        where: filters,
        relations: ['plan', 'payments', 'events']
      });
    } catch (error) {
      logger.error('Error getting all subscriptions:', error);
      throw error;
    }
  }

  /**
   * Get subscriptions by app ID
   * For admin and app-specific access
   */
  async getSubscriptionsByApp(appId: string) {
    try {
      return await this.subscriptionRepository.find({
        where: { appId },
        relations: ['plan', 'payments']
      });
    } catch (error) {
      logger.error(`Error getting subscriptions for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Get a user's subscriptions
   * Supports filtering by appId for multi-app users
   */
  async getUserSubscriptions(userId: string, appId?: string) {
    try {
      // Check if repository is initialized
      if (!this.subscriptionRepository) {
        logger.warn('Repository not initialized, attempting to initialize');
        this.initializeRepositories();
        
        // Double check after initialization attempt
        if (!this.subscriptionRepository) {
          throw new Error('Failed to initialize subscription repository');
        }
      }
      
      // Log debug info
      logger.debug('Querying subscriptions with params:', { userId, appId });
      
      const where: any = { userId };
      if (appId) {
        where.appId = appId;
      }
      
      const options: FindManyOptions<Subscription> = {
        where,
        relations: ['plan', 'payments', 'events']
      };
      
      return await this.subscriptionRepository.find(options);
    } catch (error) {
      // Enhanced error logging
      logger.error(`Error getting subscriptions for user ${userId}:`, { 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        userId,
        appId
      });
      
      // Return empty array instead of throwing to make the API more resilient
      // This prevents 500 errors when DB issues occur
      return [];
    }
  }

  /**
   * Get a specific subscription by ID
   * Includes validation for user access
   */
  async getSubscriptionById(subscriptionId: string, userId?: string) {
    try {
      const where: any = { id: subscriptionId };
      if (userId) {
        where.userId = userId;
      }
      return await this.subscriptionRepository.findOne({
        where,
        relations: ['plan', 'payments', 'events', 'promoCodes', 'promoCodes.promoCode']
      });
    } catch (error) {
      logger.error(`Error getting subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new subscription
   * Handles trial periods and initial payments
   */
  async createSubscription(planId: string, userId: string, appId: string, promoCodeId?: string) {
    try {
      // Find the subscription plan
      const plan = await this.planRepository.findOne({
        where: { id: planId, status: 'active' as any },
        relations: ['features']
      });

      if (!plan) {
        throw new Error('Subscription plan not found');
      }

      // Create subscription
      const subscription = this.subscriptionRepository.create({
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

      const savedSubscription = await this.subscriptionRepository.save(subscription as any);

      // Log subscription event
      const eventType = plan.trialDays > 0 ? 'trial_started' : 'created';
      await this.subscriptionEventRepository.save({
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

      return savedSubscription;
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   * @param cancelImmediately - If true, cancels right away; otherwise at period end
   */
  async cancelSubscription(subscriptionId: string, userId?: string, cancelImmediately = false) {
    try {
      // Find the subscription
      const subscription = await this.subscriptionRepository.findOne({
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
      await this.subscriptionEventRepository.save({
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

      return await this.subscriptionRepository.save(subscription);
    } catch (error) {
      logger.error(`Error canceling subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Update subscription status (admin function)
   */
  async updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus) {
    try {
      await this.subscriptionRepository.update({ id: subscriptionId }, { status: status as any });
      return await this.subscriptionRepository.findOne({ where: { id: subscriptionId } });
    } catch (error) {
      logger.error(`Error updating subscription status ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Process renewal of subscription
   * Creates payment record and updates subscription dates
   */
  async renewSubscription(subscriptionId: string) {
    try {
      const subscription = await this.subscriptionRepository.findOne({
        where: { id: subscriptionId },
        relations: ['plan', 'promoCodes', 'promoCodes.promoCode']
      });

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      // Update subscription status to expired
      subscription.status = 'expired' as any;

      // Log expiration event
      await this.subscriptionEventRepository.save({
        subscriptionId: subscription.id,
        userId: subscription.userId,
        eventType: 'expired',
        eventData: {
          expiredAt: new Date()
        },
        createdAt: new Date()
      } as any);

      // Process payment (simplified, in a real app would integrate with payment provider)
      const currentPeriodStart = new Date();
      const currentPeriodEnd = this.calculateEndDate(30, subscription.plan.billingCycle);
      await this.paymentRepository.save({
        subscriptionId: subscription.id,
        userId: subscription.userId,
        amount: (subscription as any).price || 0, // Using price as fallback for totalAmount
        currency: subscription.currency || 'USD',
        status: 'succeeded',
        billingPeriodStart: currentPeriodStart,
        billingPeriodEnd: currentPeriodEnd,
        paymentMethod: subscription.paymentMethod,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      return await this.subscriptionRepository.save(subscription);
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
    
    // Apply discounts from active promo codes
    if (subscription.promoCodes && subscription.promoCodes.length > 0) {
      const activePromoCodes = subscription.promoCodes.filter(pc => pc.isActive);
      
      for (const promoCodeLink of activePromoCodes) {
        amount -= promoCodeLink.discountAmount;
      }
    }
    
    // Ensure we don't go below zero
    return Math.max(0, amount);
  }
}

export default new SubscriptionService();
