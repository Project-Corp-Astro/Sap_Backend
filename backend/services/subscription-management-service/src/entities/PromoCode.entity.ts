/**
 * PromoCode Entity
 * Represents promotional codes for subscription discounts
 *
 * @swagger
 * components:
 *   schemas:
 *     DiscountType:
 *       type: string
 *       enum:
 *         - percentage
 *         - fixed
 *       example: percentage
 *       description: Type of discount (percent off or fixed amount)
 *
 *     ApplicableType:
 *       type: string
 *       enum:
 *         - all
 *         - specific_plans
 *         - specific_users
 *       example: all
 *       description: Which plans or users the promo code can be used for
 *
 *     PromoCode:
 *       type: object
 *       required:
 *         - id
 *         - code
 *         - description
 *         - discountType
 *         - discountValue
 *         - maxUses
 *         - validFrom
 *         - validTo
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the promo code
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         code:
 *           type: string
 *           description: The actual promo code string that users input
 *           example: SUMMER2025
 *         description:
 *           type: string
 *           description: Description of the promo code for admin reference
 *           example: Summer 2025 promotion - 20% off all plans
 *         discountType:
 *           $ref: '#/components/schemas/DiscountType'
 *         discountValue:
 *           type: number
 *           format: float
 *           description: The value of the discount (percentage or fixed amount)
 *           example: 20.00
 *         maxUses:
 *           type: integer
 *           description: Maximum number of times this code can be used
 *           example: 100
 *         usedCount:
 *           type: integer
 *           description: Number of times this code has been used
 *           example: 45
 *         maxUsesPerUser:
 *           type: integer
 *           description: Maximum number of times a single user can use this code
 *           example: 1
 *         applicableType:
 *           $ref: '#/components/schemas/ApplicableType'
 *         validFrom:
 *           type: string
 *           format: date-time
 *           description: Start date when the code becomes valid
 *         validTo:
 *           type: string
 *           format: date-time
 *           description: End date when the code expires
 *         isActive:
 *           type: boolean
 *           description: Whether the promo code is active
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the promo code was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the promo code was last updated
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index
} from 'typeorm';
import { SubscriptionPromoCode } from './SubscriptionPromoCode.entity';
import { PromoCodeApplicablePlan } from './PromoCodeApplicablePlan.entity';
import { PromoCodeApplicableUser } from './PromoCodeApplicableUser.entity';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed'
}

export enum ApplicableType {
  ALL = 'all',
  SPECIFIC_PLANS = 'specific_plans',
  SPECIFIC_USERS = 'specific_users'
}

@Entity('promo_codes')
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  @Index('IDX_PROMO_CODE')
  code!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: DiscountType,
    default: DiscountType.PERCENTAGE
  })
  discountType!: DiscountType;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  discountValue!: number;

  @Column({ type: 'date' })
  startDate!: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ type: 'int', nullable: true })
  usageLimit?: number;

  @Column({ type: 'int', default: 0 })
  usageCount!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  minPurchaseAmount?: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  maxDiscountAmount?: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  isFirstTimeOnly!: boolean;

  @Column({
    type: 'enum',
    enum: ApplicableType,
    default: ApplicableType.ALL
  })
  applicableTo!: ApplicableType;

  // Store as JSON array
  @Column({ type: 'jsonb', default: '[]' })
  applicableItems!: string[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @OneToMany(() => SubscriptionPromoCode, subscriptionPromoCode => subscriptionPromoCode.promoCode)
  subscriptionPromoCodes!: SubscriptionPromoCode[];

  @OneToMany(() => PromoCodeApplicablePlan, applicablePlan => applicablePlan.promoCode)
  applicablePlans!: PromoCodeApplicablePlan[];

  @OneToMany(() => PromoCodeApplicableUser, applicableUser => applicableUser.promoCode)
  applicableUsers!: PromoCodeApplicableUser[];
}
