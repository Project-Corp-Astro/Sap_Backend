/**
 * DTOs for Promo Code Analytics
 */

export interface PromoCodeAnalyticsOverview {
  totalCodes: number;
  activeCodes: number;
  totalRedemptions: number;
  totalDiscountValue: number;
  averageDiscount: number;
  mostUsedCode: {
    code: string;
    redemptions: number;
    discountValue: number;
  };
}

export interface CodePerformance {
  code: string;
  redemptions: number;
  discountValue: number;
  conversionRate: number;
  averageDiscount: number;
  usageTrend: Array<{
    month: string;
    redemptions: number;
    discountValue: number;
  }>;
}

export interface MonthlyTrend {
  month: string;
  redemptions: number;
  discountValue: number;
  conversionRate: number;
}

export interface CampaignInsight {
  code: string;
  performance: {
    redemptions: number;
    discountValue: number;
    conversionRate: number;
  };
  recommendations: Array<{
    type: 'increase' | 'decrease' | 'maintain';
    metric: string;
    reason: string;
  }>;
}

export interface PromoCodeAnalyticsResponse {
  overview: PromoCodeAnalyticsOverview;
  performance: CodePerformance[];
  monthlyTrends: MonthlyTrend[];
  campaignInsights: CampaignInsight[];
}
