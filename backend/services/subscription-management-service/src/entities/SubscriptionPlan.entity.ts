/**
 * SubscriptionPlan Entity
 * Represents a subscription plan that users can subscribe to
 *
 * @swagger
 * components:
 *   schemas:
 *     BillingCycle:
 *       type: string
 *       enum:
 *         - monthly
 *         - quarterly
 *         - yearly
 *       example: monthly
 *       description: Frequency of billing
 *
 *     PlanStatus:
 *       type: string
 *       enum:
 *         - active
 *         - draft
 *         - archived
 *       example: active
 *       description: Current status of the plan
 *
 *     SubscriptionPlan:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - description
 *         - price
 *         - status
 *         - billingCycle
 *         - appId
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the subscription plan
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         name:
 *           type: string
 *           description: Name of the subscription plan
 *           example: Premium Plan
 *         description:
 *           type: string
 *           description: Detailed description of the subscription plan
 *           example: Access to all premium features with priority support
 *         price:
 *           type: number
 *           format: float
 *           description: Regular price of the plan
 *           example: 19.99
 *         annualPrice:
 *           type: number
 *           format: float
 *           description: Annual price (with discount if applicable)
 *           example: 199.99
 *           nullable: true
 *         billingCycle:
 *           $ref: '#/components/schemas/BillingCycle'
 *         trialDays:
 *           type: integer
 *           description: Number of days in trial period
 *           example: 14
 *           nullable: true
 *         status:
 *           $ref: '#/components/schemas/PlanStatus'
 *         appId:
 *           type: string
 *           format: uuid
 *           description: ID of the application this plan belongs to
 *         features:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Unlimited Storage
 *               description:
 *                 type: string
 *                 example: Store unlimited files in your account
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the plan was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the plan was last updated
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
import { PlanFeature } from './PlanFeature.entity';
import { Subscription } from './Subscription.entity';
import { PromoCodeApplicablePlan } from './PromoCodeApplicablePlan.entity';
import { App } from './App.entity';

export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

export enum PlanStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  ARCHIVED = 'archived'
}

@Entity('subscription_plan')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  annualPrice!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discountPercentage!: number;

  @Column({
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY
  })
  billingCycle!: BillingCycle;

  @Column({ type: 'uuid' })
  @Index('IDX_SUBSCRIPTION_PLAN_APP_ID')
  appId!: string;
  
  @ManyToOne(() => App, app => app.plans)
  @JoinColumn()
  app!: App;

  @Column({ type: 'int', default: 0 })
  trialDays!: number;

  @Column({
    type: 'enum',
    enum: PlanStatus,
    default: PlanStatus.DRAFT
  })
  status!: PlanStatus;

  @Column({ type: 'varchar', nullable: true })
  highlight!: string;

  @Column({ type: 'int', default: 0 })
  sortPosition!: number;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'timestamp' })
  effectiveDate!: Date;

  @Column({ type: 'int', nullable: true })
  maxUsers!: number;

  @Column({ type: 'boolean', default: false })
  enterprisePricing!: boolean;

  @Column({ type: 'varchar', default: '₹' })
  currency!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  growthRate!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  conversionRate!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  churnRate!: number;

  @OneToMany(() => PlanFeature, feature => feature.plan, { cascade: true })
  features!: PlanFeature[];

  @OneToMany(() => Subscription, subscription => subscription.plan)
  subscriptions!: Subscription[];
  
  @OneToMany(() => PromoCodeApplicablePlan, applicablePlan => applicablePlan.plan)
  applicablePromoCodes!: PromoCodeApplicablePlan[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
