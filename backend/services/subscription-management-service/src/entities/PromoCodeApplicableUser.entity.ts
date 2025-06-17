/**
 * PromoCodeApplicableUser Entity
 * Links promo codes to specific users or user groups
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

@Entity('promo_code_applicable_users')
export class PromoCodeApplicableUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_PROMO_CODE_USER_PROMO_ID')
  promoCodeId!: string;

  @ManyToOne(() => PromoCode, { onDelete: 'CASCADE' })
  @JoinColumn()
  promoCode!: PromoCode;

  @Column({ type: 'uuid' })
  @Index('IDX_PROMO_CODE_USER_USER_ID')
  userId!: string;

  // User entity would typically be in a different service, so we just reference by ID

  @Column({ type: 'varchar', nullable: true })
  userGroup!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
