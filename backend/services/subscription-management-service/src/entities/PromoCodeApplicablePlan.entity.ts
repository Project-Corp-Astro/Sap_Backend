/**
 * PromoCodeApplicablePlan Entity
 * Links promo codes to specific subscription plans
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { PromoCode } from './PromoCode.entity';
import { SubscriptionPlan } from './SubscriptionPlan.entity';

@Entity('promo_code_applicable_plans')
export class PromoCodeApplicablePlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_PROMO_CODE_PLAN_PROMO_ID')
  promoCodeId!: string;

  @ManyToOne(() => PromoCode, { onDelete: 'CASCADE' })
  @JoinColumn()
  promoCode!: PromoCode;

  @Column({ type: 'uuid' })
  @Index('IDX_PROMO_CODE_PLAN_PLAN_ID')
  planId!: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn()
  plan!: SubscriptionPlan;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
