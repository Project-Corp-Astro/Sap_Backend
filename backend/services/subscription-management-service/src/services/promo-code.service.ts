import { FindOptionsWhere, In, Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { PromoCode } from '../entities/PromoCode.entity';
import { SubscriptionPromoCode } from '../entities/SubscriptionPromoCode.entity';
import { PromoCodeApplicablePlan } from '../entities/PromoCodeApplicablePlan.entity';
import { PromoCodeApplicableUser } from '../entities/PromoCodeApplicableUser.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import logger from '../utils/logger';

export class PromoCodeService {
  private promoCodeRepository!: Repository<PromoCode>;
  private subscriptionPromoCodeRepository!: Repository<SubscriptionPromoCode>;
  private applicablePlanRepository!: Repository<PromoCodeApplicablePlan>;
  private applicableUserRepository!: Repository<PromoCodeApplicableUser>;
  private planRepository!: Repository<SubscriptionPlan>;
  
  constructor() {
    // Initialize repositories immediately
    this.initializeRepositories();
  }
  
  private initializeRepositories() {
    try {
      this.promoCodeRepository = AppDataSource.getRepository(PromoCode);
      this.subscriptionPromoCodeRepository = AppDataSource.getRepository(SubscriptionPromoCode);
      this.applicablePlanRepository = AppDataSource.getRepository(PromoCodeApplicablePlan);
      this.applicableUserRepository = AppDataSource.getRepository(PromoCodeApplicableUser);
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
    } catch (error) {
      logger.error('Failed to initialize repositories in PromoCodeService:', error);
    }
  }

  /**
   * Get all promo codes - Admin access
   */
  async getAllPromoCodes(filters: Partial<Omit<PromoCode, 'applicableItems'>> = {}) {
    try {
      return await this.promoCodeRepository.find({
        where: filters,
        relations: ['applicablePlans', 'applicableUsers']
      });
    } catch (error) {
      logger.error('Error getting all promo codes:', error);
      throw error;
    }
  }

  /**
   * Get promo code by ID - Admin access
   */
  async getPromoCodeById(id: string) {
    try {
      return await this.promoCodeRepository.findOne({
        where: { id },
        relations: ['applicablePlans', 'applicableUsers']
      });
    } catch (error) {
      logger.error(`Error getting promo code ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new promo code - Admin access
   */
  async createPromoCode(promoCodeData: Partial<PromoCode>) {
    try {
      const promoCode = this.promoCodeRepository.create({
        ...promoCodeData,
        isActive: true,
        usageCount: 0,
        createdAt: new Date()
      });
      
      return await this.promoCodeRepository.save(promoCode);
    } catch (error) {
      logger.error('Error creating promo code:', error);
      throw error;
    }
  }

  /**
   * Update a promo code - Admin access
   */
  async updatePromoCode(id: string, promoCodeData: Partial<PromoCode>) {
    try {
      await this.promoCodeRepository.update(id, promoCodeData);
      return await this.getPromoCodeById(id);
    } catch (error) {
      logger.error(`Error updating promo code ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a promo code - Admin access
   */
  async deletePromoCode(id: string) {
    try {
      return await this.promoCodeRepository.delete(id);
    } catch (error) {
      logger.error(`Error deleting promo code ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add applicable plans to a promo code - Admin access
   */
  async addApplicablePlans(promoCodeId: string, planIds: string[]) {
    try {
      const entries = planIds.map(planId => ({
        promoCodeId,
        planId
      }));
      
      return await this.applicablePlanRepository.save(entries);
    } catch (error) {
      logger.error(`Error adding applicable plans to promo code ${promoCodeId}:`, error);
      throw error;
    }
  }

  /**
   * Add applicable users to a promo code - Admin access
   */
  async addApplicableUsers(promoCodeId: string, userIds: string[]) {
    try {
      const entries = userIds.map(userId => ({
        promoCodeId,
        userId
      }));
      
      return await this.applicableUserRepository.save(entries);
    } catch (error) {
      logger.error(`Error adding applicable users to promo code ${promoCodeId}:`, error);
      throw error;
    }
  }

  /**
   * Validate a promo code for a specific user and plan
   * Returns validation result and discount information
   */
  async validatePromoCode(code: string, userId: string, planId: string) {
    try {
      // Find the promo code
      const promoCode = await this.promoCodeRepository.findOne({
        where: { code, isActive: true }
      });
      
      if (!promoCode) {
        return { 
          isValid: false, 
          message: 'Invalid promo code' 
        };
      }
      
      // Check if expired
      if (promoCode.endDate && new Date() > new Date(promoCode.endDate)) {
        return { 
          isValid: false, 
          message: 'Promo code has expired' 
        };
      }
      
      // Check usage limit
      if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
        return { 
          isValid: false, 
          message: 'Promo code usage limit reached' 
        };
      }
      
      // Check applicable type
      if (promoCode.applicableTo === 'specific_plans') {
        const planMatch = await this.applicablePlanRepository.findOne({
          where: { promoCodeId: promoCode.id, planId }
        });
        
        if (!planMatch) {
          return { 
            isValid: false, 
            message: 'Promo code not applicable to this plan' 
          };
        }
      }
      
      if (promoCode.applicableTo === 'specific_users') {
        const userMatch = await this.applicableUserRepository.findOne({
          where: { promoCodeId: promoCode.id, userId }
        });
        
        if (!userMatch) {
          return { 
            isValid: false, 
            message: 'Promo code not applicable to this user' 
          };
        }
      }
      
      // Check if first-time only
      if (promoCode.isFirstTimeOnly) {
        const previousUsage = await this.subscriptionPromoCodeRepository.findOne({
          where: { promoCodeId: promoCode.id } as FindOptionsWhere<SubscriptionPromoCode>
        });
        
        if (previousUsage) {
          return { 
            isValid: false, 
            message: 'Promo code can only be used once per user' 
          };
        }
      }
      
      // Calculate discount
      const plan = await this.planRepository.findOne({ where: { id: planId } });
      if (!plan) {
        return { 
          isValid: false, 
          message: 'Invalid subscription plan' 
        };
      }
      
      const discountAmount = this.calculateDiscount(promoCode, plan.price);
      
      return {
        isValid: true,
        promoCode,
        discountAmount,
        message: 'Promo code applied successfully'
      };
    } catch (error) {
      logger.error(`Error validating promo code ${code}:`, error);
      throw error;
    }
  }

  /**
   * Apply a promo code to a subscription
   */
  async applyPromoCode(subscriptionId: string, userId: string, promoCodeId: string, discountAmount: number) {
    try {
      // Increment usage count
      await this.promoCodeRepository.increment(
        { id: promoCodeId },
        'usageCount',
        1
      );
      
      // Create subscription-promo code link
      const subscriptionPromoCode = this.subscriptionPromoCodeRepository.create({
        promoCode: { id: promoCodeId } as PromoCode,
        discountAmount,
        appliedDate: new Date(),
        isActive: true
      });
      
      return await this.subscriptionPromoCodeRepository.save(subscriptionPromoCode);
    } catch (error) {
      logger.error(`Error applying promo code ${promoCodeId} to subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate discount amount based on promo code type and plan price
   */
  private calculateDiscount(promoCode: PromoCode, planPrice: number): number {
    if (promoCode.discountType === 'percentage') {
      return (planPrice * promoCode.discountValue) / 100;
    } else if (promoCode.discountType === 'fixed') {
      return Math.min(promoCode.discountValue, planPrice);
    }
    return 0;
  }
}

export default new PromoCodeService();
