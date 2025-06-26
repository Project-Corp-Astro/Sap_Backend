import { IsDateString, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PlanDistributionItem {
  @IsNumber()
  count: number = 0;

  @IsNumber()
  percentage: number = 0;

  constructor(partial?: Partial<PlanDistributionItem>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}

export class SubscriptionAnalyticsResponse {
  @IsDateString()
  date: string = new Date().toISOString();

  @IsNumber()
  totalSubscribers: number = 0;

  @IsNumber()
  activeSubscriptions: number = 0;

  @IsNumber()
  monthlyRecurringRevenue: number = 0;

  @IsNumber()
  annualRecurringRevenue: number = 0;

  @IsNumber()
  averageRevenuePerUser: number = 0;

  @IsNumber()
  churnRate: number = 0;

  @IsNumber()
  newSubscribers: number = 0;

  @IsNumber()
  churned: number = 0;

  @IsNumber()
  conversionRate: number = 0;

  @IsNumber()
  lifetimeValue: number = 0;

  @ValidateNested()
  @Type(() => PlanDistributionItem)
  planDistribution: Record<string, PlanDistributionItem> = {};

  @IsNumber()
  upgradedRate: number = 0;

  @IsNumber()
  downgradedRate: number = 0;

  @IsNumber()
  freeTrialConversions: number = 0;

  @IsNumber()
  renewalRate: number = 0;

  constructor(partial?: Partial<SubscriptionAnalyticsResponse>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}

export class DateRangeDto {
  @IsDateString()
  startDate: string = new Date().toISOString();

  @IsDateString()
  endDate: string = new Date().toISOString();

  @IsString()
  @IsOptional()
  appId?: string;

  constructor(partial?: Partial<DateRangeDto>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
