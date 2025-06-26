import { Between, In, Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { Subscription, SubscriptionStatus } from '../entities/Subscription.entity';
import { SubscriptionPlan, BillingCycle } from '../entities/SubscriptionPlan.entity';
import { SubscriptionAnalytics } from '../entities/SubscriptionAnalytics.entity';
import { SubscriptionAnalyticsResponse, DateRangeDto } from '../dtos/subscription-analytics.dto';
import { startOfDay, endOfDay, format } from 'date-fns';
import logger from '../utils/logger';

export class SubscriptionAnalyticsService {
  private static instance: SubscriptionAnalyticsService;
  private subscriptionRepository: Repository<Subscription>;
  private planRepository: Repository<SubscriptionPlan>;
  private analyticsRepository: Repository<SubscriptionAnalytics>;
  private readonly CACHE_TTL = 3600;

  private constructor() {
    this.subscriptionRepository = AppDataSource.getRepository(Subscription);
    this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
    this.analyticsRepository = AppDataSource.getRepository(SubscriptionAnalytics);
  }

  public static getInstance(): SubscriptionAnalyticsService {
    if (!SubscriptionAnalyticsService.instance) {
      SubscriptionAnalyticsService.instance = new SubscriptionAnalyticsService();
    }
    return SubscriptionAnalyticsService.instance;
  }

  public async getAnalytics(range: DateRangeDto): Promise<SubscriptionAnalyticsResponse> {
    const { startDate, endDate, appId } = range;
    try {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));

      const cacheKey = `analytics:${start.toISOString()}:${end.toISOString()}:${appId || 'all'}`;
      const cachedAnalytics = await this.getCachedAnalytics(cacheKey);
      if (cachedAnalytics) return cachedAnalytics;

      const analytics = await this.calculateAnalytics(start, end, appId);
      await this.cacheAnalytics(cacheKey, analytics);
      return analytics;
    } catch (error) {
      logger.error('Error in getAnalytics:', error);
      throw error;
    }
  }

  private async calculateAnalytics(start: Date, end: Date, appId?: string): Promise<SubscriptionAnalyticsResponse> {
    try {
      const whereClause = appId ? { appId } : {};

      const [
        totalSubscribers,
        activeSubscriptions,
        newSubscribers,
        churned,
        trialConversions,
        plansWithCounts
      ] = await Promise.all([
        this.getTotalSubscribersCount(start, end, appId),
        this.getActiveSubscriptionsCount(start, end, appId),
        this.getNewSubscribersCount(start, end, appId),
        this.getChurnedSubscribersCount(start, end, appId),
        this.getTrialSubscriptions(start, end, appId),
        this.getSubscriptionPlans(start, end, appId)
      ]);

      const mrr = this.calculateMRR(plansWithCounts);
      const arr = this.calculateARR(plansWithCounts);
      const arpu = totalSubscribers > 0 ? mrr / totalSubscribers : 0;
      const churnRate = this.calculateChurnRate(churned, totalSubscribers);
      const conversionRate = this.calculateConversionRate(trialConversions, newSubscribers);
      const ltv = this.calculateLTV(arpu, churnRate);
      const trialConversionRate = this.calculateTrialConversionRate(trialConversions, plansWithCounts);
      const planDistribution = await this.getPlanDistribution(start, end, appId);

      return {
        date: new Date().toISOString(),
        totalSubscribers,
        activeSubscriptions,
        monthlyRecurringRevenue: mrr,
        annualRecurringRevenue: arr,
        averageRevenuePerUser: arpu,
        churnRate,
        newSubscribers,
        churned,
        conversionRate,
        lifetimeValue: ltv,
        planDistribution,
        upgradedRate: 0,
        downgradedRate: 0,
        freeTrialConversions: trialConversions,
        renewalRate: 0
      };
    } catch (error) {
      logger.error('Error in calculateAnalytics:', error);
      throw error;
    }
  }

  private async getTotalSubscribersCount(start: Date, end: Date, appId?: string): Promise<number> {
    const query = this.subscriptionRepository
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.userId)', 'count')
      .where('s.createdAt BETWEEN :start AND :end', { start, end });
    if (appId) query.andWhere('s.appId = :appId', { appId });
    const result = await query.getRawOne();
    return parseInt(result?.count || '0', 10);
  }

  private async getActiveSubscriptionsCount(start: Date, end: Date, appId?: string): Promise<number> {
    const query = this.subscriptionRepository
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('s.startDate <= :end', { end })
      .andWhere('(s.endDate IS NULL OR s.endDate >= :start)', { start });
    if (appId) query.andWhere('s.appId = :appId', { appId });
    return query.getCount();
  }

  private async getNewSubscribersCount(start: Date, end: Date, appId?: string): Promise<number> {
    return this.subscriptionRepository.count({
      where: {
        startDate: Between(start, end),
        ...(appId ? { appId } : {})
      }
    });
  }

  private async getChurnedSubscribersCount(start: Date, end: Date, appId?: string): Promise<number> {
    return this.subscriptionRepository.count({
      where: {
        status: SubscriptionStatus.CANCELED,
        endDate: Between(start, end),
        ...(appId ? { appId } : {})
      }
    });
  }

  private async getTrialSubscriptions(start: Date, end: Date, appId?: string): Promise<number> {
    const query = this.subscriptionRepository
      .createQueryBuilder('s')
      .innerJoin('s.plan', 'p', 'p.trialDays > 0')
      .where('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('s.trialEndDate IS NOT NULL')
      .andWhere('s.startDate BETWEEN :start AND :end', { start, end });
    if (appId) query.andWhere('s.appId = :appId', { appId });
    return query.getCount();
  }

  private async getSubscriptionPlans(start: Date, end: Date, appId?: string) {
    const query = this.planRepository
      .createQueryBuilder('p')
      .leftJoin('p.subscriptions', 's', 's.startDate <= :end AND (s.endDate IS NULL OR s.endDate >= :start)', { start, end })
      .addSelect('COUNT(s.id)', 'subscriberCount')
      .groupBy('p.id');
    if (appId) query.andWhere('p.appId = :appId', { appId });
    const results = await query.getRawAndEntities();
    return results.entities.map((plan, index) => ({
      plan,
      count: parseInt(results.raw[index]?.subscriberCount || '0', 10)
    }));
  }

  private calculateMRR(plans: Array<{ plan: SubscriptionPlan; count: number }>): number {
    return plans.reduce((total, { plan, count }) => {
      let rate = plan.price;
      if (plan.billingCycle === BillingCycle.YEARLY) rate /= 12;
      if (plan.billingCycle === BillingCycle.QUARTERLY) rate /= 3;
      return total + rate * count;
    }, 0);
  }

  private calculateARR(plans: Array<{ plan: SubscriptionPlan; count: number }>): number {
    return this.calculateMRR(plans) * 12;
  }

  private calculateChurnRate(churned: number, total: number): number {
    return total > 0 ? (churned / total) * 100 : 0;
  }

  private calculateConversionRate(trialConversions: number, newSubs: number): number {
    return newSubs > 0 ? (trialConversions / newSubs) * 100 : 0;
  }

  private calculateLTV(arpu: number, churnRate: number): number {
    return churnRate > 0 ? arpu / (churnRate / 100) : 0;
  }

  private calculateTrialConversionRate(trialConversions: number, plans: Array<{ plan: SubscriptionPlan; count: number }>): number {
    const totalTrials = plans.reduce((sum, { plan, count }) => {
      return plan.trialDays && plan.trialDays > 0 ? sum + count : sum;
    }, 0);
    return totalTrials > 0 ? (trialConversions / totalTrials) * 100 : 0;
  }

  private async getPlanDistribution(start: Date, end: Date, appId?: string): Promise<Record<string, { count: number; percentage: number }>> {
    const plans = await this.getSubscriptionPlans(start, end, appId);
    const total = plans.reduce((sum, { count }) => sum + count, 0);
    return plans.reduce((acc, { plan, count }) => {
      acc[plan.name] = {
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      };
      return acc;
    }, {} as Record<string, { count: number; percentage: number }>);
  }

  private async getCachedAnalytics(_key: string): Promise<SubscriptionAnalyticsResponse | null> {
    return null; // Implement caching logic (e.g., Redis)
  }

  private async cacheAnalytics(_key: string, _data: SubscriptionAnalyticsResponse): Promise<void> {
    // Implement cache set logic
  }
}

export const subscriptionAnalyticsService = SubscriptionAnalyticsService.getInstance();
