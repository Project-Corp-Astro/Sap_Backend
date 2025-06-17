/**
 * Common interfaces for the subscription management service
 */

// App entity representing application with subscription plans
export interface App {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
  activeUsers?: number;
  totalPlans?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription Plan entity
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  annualPrice?: number;
  discountPercentage?: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  appId: string;
  trialDays: number;
  status: 'active' | 'draft' | 'archived';
  highlight?: string;
  sortPosition?: number;
  version: number;
  effectiveDate: Date;
  createdAt: Date;
  updatedAt: Date;
  maxUsers?: number;
  enterprisePricing?: boolean;
  currency?: string;
  growthRate?: number;
  conversionRate?: number;
  churnRate?: number;
}

// Plan Feature entity
export interface PlanFeature {
  id: string;
  name: string;
  planId: string;
  included: boolean;
  limit?: number;
  category: string;
  description?: string;
  isPopular?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription entity - tracks active subscriptions
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  appId: string;
  status: 'active' | 'trialing' | 'canceled' | 'expired';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date;
  canceledAt?: Date;
  startDate: Date;
  endDate?: Date;
  trialStartDate?: Date;
  trialEndDate?: Date;
  quantity: number;
  totalAmount: number;
  currency: string;
  paymentMethod?: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription Analytics entity
export interface SubscriptionAnalytics {
  id: string;
  appId?: string;
  planId?: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  averageRevenuePerUser: number;
  totalSubscribers: number;
  activeSubscribers: number;
  churnRate: number;
  conversionRate: number;
  createdAt: Date;
  updatedAt: Date;
}

// Payment entity - represents payment transactions for subscriptions
export type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded' | 'partial_refund';

export interface Payment {
  id: string;
  subscriptionId: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  paymentIntentId?: string;
  invoiceId?: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

// SubscriptionEvent entity - logs important events in a subscription's lifecycle
export type SubscriptionEventType = 'created' | 'renewed' | 'canceled' | 'expired' | 'updated' | 
  'payment_failed' | 'trial_started' | 'trial_ended';

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  userId: string;
  eventType: SubscriptionEventType;
  eventData: Record<string, any>; // JSON data with event details
  createdAt: Date;
}

// PromoCode entity - defines promotional offers
export type DiscountType = 'percentage' | 'fixed';
export type ApplicableType = 'all' | 'specific_plans' | 'specific_users';

export interface PromoCode {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: Date;
  endDate?: Date;
  usageLimit?: number;
  usageCount: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  isActive: boolean;
  isFirstTimeOnly: boolean;
  applicableTo: ApplicableType;
  applicableItems: string[];
  createdAt: Date;
  updatedAt: Date;
}

// PromoCodeApplicablePlan entity - links promo codes to specific plans
export interface PromoCodeApplicablePlan {
  id: string;
  promoCodeId: string;
  planId: string;
  createdAt: Date;
}

// PromoCodeApplicableUser entity - links promo codes to specific users
export interface PromoCodeApplicableUser {
  id: string;
  promoCodeId: string;
  userId: string;
  userGroup?: string;
  createdAt: Date;
}

// SubscriptionPromoCode entity - records when promo codes are applied to subscriptions
export interface SubscriptionPromoCode {
  id: string;
  subscriptionId: string;
  promoCodeId: string;
  discountAmount: number;
  appliedDate: Date;
  isActive: boolean;
  createdAt: Date;
}

