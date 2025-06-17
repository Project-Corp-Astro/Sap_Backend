/**
 * SubscriptionPromoCode Entity
 * Links subscriptions to promo codes
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
import { Subscription } from './Subscription.entity';

@Entity('subscription_promo_codes')
export class SubscriptionPromoCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_SUBSCRIPTION_PROMO_SUB_ID')
  subscriptionId!: string;

  @ManyToOne(() => Subscription)
  @JoinColumn()
  subscription!: Subscription;

  @Column({ type: 'uuid' })
  @Index('IDX_SUBSCRIPTION_PROMO_CODE_ID')
  promoCodeId!: string;

  @ManyToOne(() => PromoCode)
  @JoinColumn()
  promoCode!: PromoCode;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  discountAmount!: number;

  @Column({ type: 'date' })
  appliedDate!: Date;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
