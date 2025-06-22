
import { Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { PromoCode } from '../entities/PromoCode.entity';
import { SubscriptionPromoCode } from '../entities/SubscriptionPromoCode.entity';
import { SubscriptionAnalytics } from '../entities/SubscriptionAnalytics.entity';
import { PromoCodeAnalyticsResponse, PromoCodeAnalyticsOverview, CodePerformance, MonthlyTrend, CampaignInsight } from '../dtos/promo-code-analytics.dto';
import logger from '../utils/logger';

interface PromoCodeMetrics {
  id: string;
  code: string;
  redemptions: number;
  discountValue: number;
  uniqueUsers: number;
  usageTrend: Array<{ month: string; redemptions: number; discountValue: number }>;
}

export class PromoCodeAnalyticsService {
  private static instance: PromoCodeAnalyticsService;
  private promoCodeRepository: Repository<PromoCode>;
  private subscriptionPromoCodeRepository: Repository<SubscriptionPromoCode>;
  private subscriptionAnalyticsRepository: Repository<SubscriptionAnalytics>;

  private constructor() {
    this.promoCodeRepository = AppDataSource.getRepository(PromoCode);
    this.subscriptionPromoCodeRepository = AppDataSource.getRepository(SubscriptionPromoCode);
    this.subscriptionAnalyticsRepository = AppDataSource.getRepository(SubscriptionAnalytics);
  }

  public static getInstance(): PromoCodeAnalyticsService {
    if (!PromoCodeAnalyticsService.instance) {
      PromoCodeAnalyticsService.instance = new PromoCodeAnalyticsService();
    }
    return PromoCodeAnalyticsService.instance;
  }

  /**
   * Get comprehensive promo code analytics
   */
  public async getAnalytics(): Promise<PromoCodeAnalyticsResponse> {
    try {
      const [overview, metrics, monthlyTrends] = await Promise.all([
        this.getOverview(),
        this.getPromoCodeMetrics(),
        this.getMonthlyTrends(),
      ]);

      const performance = metrics.map((m) => ({
        code: m.code,
        redemptions: m.redemptions,
        discountValue: m.discountValue,
        conversionRate: m.uniqueUsers > 0 ? (m.redemptions / m.uniqueUsers) * 100 : 0,
        averageDiscount: m.redemptions > 0 ? m.discountValue / m.redemptions : 0,
        usageTrend: m.usageTrend,
      }));

      const campaignInsights = metrics.map((m) => ({
        code: m.code,
        performance: {
          redemptions: m.redemptions,
          discountValue: m.discountValue,
          conversionRate: m.uniqueUsers > 0 ? (m.redemptions / m.uniqueUsers) * 100 : 0,
        },
        recommendations: this.generateRecommendations({
          redemptions: m.redemptions,
          discountValue: m.discountValue,
          conversionRate: m.uniqueUsers > 0 ? (m.redemptions / m.uniqueUsers) * 100 : 0,
        }),
      }));

      return {
        overview,
        performance,
        monthlyTrends,
        campaignInsights,
      };
    } catch (error) {
      // Type-safe error handling
      if (error instanceof Error) {
        logger.error('Error getting promo code analytics:', { error: error.message, stack: error.stack });
        throw new Error(`Failed to fetch promo code analytics: ${error.message}`);
      } else {
        logger.error('Error getting promo code analytics:', { error: String(error) });
        throw new Error('Failed to fetch promo code analytics: Unknown error');
      }
    }
  }

  /**
   * Get promo code overview statistics
   */
  private async getOverview(): Promise<PromoCodeAnalyticsOverview> {
    try {
      const [totalCodes, activeCodes, totalRedemptions, totalDiscountValue, mostUsedCode] = await Promise.all([
        this.promoCodeRepository.count(),
        this.promoCodeRepository.count({ where: { isActive: true } }),
        this.subscriptionPromoCodeRepository.count(),
        this.subscriptionPromoCodeRepository
          .createQueryBuilder('spc')
          .select('SUM(spc.discountAmount)', 'total')
          .getRawOne(),
        this.subscriptionPromoCodeRepository
          .createQueryBuilder('spc')
          .leftJoin('spc.promoCode', 'pc')
          .select(['pc.code AS pc_code'])
          .addSelect('COUNT(spc.id)', 'redemptions')
          .addSelect('SUM(spc.discountAmount)', 'discountValue')
          .groupBy('pc.id, pc.code')
          .orderBy('redemptions', 'DESC')
          .limit(1)
          .getRawOne(),
      ]);

      return {
        totalCodes,
        activeCodes,
        totalRedemptions,
        totalDiscountValue: Number(totalDiscountValue?.total) || 0,
        averageDiscount: totalRedemptions > 0 ? (Number(totalDiscountValue?.total) || 0) / totalRedemptions : 0,
        mostUsedCode: {
          code: mostUsedCode?.pc_code || '',
          redemptions: Number(mostUsedCode?.redemptions) || 0,
          discountValue: Number(mostUsedCode?.discountValue) || 0,
        },
      };
    } catch (error) {
      // Type-safe error handling
      if (error instanceof Error) {
        logger.error('Error getting promo code overview:', { error: error.message, stack: error.stack });
        throw new Error(`Failed to fetch promo code overview: ${error.message}`);
      } else {
        logger.error('Error getting promo code overview:', { error: String(error) });
        throw new Error('Failed to fetch promo code overview: Unknown error');
      }
    }
  }

  /**
   * Get aggregated metrics for all promo codes
   */
  private async getPromoCodeMetrics(): Promise<PromoCodeMetrics[]> {
    try {
      // Fetch redemption counts and discount values
      const redemptionMetrics = await this.subscriptionPromoCodeRepository
        .createQueryBuilder('spc')
        .select('spc.promoCodeId', 'id')
        .addSelect('pc.code', 'code')
        .addSelect('COUNT(spc.id)', 'redemptions')
        .addSelect('SUM(spc.discountAmount)', 'discountValue')
        .addSelect('COUNT(DISTINCT spc.subscriptionId)', 'uniqueUsers')
        .leftJoin('spc.promoCode', 'pc')
        .groupBy('spc.promoCodeId, pc.code')
        .getRawMany();

      // Fetch usage trends for all promo codes in a single query
      const usageTrends = await this.subscriptionPromoCodeRepository
        .createQueryBuilder('spc')
        .select('spc.promoCodeId', 'id')
        .addSelect('DATE_TRUNC(:interval, spc.appliedDate)', 'month')
        .addSelect('COUNT(spc.id)', 'redemptions')
        .addSelect('SUM(spc.discountAmount)', 'discountValue')
        .setParameter('interval', 'month')
        .groupBy('spc.promoCodeId, DATE_TRUNC(:interval, spc.appliedDate)')
        .orderBy('spc.promoCodeId, month', 'ASC')
        .getRawMany();

      // Group usage trends by promoCodeId
      const trendMap = new Map<string, Array<{ month: string; redemptions: number; discountValue: number }>>();
      usageTrends.forEach((trend) => {
        const trends = trendMap.get(trend.id) || [];
        trends.push({
          month: trend.month,
          redemptions: Number(trend.redemptions),
          discountValue: Number(trend.discountValue),
        });
        trendMap.set(trend.id, trends);
      });

      // Combine metrics
      return redemptionMetrics.map((metric) => ({
        id: metric.id,
        code: metric.code,
        redemptions: Number(metric.redemptions),
        discountValue: Number(metric.discountValue),
        uniqueUsers: Number(metric.uniqueUsers),
        usageTrend: trendMap.get(metric.id) || [],
      }));
    } catch (error) {
      // Type-safe error handling
      if (error instanceof Error) {
        logger.error('Error getting promo code metrics:', { error: error.message, stack: error.stack });
        throw new Error(`Failed to fetch promo code metrics: ${error.message}`);
      } else {
        logger.error('Error getting promo code metrics:', { error: String(error) });
        throw new Error('Failed to fetch promo code metrics: Unknown error');
      }
    }
  }

  /**
   * Get monthly redemption trends
   */
  private async getMonthlyTrends(): Promise<MonthlyTrend[]> {
    try {
      const trends = await this.subscriptionPromoCodeRepository
        .createQueryBuilder('spc')
        .select('DATE_TRUNC(:interval, spc.appliedDate)', 'month')
        .addSelect('COUNT(spc.id)', 'redemptions')
        .addSelect('SUM(spc.discountAmount)', 'discountValue')
        .addSelect('AVG(spc.discountAmount)', 'averageDiscount')
        .setParameter('interval', 'month')
        .groupBy('DATE_TRUNC(:interval, spc.appliedDate)')
        .orderBy('month', 'ASC')
        .getRawMany();

      // Get unique users and total exposures for conversion rate calculation
      const exposureStats = await this.subscriptionAnalyticsRepository
        .createQueryBuilder('sa')
        .select('DATE_TRUNC(:interval, sa.exposureDate)', 'month')
        .addSelect('COUNT(DISTINCT sa.userId)', 'uniqueUsers')
        .addSelect('COUNT(sa.id)', 'totalExposures')
        .setParameter('interval', 'month')
        .groupBy('DATE_TRUNC(:interval, sa.exposureDate)')
        .getRawMany();

      // Combine exposure stats with redemption trends
      const combinedTrends = trends.map((trend) => {
        const exposure = exposureStats.find(e => e.month === trend.month);
        const uniqueRedemptions = Number(trend.redemptions);
        const totalExposures = exposure ? Number(exposure.totalExposures) : 0;
        const conversionRate = totalExposures > 0 ? (uniqueRedemptions / totalExposures) * 100 : 0;

        return {
          month: trend.month,
          redemptions: uniqueRedemptions,
          discountValue: Number(trend.discountValue),
          conversionRate: conversionRate,
        };
      });

      return combinedTrends;
    } catch (error) {
      // Type-safe error handling
      if (error instanceof Error) {
        logger.error('Error getting monthly trends:', { error: error.message, stack: error.stack });
        throw new Error(`Failed to fetch monthly trends: ${error.message}`);
      } else {
        logger.error('Error getting monthly trends:', { error: String(error) });
        throw new Error('Failed to fetch monthly trends: Unknown error');
      }
    }
  }

  /**
   * Generate recommendations based on performance metrics
   */
  private generateRecommendations(performance: {
    redemptions: number;
    discountValue: number;
    conversionRate: number;
  }): Array<{ type: 'increase' | 'decrease' | 'maintain'; metric: string; reason: string }> {
    const recommendations: Array<{ type: 'increase' | 'decrease' | 'maintain'; metric: string; reason: string }> = [];

    if (performance.redemptions < 10) {
      recommendations.push({
        type: 'increase',
        metric: 'Visibility',
        reason: 'Low redemption rate indicates limited exposure',
      });
    }

    if (performance.conversionRate < 20) {
      recommendations.push({
        type: 'increase',
        metric: 'Conversion',
        reason: 'Low conversion rate suggests potential targeting issues',
      });
    }

    if (performance.discountValue > 1000) {
      recommendations.push({
        type: 'decrease',
        metric: 'Discount',
        reason: 'High discount value may be cannibalizing revenue',
      });
    }

    return recommendations;
  }
}
