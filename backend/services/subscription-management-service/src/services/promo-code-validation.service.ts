import { PromoCode, DiscountType, ApplicableType } from '../entities/PromoCode.entity';
import { AppDataSource } from '../db/data-source';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/Subscription.entity';
import { PromoCodeApplicablePlan } from '../entities/PromoCodeApplicablePlan.entity';
import { PromoCodeApplicableUser } from '../entities/PromoCodeApplicableUser.entity';
import { SubscriptionPromoCode } from '../entities/SubscriptionPromoCode.entity';
import logger from '../utils/logger';
import { promoCache } from '../utils/redis';
import { CacheKeyUtils } from '../utils/cache-key-utils';
import { PromoCodeError, PromoCodeErrorCode } from '../errors/promo-code-error';

interface RedisService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: string | object, ttl?: number): Promise<boolean>;
}

export class PromoCodeValidationError extends PromoCodeError {
  constructor(message: string) {
    super(message, PromoCodeErrorCode.VALIDATION_ERROR);
  }
}

export interface PromoCodeValidationResult {
  isValid: boolean;
  message: string;
  promoCode?: PromoCode;
}

export class PromoCodeValidationService {
  /**
   * Validate promo code data before creation/update
   */
  async validatePromoCodeData(data: Partial<PromoCode>, isUpdate: boolean = false): Promise<void> {
    // Basic field validations
    if (!isUpdate) {
      if (!data.code?.trim()) {
        throw new PromoCodeValidationError('Promo code is required');
      }
      if (!data.description?.trim()) {
        throw new PromoCodeValidationError('Description is required');
      }
      if (!data.discountType || !Object.values(DiscountType).includes(data.discountType)) {
        throw new PromoCodeValidationError('Discount type must be "percentage" or "fixed"');
      }
      if (data.discountValue === undefined || data.discountValue <= 0) {
        throw new PromoCodeValidationError('Discount value must be a positive number');
      }
      if (!data.startDate) {
        throw new PromoCodeValidationError('Start date is required');
      }
      if (data.applicableTo === undefined || !Object.values(ApplicableType).includes(data.applicableTo)) {
        throw new PromoCodeValidationError('Applicable type must be "all", "specific_plans", or "specific_users"');
      }
    }

    // Validate code uniqueness
    if (data.code?.trim()) {
      const existingPromoCode = await this.promoCodeRepository.findOne({
        where: { code: data.code, isActive: true },
      });
      if (existingPromoCode && (!isUpdate || existingPromoCode.id !== data.id)) {
        throw new PromoCodeError(`Promo code ${data.code} already exists`, PromoCodeErrorCode.DUPLICATE_CODE);
      }
    }

    // Validate date range
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      throw new PromoCodeValidationError('End date must be after start date');
    }

    // Validate applicableTo specific requirements
    if (data.applicableTo === ApplicableType.SPECIFIC_PLANS && (!data.applicablePlans || data.applicablePlans.length === 0)) {
      throw new PromoCodeValidationError('At least one plan must be specified for specific plans');
    }

    if (data.applicableTo === ApplicableType.SPECIFIC_USERS && (!data.applicableUsers || data.applicableUsers.length === 0)) {
      throw new PromoCodeValidationError('At least one user must be specified for specific users');
    }

    // Check discount value constraints
    if (data.discountType === DiscountType.PERCENTAGE && data.discountValue && data.discountValue > 100) {
      throw new PromoCodeValidationError('Percentage discount cannot exceed 100%');
    }

