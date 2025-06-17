/**
 * Payment Entity
 * Represents a payment for a subscription
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Subscription } from './Subscription.entity';

export enum PaymentStatus {
  SUCCEEDED = 'succeeded',
  PENDING = 'pending',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIAL_REFUND = 'partial_refund'
}

@Entity('payment')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_PAYMENT_SUBSCRIPTION_ID')
  subscriptionId!: string;

  @ManyToOne(() => Subscription, subscription => subscription.payments)
  @JoinColumn()
  subscription!: Subscription;

  @Column({ type: 'uuid' })
  @Index('IDX_PAYMENT_USER_ID')
  userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', default: '₹' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING
  })
  status!: PaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod!: string;

  @Column({ type: 'varchar', nullable: true })
  paymentIntentId!: string;

  @Column({ type: 'varchar', nullable: true })
  invoiceId!: string;

  @Column({ type: 'timestamp' })
  billingPeriodStart!: Date;

  @Column({ type: 'timestamp' })
  billingPeriodEnd!: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
