/**
 * SubscriptionEvent Entity
 * Represents events that occur during the subscription lifecycle
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
import { Subscription } from './Subscription.entity';

export enum SubscriptionEventType {
  CREATED = 'created',
  RENEWED = 'renewed',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  UPDATED = 'updated',
  PAYMENT_FAILED = 'payment_failed',
  TRIAL_STARTED = 'trial_started',
  TRIAL_ENDED = 'trial_ended'
}

@Entity('subscription_event')
export class SubscriptionEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_SUBSCRIPTION_EVENT_SUBSCRIPTION_ID')
  subscriptionId!: string;

  @ManyToOne(() => Subscription, subscription => subscription.events)
  @JoinColumn()
  subscription!: Subscription;

  @Column({ type: 'uuid' })
  @Index('IDX_SUBSCRIPTION_EVENT_USER_ID')
  userId!: string;

  @Column({
    type: 'enum',
    enum: SubscriptionEventType
  })
  eventType!: SubscriptionEventType;

  @Column({ type: 'jsonb' })
  eventData!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
