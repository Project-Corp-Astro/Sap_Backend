import { FindOneOptions, FindManyOptions, DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { Subscription, SubscriptionStatus } from '../entities/Subscription.entity';
import { SubscriptionEvent } from '../entities/SubscriptionEvent.entity';
import { SubscriptionPlan, BillingCycle } from '../entities/SubscriptionPlan.entity';
import { Payment } from '../entities/Payment.entity';
import { PromoCode, DiscountType } from '../entities/PromoCode.entity';
import { SubscriptionPromoCode } from '../entities/SubscriptionPromoCode.entity';
import logger from '../utils/logger';
import { userSubsCache } from '../utils/redis';
import { PromoCodeValidationService, PromoCodeValidationResult } from './promo-code-validation.service';
import { NotFoundError, BadRequestError } from '../errors/api-error';

export class SubscriptionService {
  private promoCodeValidationService: PromoCodeValidationService;
  private subscriptionRepository!: Repository<Subscription>;
  private subscriptionEventRepository!: Repository<SubscriptionEvent>;
  private planRepository!: Repository<SubscriptionPlan>;
  private paymentRepository!: Repository<Payment>;
  private promoCodeRepository!: Repository<PromoCode>;
  private subscriptionPromoCodeRepository!: Repository<SubscriptionPromoCode>;

  constructor() {
    this.initializeRepositories();
    this.promoCodeValidationService = new PromoCodeValidationService(
      this.getPromoCodeRepository(),
      this.getSubscriptionPromoCodeRepository(),
      this.getSubscriptionRepository()
    );
  }

  private initializeRepositories() {
    try {
      this.subscriptionRepository = AppDataSource.getRepository(Subscription);
      this.subscriptionEventRepository = AppDataSource.getRepository(SubscriptionEvent);
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
      this.paymentRepository = AppDataSource.getRepository(Payment);
      this.promoCodeRepository = AppDataSource.getRepository(PromoCode);
      this.subscriptionPromoCodeRepository = AppDataSource.getRepository(SubscriptionPromoCode);
      logger.info(`Initialized repositories for SubscriptionService`);
    } catch (error) {
      logger.error('Failed to initialize repositories in SubscriptionService:', error);
    }
  }

  private getSubscriptionRepository(): Repository<Subscription> {
    if (!this.subscriptionRepository) {
      this.subscriptionRepository = AppDataSource.getRepository(Subscription);
    }
    return this.subscriptionRepository;
  }

  private getSubscriptionEventRepository(): Repository<SubscriptionEvent> {
    if (!this.subscriptionEventRepository) {
      this.subscriptionEventRepository = AppDataSource.getRepository(SubscriptionEvent);
    }
    return this.subscriptionEventRepository;
  }

  private getPlanRepository(): Repository<SubscriptionPlan> {
    if (!this.planRepository) {
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
    }
    return this.planRepository;
  }

  private getPaymentRepository(): Repository<Payment> {
    if (!this.paymentRepository) {
      this.paymentRepository = AppDataSource.getRepository(Payment);
    }
    return this.paymentRepository;
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

  private async invalidateSubscriptionCache(filters?: Partial<Subscription>): Promise<void> {
    const pattern = filters ? `subscriptions:${JSON.stringify(filters)}` : 'subscriptions:*';
    await userSubsCache.deleteByPattern(pattern);
  }

  private async invalidateSingleSubscriptionCache(subscriptionId: string, userId?: string): Promise<void> {
    const cacheKey = `subscription:${subscriptionId}:${userId || 'admin'}`;
    await userSubsCache.del(cacheKey);
  }

  private async invalidateUserSubscriptionsCache(userId: string, appId?: string): Promise<void> {
    const cacheKey = `subscriptions:user:${userId}:${appId || 'all'}`;
    await userSubsCache.del(cacheKey);
  }

  async getAllSubscriptions(filters: Partial<Subscription> = {}): Promise<Subscription[]> {
    const cacheKey = `subscriptions:${JSON.stringify(filters)}`;
    const cachedSubscriptions = await userSubsCache.get<Subscription[]>(cacheKey);
    if (cachedSubscriptions) return cachedSubscriptions;

    const subscriptions = await this.getSubscriptionRepository().find({
      where: filters,
      relations: ['plan', 'payments', 'events'],
    });
    await userSubsCache.set(cacheKey, subscriptions, 3600);
    return subscriptions;
  }

  async getSubscriptionsByApp(appId: string): Promise<Subscription[]> {
    const cacheKey = `subscriptions:app:${appId}`;
    const cachedSubscriptions = await userSubsCache.get<Subscription[]>(cacheKey);
    if (cachedSubscriptions) return cachedSubscriptions;

    const subscriptions = await this.getSubscriptionRepository().find({ where: { appId }, relations: ['plan', 'payments'] });
    await userSubsCache.set(cacheKey, subscriptions, 3600);
    return subscriptions;
  }

  async getUserSubscriptions(userId: string, appId?: string): Promise<Subscription[]> {
    const cacheKey = `subscriptions:user:${userId}:${appId || 'all'}`;
    const cachedSubscriptions = await userSubsCache.get<Subscription[]>(cacheKey);
    if (cachedSubscriptions) return cachedSubscriptions;

    const where: FindOptionsWhere<Subscription> = { userId };
    if (appId) where.appId = appId;

    const subscriptions = await this.getSubscriptionRepository().find({ where, relations: ['plan', 'payments', 'events'] });
    await userSubsCache.set(cacheKey, subscriptions, 3600);
    return subscriptions;
  }

  async getSubscriptionById(subscriptionId: string, userId?: string): Promise<Subscription | null> {
    const cacheKey = `subscription:${subscriptionId}:${userId || 'admin'}`;
    const cachedSubscription = await userSubsCache.get<Subscription>(cacheKey);
    if (cachedSubscription) return cachedSubscription;

    const where: FindOptionsWhere<Subscription> = { id: subscriptionId };
    if (userId) where.userId = userId;

    const subscription = await this.getSubscriptionRepository().findOne({
      where,
      relations: ['plan', 'payments', 'events', 'promoCodes', 'promoCodes.promoCode'],
    });

    if (subscription) {
      await userSubsCache.set(cacheKey, subscription, 3600);
    }
    return subscription;
  }

  async createSubscription(planId: string, userId: string, appId: string, promoCodeId?: string): Promise<Subscription> {
    return AppDataSource.transaction(async (transactionalEntityManager) => {
      const planRepository = transactionalEntityManager.getRepository(SubscriptionPlan);
      const subscriptionRepository = transactionalEntityManager.getRepository(Subscription);
      const promoCodeRepository = transactionalEntityManager.getRepository(PromoCode);
      const subscriptionPromoCodeRepository = transactionalEntityManager.getRepository(SubscriptionPromoCode);

      const plan = await planRepository.findOne({ where: { id: planId, status: 'active' as any } });
      if (!plan) {
        throw new NotFoundError('Subscription plan not found');
      }

      let price = plan.price;
      let promoCode: PromoCode | null = null;

      if (promoCodeId) {
        const validationResult = await this.promoCodeValidationService.validatePromoCode(promoCodeId, userId, planId);
        if (!validationResult.isValid || !validationResult.promoCode) {
          throw new BadRequestError(validationResult.message || 'Invalid promo code');
        }
        promoCode = validationResult.promoCode;
        price = this.calculateDiscountedPrice(price, promoCode);
      }

      const subscriptionData: DeepPartial<Subscription> = {
        userId,
        appId,
        planId: plan.id,
        status: plan.trialDays && plan.trialDays > 0 ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
        amount: price,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        startDate: new Date(),
        endDate: this.calculateEndDate(30, plan.billingCycle),
        trialEndDate: plan.trialDays && plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000) : undefined,
      };

      const newSubscription = subscriptionRepository.create(subscriptionData);
      const savedSubscription = await subscriptionRepository.save(newSubscription);

      if (promoCode) {
        const subPromoCode = subscriptionPromoCodeRepository.create({
          subscription: savedSubscription,
          promoCode: promoCode,
          discountAmount: plan.price - price,
          appliedDate: new Date(),
          isActive: true,
        });
        await subscriptionPromoCodeRepository.save(subPromoCode);
        await transactionalEntityManager.increment(PromoCode, { id: promoCode.id }, 'usageCount', 1);
      }

      await this.invalidateUserSubscriptionsCache(userId, appId);
      logger.info(`Successfully created subscription ${savedSubscription.id} for user ${userId}`);
      return savedSubscription;
    });
  }

  private calculateDiscountedPrice(originalPrice: number, promoCode: PromoCode): number {
    if (promoCode.discountType === DiscountType.PERCENTAGE) {
      const discount = originalPrice * (promoCode.discountValue / 100);
      return Math.max(0, originalPrice - discount);
    } else if (promoCode.discountType === DiscountType.FIXED) {
      return Math.max(0, originalPrice - promoCode.discountValue);
    }
    return originalPrice;
  }

  async cancelSubscription(subscriptionId: string, userId?: string, cancelImmediately = false): Promise<Subscription> {
    const subscription = await this.getSubscriptionById(subscriptionId, userId);
    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    if (userId && subscription.userId !== userId) {
      throw new BadRequestError('Subscription does not belong to the user');
    }

    subscription.status = cancelImmediately ? SubscriptionStatus.CANCELED : subscription.status;
    subscription.cancelAtPeriodEnd = !cancelImmediately;
    subscription.canceledAt = new Date();

    await this.getSubscriptionRepository().save(subscription);
    await this.invalidateSingleSubscriptionCache(subscriptionId, userId);
    await this.invalidateUserSubscriptionsCache(subscription.userId, subscription.appId);

    return subscription;
  }

  async updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus): Promise<Subscription | null> {
    await this.getSubscriptionRepository().update({ id: subscriptionId }, { status: status as any });
    const updatedSubscription = await this.getSubscriptionById(subscriptionId);

    if (updatedSubscription) {
      await this.invalidateSingleSubscriptionCache(subscriptionId);
      await this.invalidateUserSubscriptionsCache(updatedSubscription.userId, updatedSubscription.appId);
    }

    return updatedSubscription;
  }

  async renewSubscription(subscriptionId: string): Promise<Subscription> {
    return AppDataSource.transaction(async (transactionalEntityManager) => {
      const subscriptionRepository = transactionalEntityManager.getRepository(Subscription);
      const subscription = await subscriptionRepository.findOne({ where: { id: subscriptionId }, relations: ['plan'] });

      if (!subscription) {
        throw new NotFoundError('Subscription not found for renewal');
      }

      subscription.startDate = new Date();
      subscription.endDate = this.calculateEndDate(30, subscription.plan.billingCycle);
      subscription.status = SubscriptionStatus.ACTIVE;

      return subscriptionRepository.save(subscription);
    });
  }

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

  private calculatePaymentAmount(subscription: Subscription): number {
    let amount = subscription.plan.price;
    if (subscription.promoCodes && subscription.promoCodes.length > 0) {
      const activePromoCodes = subscription.promoCodes.filter((pc) => pc.isActive);
      for (const promoCodeLink of activePromoCodes) {
        amount -= promoCodeLink.discountAmount;
      }
    }
    return Math.max(0, amount);
  }
}

export default new SubscriptionService();