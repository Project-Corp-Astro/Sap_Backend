/**
 * Subscription Entity
 * Represents a user's subscription to a plan
 *
 * @swagger
 * components:
 *   schemas:
 *     SubscriptionStatus:
 *       type: string
 *       enum:
 *         - active
 *         - canceled
 *         - expired
 *         - trial
 *         - past_due
 *         - unpaid
 *         - pending
 *       example: active
 *     
 *     PaymentMethod:
 *       type: string
 *       enum:
 *         - credit_card
 *         - bank_transfer
 *         - paypal
 *       example: credit_card
 *
 *     Subscription:
 *       type: object
 *       required:
 *         - id
 *         - userId
 *         - planId
 *         - appId
 *         - status
 *         - billingCycle
 *         - startDate
 *         - endDate
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the subscription
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         userId:
 *           type: string
 *           format: uuid
 *           description: User who owns this subscription
 *           example: 7b23e9a0-8c38-4127-8800-950642e78123
 *         planId:
 *           type: string
 *           format: uuid
 *           description: ID of the subscription plan
 *           example: f47ac10b-58cc-4372-a567-0e02b2c3d479
 *         appId:
 *           type: string
 *           format: uuid
 *           description: ID of the application this subscription is for
 *           example: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
 *         status:
 *           $ref: '#/components/schemas/SubscriptionStatus'
 *         billingCycle:
 *           type: string
 *           enum:
 *             - monthly
 *             - quarterly
 *             - semi_annual
 *             - annual
 *           description: Frequency of billing for this subscription
 *           example: monthly
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Date when the subscription started
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: Date when the subscription ends/renews
 *         trialEndDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Date when the trial period ends, if applicable
 *         canceledAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Date when the subscription was canceled
 *         cancelAtPeriodEnd:
 *           type: boolean
 *           description: Whether the subscription will be canceled at the end of the current period
 *           default: false
 *         cancellationReason:
 *           type: string
 *           nullable: true
 *           description: Reason for cancellation, if provided
 *         autoRenew:
 *           type: boolean
 *           description: Whether the subscription will automatically renew
 *           default: true
 *         paymentMethod:
 *           $ref: '#/components/schemas/PaymentMethod'
 *         amount:
 *           type: number
 *           format: float
 *           description: Amount charged for this subscription
 *         currency:
 *           type: string
 *           description: Currency for subscription payments
 *           example: USD
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the subscription record was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the subscription record was last updated
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index
} from 'typeorm';
import { SubscriptionPlan, BillingCycle } from './SubscriptionPlan.entity';
import { SubscriptionPromoCode } from './SubscriptionPromoCode.entity';
import { Payment } from './Payment.entity';
import { SubscriptionEvent } from './SubscriptionEvent.entity';
import { App } from './App.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIAL = 'trial',
  CANCELED = 'canceled',
  CANCELLED = 'canceled', // Alias for backward compatibility
  EXPIRED = 'expired',
  PAUSED = 'paused',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  PENDING = 'pending'
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  PAYPAL = 'paypal'
}

@Entity('subscription')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_SUBSCRIPTION_USER_ID')
  userId!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_SUBSCRIPTION_PLAN_ID')
  planId!: string;

  @ManyToOne(() => SubscriptionPlan, plan => plan.subscriptions)
  @JoinColumn()
  plan!: SubscriptionPlan;

  @Column({ type: 'uuid' })
  @Index('IDX_SUBSCRIPTION_APP_ID')
  appId!: string;

  @ManyToOne(() => App)
  @JoinColumn()
  app!: App;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING
  })
  status!: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: BillingCycle
  })
  billingCycle!: BillingCycle;

  @Column({ type: 'timestamp' })
  startDate!: Date;

  @Column({ type: 'timestamp' })
  endDate!: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEndDate!: Date;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt!: Date;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ type: 'text', nullable: true })
  cancellationReason!: string;

  @Column({ type: 'boolean', default: true })
  autoRenew!: boolean;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CREDIT_CARD
  })
  paymentMethod!: PaymentMethod;

  @Column({ type: 'varchar', nullable: true })
  paymentMethodId!: string;

  @Column({ type: 'int', default: 0 })
  currentPeriod!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', default: '₹' })
  currency!: string;

  @Column('jsonb', { nullable: true })
  metadata!: any;

  @OneToMany(() => Payment, payment => payment.subscription)
  payments!: Payment[];

  @OneToMany(() => SubscriptionEvent, event => event.subscription)
  events!: SubscriptionEvent[];
  
  @OneToMany(() => SubscriptionPromoCode, subscriptionPromoCode => subscriptionPromoCode.subscription)
  promoCodes!: SubscriptionPromoCode[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
