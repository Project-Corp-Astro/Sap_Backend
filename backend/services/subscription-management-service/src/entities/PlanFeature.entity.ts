/**
 * PlanFeature Entity
 * Represents a feature included in a subscription plan
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn
} from 'typeorm';
import { SubscriptionPlan } from './SubscriptionPlan.entity';

@Entity('plan_feature')
export class PlanFeature {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_PLAN_FEATURE_PLAN_ID')
  planId!: string;

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.features)
  @JoinColumn({ name: 'planId' })
  plan!: SubscriptionPlan;

  @Column({ type: 'boolean', default: false })
  included!: boolean;

  @Column({ type: 'int', nullable: true })
  limit!: number;

  @Column({ type: 'varchar', nullable: true })
  category!: string;

  @Column('text', { nullable: true })
  description!: string;

  @Column({ type: 'boolean', default: false })
  isPopular!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
