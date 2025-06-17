/**
 * Types and enums used in the subscription management service
 */
import { FindOptionsWhere } from 'typeorm';
import { 
  Subscription, 
  SubscriptionPlan, 
  SubscriptionEvent, 
  Payment, 
  PromoCode,
  SubscriptionPromoCode,
  PlanFeature
} from './index';

// Status enums for entities
export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  CANCELED = 'canceled',
  EXPIRED = 'expired'
}

export enum PlanStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  ARCHIVED = 'archived'
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

// TypeORM FindOptions type helpers
export type SubscriptionWhere = FindOptionsWhere<Subscription>;
export type SubscriptionPlanWhere = FindOptionsWhere<SubscriptionPlan>;
export type SubscriptionEventWhere = FindOptionsWhere<SubscriptionEvent>;
export type PaymentWhere = FindOptionsWhere<Payment>;
export type PromoCodeWhere = FindOptionsWhere<PromoCode>;
export type SubscriptionPromoCodeWhere = FindOptionsWhere<SubscriptionPromoCode>;
export type PlanFeatureWhere = FindOptionsWhere<PlanFeature>;

// Subscription creation data type
export interface SubscriptionCreationData {
  userId: string;
  appId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle?: BillingCycle;
  startDate?: Date;
  quantity?: number;
  paymentMethodId?: string;
  promoCodeDetails?: {
    promoCodeId: string;
    discountAmount: number;
  };
}

// Error response type
export interface ErrorResponse {
  message: string;
  error?: string;
}

// Success response type
export interface SuccessResponse<T = any> {
  message?: string;
  data?: T;
}

// Promo code validation result
export interface PromoCodeValidationResult {
  isValid: boolean;
  message?: string;
  promoCode?: PromoCode;
  discountAmount?: number;
}
