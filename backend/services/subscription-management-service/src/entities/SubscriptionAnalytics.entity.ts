/**
 * SubscriptionAnalytics Entity
 * Represents analytics data for subscription metrics
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('subscription_analytics')
export class SubscriptionAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: "uuid", nullable: true })
  @Index("IDX_SUBSCRIPTION_ANALYTICS_APP_ID")
  appId!: string;
  
  @Column({ type: "date" })
  @Index("IDX_SUBSCRIPTION_ANALYTICS_DATE")
  date!: Date;

  @Column({ type: "int", default: 0 })
  totalSubscribers!: number;

  @Column({ type: "int", default: 0 })
  activeSubscriptions!: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  monthlyRecurringRevenue!: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  annualRecurringRevenue!: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  averageRevenuePerUser!: number;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  churnRate!: number;

  @Column({ type: "int", default: 0 })
  newSubscribers!: number;

  @Column({ type: "int", default: 0 })
  churned!: number;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  conversionRate!: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  lifetimeValue!: number;

  @Column({ type: "jsonb", default: "{}" })
  planDistribution!: Record<string, number>;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  upgradedRate!: number;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  downgradedRate!: number;

  @Column({ type: "int", default: 0 })
  freeTrialConversions!: number;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  renewalRate!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