    // Validate usage limit
    if (data.usageLimit !== undefined && data.usageLimit <= 0) {
      throw new PromoCodeValidationError('Usage limit must be a positive number');
    }
  }

  private readonly logger = logger;

  constructor(
    private promoCodeRepository: Repository<PromoCode>,
    private subscriptionPromoCodeRepository: Repository<SubscriptionPromoCode>,
    private subscriptionRepository: Repository<Subscription>,
    private redisService: RedisService = promoCache
  ) {}


  private async getPromoCodeDetails(promoCodeId: string): Promise<PromoCode | null> {
    return this.promoCodeRepository.findOne({
      where: { id: promoCodeId, isActive: true },
      relations: ['applicablePlans', 'applicableUsers']
    });
  }

  async validatePromoCode(promoCodeId: string, userId: string, planId: string): Promise<PromoCodeValidationResult> {
    const cacheKey = `promo:validate:${userId}:${planId}:${promoCodeId}`;

    try {
      const cachedResult = await this.redisService.get<PromoCodeValidationResult>(cacheKey);
      if (cachedResult) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return cachedResult;
      }

      const promoCode = await this.getPromoCodeDetails(promoCodeId);
      if (!promoCode) {
        const result = { isValid: false, message: 'Promo code not found' };
        await this.redisService.set(cacheKey, result, 120);
        return result;
      }

      await this.validateBasicStatus(promoCode);
      await this.validateUsageLimits(promoCode, userId);
      await this.validateDateRange(promoCode);
      await this.validatePlanApplicability(promoCode, planId);
      await this.validateUserEligibility(promoCode, userId);

      const result: PromoCodeValidationResult = { isValid: true, message: 'Promo code is valid', promoCode };
      await this.redisService.set(cacheKey, result, CacheKeyUtils.getTTL());
      return result;
    } catch (error) {
      this.logger.error('Error validating promo code for user', { error });
      return { isValid: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async validateBasicStatus(promoCode: PromoCode): Promise<void> {
    if (!promoCode.isActive) throw new PromoCodeValidationError('Promo code is inactive');
    const now = new Date();
    if (promoCode.startDate > now) throw new PromoCodeValidationError('Promo code is not yet active');
    if (promoCode.endDate && promoCode.endDate < now) throw new PromoCodeValidationError('Promo code has expired');
  }

  private async validateUsageLimits(promoCode: PromoCode, userId: string): Promise<void> {
    // Check total usage limit
    if (typeof promoCode.usageLimit === 'number' && promoCode.usageCount >= promoCode.usageLimit) {
      throw new PromoCodeValidationError('Promo code has reached its maximum usage limit');
    }

    // Check per-user usage limit (assuming 1 use per user)
    const userUsageCount = await this.subscriptionPromoCodeRepository.count({
      where: {
        promoCodeId: promoCode.id,
        subscription: {
          userId: userId,
        },
      },
    });

    if (userUsageCount > 0) {
      throw new PromoCodeValidationError('You have already used this promo code');
    }
  }

  private async validateDateRange(promoCode: PromoCode): Promise<void> {
    const now = new Date();
    if (promoCode.startDate && promoCode.startDate > now) {
      throw new PromoCodeValidationError('Promo code is not yet active');
    }
    if (promoCode.endDate && promoCode.endDate < now) {
      throw new PromoCodeValidationError('Promo code has expired');
    }
  }

  private async validatePlanApplicability(promoCode: PromoCode, planId: string): Promise<void> {
    if (promoCode.applicableTo === ApplicableType.SPECIFIC_PLANS) {
      const applicablePlan = promoCode.applicablePlans.find((p) => p.planId === planId);
      if (!applicablePlan) {
        throw new PromoCodeValidationError('Promo code is not applicable to this plan');
      }
    }
  }

  private async validateUserEligibility(promoCode: PromoCode, userId: string): Promise<void> {
    if (promoCode.applicableTo === ApplicableType.SPECIFIC_USERS) {
      const applicableUser = promoCode.applicableUsers.find((u) => u.userId === userId);
      if (!applicableUser) {
        throw new PromoCodeValidationError('Promo code is not applicable to this user');
      }
    }

    if (promoCode.isFirstTimeOnly) {
      const hasPreviousSubscription = await this.hasPreviousSubscription(userId);
      if (hasPreviousSubscription) {
        throw new PromoCodeValidationError('Promo code is only valid for first-time users');
      }
    }
  }

  private async hasPreviousSubscription(userId: string): Promise<boolean> {
    const count = await this.subscriptionRepository.count({ where: { userId } });
    return count > 0;
  }
}
