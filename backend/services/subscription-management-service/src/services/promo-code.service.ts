  import { 
  FindOptionsWhere, 
  Repository, 
  Like, 
  In, 
  EntityManager, 
  Brackets,
  SelectQueryBuilder 
} from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { PromoCode, DiscountType } from '../entities/PromoCode.entity';
import { CacheKeyUtils } from '../utils/cache-key-utils';
import { Subscription } from '../entities/Subscription.entity';
import { SubscriptionPromoCode } from '../entities/SubscriptionPromoCode.entity';
import { PromoCodeApplicablePlan } from '../entities/PromoCodeApplicablePlan.entity';
import { PromoCodeApplicableUser } from '../entities/PromoCodeApplicableUser.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import logger from '../utils/logger';
import { promoCache } from '../utils/redis';
import { PromoCodeValidationService, PromoCodeValidationError } from './promo-code-validation.service';
import { NotFoundError, BadRequestError } from '../errors/api-error';


interface QueryFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  sort?: string;
  discountType?: 'percentage' | 'fixed';
}

interface PromoCodesResponse {
  items: PromoCode[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}

export class PromoCodeService {
  private readonly redisDb: number = 3;
  private validationService: PromoCodeValidationService;

  constructor() {
    this.validationService = new PromoCodeValidationService(
      AppDataSource.getRepository(PromoCode),
      AppDataSource.getRepository(SubscriptionPromoCode),
      AppDataSource.getRepository(Subscription)
    );
  }

  private async invalidatePromoCache(promoCodeId?: string): Promise<void> {
    try {
      const client = promoCache.getClient();
      const matchPattern = 'subscription:promos:all_promo_codes:*';
      const keysToDelete: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', matchPattern, 'COUNT', '100');
        cursor = nextCursor;
        if (keys.length > 0) {
          keysToDelete.push(...keys);
        }
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await client.del(keysToDelete);
      }

      if (promoCodeId) {
        await this.invalidateSinglePromoCache(promoCodeId);
      }
    } catch (error) {
      logger.error('Error invalidating promo cache:', error);
    }
  }

  private async invalidateSinglePromoCache(promoCodeId: string): Promise<void> {
    try {
      const cacheKey = `promo_code:${promoCodeId}`;
      await promoCache.del(cacheKey);

      const validationCacheKey = `promo_validation:${promoCodeId}:*`;
      const keysToDelete = await promoCache.keys(validationCacheKey);
      if (keysToDelete.length > 0) {
        await promoCache.getClient().del(...keysToDelete);
      }
    } catch (error) {
      logger.error(`Error invalidating single promo cache for ID ${promoCodeId}:`, error);
    }
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private log(message: string, data?: any): void {
    // Removed console logging
  }

  private error(message: string, error?: any): void {
    // Removed console error logging
  }

  async getAllPromoCodes(filters: QueryFilters = {}): Promise<PromoCodesResponse> {
    try {
      const page = filters.page || 1;
      const pageSize = 10;
      const skip = (page - 1) * pageSize;
      const searchTerm = filters.search || '';
      const sortOrder = filters.sort || 'createdAt_desc';
  
      let statusFilter = filters.status ? filters.status.toLowerCase() : undefined;
      let discountTypeFilter = filters.discountType;
  
      if (statusFilter === 'percentage' || statusFilter === 'fixed') {
        discountTypeFilter = statusFilter as 'percentage' | 'fixed';
        statusFilter = undefined;
      }
      
      // Generate cache key with all relevant filters and current date
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `promo_codes:${today}:${JSON.stringify({
        status: statusFilter,
        discountType: discountTypeFilter,
        search: searchTerm,
        sort: sortOrder,
        page,
        pageSize
      })}`;
  
      const promoCodeRepo = AppDataSource.getRepository(PromoCode);
      const queryBuilder = promoCodeRepo.createQueryBuilder('promoCode')
        .leftJoinAndSelect('promoCode.applicablePlans', 'applicablePlans')
        .leftJoinAndSelect('promoCode.applicableUsers', 'applicableUsers');
  
      const now = new Date();
      
      if (statusFilter) {
        if (statusFilter === 'active') {
          queryBuilder.andWhere('promoCode.isActive = :isActive', { isActive: true });
        } else if (statusFilter === 'expired') {
          queryBuilder.andWhere(new Brackets((qb) => {
            qb.where('promoCode.isActive = :isActive', { isActive: false })
              .orWhere('promoCode.endDate < :now', { now });
          }));
        }
      } 
  
      if (discountTypeFilter) {
        const normalizedDiscountType = discountTypeFilter.toLowerCase();
        if (normalizedDiscountType === 'percentage' || normalizedDiscountType === 'fixed') {
          queryBuilder.andWhere('promoCode.discountType = :discountType', {
            discountType: normalizedDiscountType
          });
        }
        
        
        const sql = queryBuilder.getQueryAndParameters();
      }
        
       
      
  
      if (searchTerm) {
        const searchPattern = `%${searchTerm.toLowerCase()}%`;
        queryBuilder.andWhere(
          '(LOWER(promoCode.code) LIKE :search OR LOWER(promoCode.description) LIKE :search)',
          { search: searchPattern }
        );
      }
  
      const total = await queryBuilder.getCount();
  
      logger.debug('Processing sort order:', { sortOrder, type: typeof sortOrder });
      
      // Default values
      let field = 'createdAt';
      let direction: 'ASC' | 'DESC' = 'DESC';

      // Parse sort parameter if provided
      if (sortOrder && typeof sortOrder === 'string') {
        const parts = sortOrder.split('_');
        
        // Validate and set sort field
        if (parts[0]) {
          const validFields = ['id', 'code', 'createdAt', 'updatedAt', 'startDate', 'endDate', 'discountValue'];
          if (validFields.includes(parts[0])) {
            field = parts[0];
          } else {
            logger.warn(`Invalid sort field: ${parts[0]}, using default`);
          }
        }
        
        // Validate and set sort direction
        if (parts[1]) {
          const dir = parts[1].toUpperCase();
          if (dir === 'ASC' || dir === 'DESC') {
            direction = dir;
          } else {
            logger.warn(`Invalid sort direction: ${parts[1]}, using default`);
          }
        }
      }
      
      // Apply sorting with explicit string literals to ensure type safety
      logger.debug('Applying sort:', { field, direction });
      
      // Use a type assertion to ensure TypeScript understands our direction is valid
      type SortDirection = 'ASC' | 'DESC';
      const sortDir: SortDirection = direction === 'ASC' ? 'ASC' : 'DESC';
      
      // Apply sorting using the safe field and direction
      switch (field) {
        case 'id':
          queryBuilder.orderBy('promoCode.id', sortDir);
          break;
        case 'code':
          queryBuilder.orderBy('promoCode.code', sortDir);
          break;
        case 'createdAt':
          queryBuilder.orderBy('promoCode.createdAt', sortDir);
          break;
        case 'updatedAt':
          queryBuilder.orderBy('promoCode.updatedAt', sortDir);
          break;
        case 'startDate':
          queryBuilder.orderBy('promoCode.startDate', sortDir);
          break;
        case 'endDate':
          queryBuilder.orderBy('promoCode.endDate', sortDir);
          break;
        case 'discountValue':
          queryBuilder.orderBy('promoCode.discountValue', sortDir);
          break;
        default:
          // Fallback to default sorting
          queryBuilder.orderBy('promoCode.createdAt', 'DESC');
      }
  
      queryBuilder.skip(skip).take(pageSize);
      const promoCodes = await queryBuilder.getMany();
  
      // Prepare response
      const result = {
        items: promoCodes,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        totalItems: total,
      };
  
      const ttl = CacheKeyUtils.getTTL();
      await promoCache.set(cacheKey, result, ttl);
      return {
        items: promoCodes,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        totalItems: total,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error executing promo code query:', error);
      throw new Error(`Failed to fetch promo codes: ${errorMessage}`);
    }
  }
  async getPromoCodeById(id: string): Promise<PromoCode | null> {
    const cacheKey = `promo_code:${id}`;
    const cachedData = await promoCache.get<PromoCode>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const promoCode = await AppDataSource.getRepository(PromoCode).findOne({
      where: { id },
      relations: ['applicablePlans', 'applicableUsers'],
    });

    if (promoCode) {
      await promoCache.set(cacheKey, promoCode, 3600);
    }

    return promoCode;
  }

  async createPromoCode(promoCodeData: Partial<PromoCode>): Promise<PromoCode> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      const promoCodeRepo = transactionalEntityManager.getRepository(PromoCode);

      // --- Business Logic and Validation ---
      if (!promoCodeData.code || promoCodeData.code.trim() === '') {
        throw new BadRequestError('Promo code cannot be empty.');
      }
      if (promoCodeData.discountType == null || promoCodeData.discountValue == null) {
        throw new BadRequestError('Discount type and value are required.');
      }

      const existingCode = await promoCodeRepo.findOne({ where: { code: promoCodeData.code } });
      if (existingCode) {
        throw new BadRequestError(`Promo code "${promoCodeData.code}" already exists.`);
      }

      if (promoCodeData.discountType === DiscountType.PERCENTAGE && (promoCodeData.discountValue < 1 || promoCodeData.discountValue > 100)) {
        throw new BadRequestError('Percentage discount must be between 1 and 100.');
      }
      if (promoCodeData.discountType === DiscountType.FIXED && promoCodeData.discountValue <= 0) {
        throw new BadRequestError('Fixed discount must be a positive number.');
      }
      if (promoCodeData.endDate && new Date(promoCodeData.endDate) <= new Date()) {
        throw new BadRequestError('Expiration date must be in the future.');
      }
      if (promoCodeData.usageLimit != null && promoCodeData.usageLimit <= 0) {
        throw new BadRequestError('Max uses must be a positive number.');
      }
      // --- End Validation ---

      const promoCode = promoCodeRepo.create({
        ...promoCodeData,
        isActive: promoCodeData.isActive ?? true,
        usageCount: 0,
      });

      const savedPromoCode = await promoCodeRepo.save(promoCode);

      if (promoCodeData.applicablePlans?.length) {
        await this._addApplicablePlans(transactionalEntityManager, savedPromoCode.id, promoCodeData.applicablePlans.map(p => p.id));
      }

      if (promoCodeData.applicableUsers?.length) {
        await this._addApplicableUsers(transactionalEntityManager, savedPromoCode.id, promoCodeData.applicableUsers.map(u => u.id));
      }

      await this.invalidatePromoCache();
      logger.info(`Created promo code with ID ${savedPromoCode.id}, invalidated cache.`);

      return savedPromoCode;
    });
  }

  async updatePromoCode(id: string, promoCodeData: Partial<PromoCode>): Promise<PromoCode> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      const promoCodeRepo = transactionalEntityManager.getRepository(PromoCode);
      const promoCode = await promoCodeRepo.findOne({ where: { id } });

      if (!promoCode) {
        throw new NotFoundError('Promo code not found');
      }

      // --- Business Logic and Validation ---
      if (promoCodeData.code && promoCodeData.code !== promoCode.code) {
        const existingCode = await promoCodeRepo.findOne({ where: { code: promoCodeData.code } });
        if (existingCode) {
          throw new BadRequestError(`Promo code "${promoCodeData.code}" already exists.`);
        }
      }
      if (promoCodeData.discountType && promoCodeData.discountType !== promoCode.discountType) {
        throw new BadRequestError('Cannot change the discount type of an existing promo code.');
      }

      const finalType = promoCode.discountType;
      const finalValue = promoCodeData.discountValue ?? promoCode.discountValue;

      if (finalType === DiscountType.PERCENTAGE && (finalValue < 1 || finalValue > 100)) {
        throw new BadRequestError('Percentage discount must be between 1 and 100.');
      }
      if (finalType === DiscountType.FIXED && finalValue <= 0) {
        throw new BadRequestError('Fixed discount must be a positive number.');
      }

      if (promoCodeData.endDate && new Date(promoCodeData.endDate) <= new Date()) {
        throw new BadRequestError('Expiration date must be in the future.');
      }
      // --- End Validation ---

      promoCodeRepo.merge(promoCode, promoCodeData);
      const updatedPromoCode = await promoCodeRepo.save(promoCode);

      if (promoCodeData.applicablePlans) {
        await transactionalEntityManager.getRepository(PromoCodeApplicablePlan).delete({ promoCodeId: id });
        if (promoCodeData.applicablePlans.length > 0) {
          await this._addApplicablePlans(transactionalEntityManager, id, promoCodeData.applicablePlans.map(p => p.id));
        }
      }

      if (promoCodeData.applicableUsers) {
        await transactionalEntityManager.getRepository(PromoCodeApplicableUser).delete({ promoCodeId: id });
        if (promoCodeData.applicableUsers.length > 0) {
          await this._addApplicableUsers(transactionalEntityManager, id, promoCodeData.applicableUsers.map(u => u.id));
        }
      }

      await this.invalidatePromoCache(id);
      logger.info(`Updated promo code with ID ${id}, invalidated caches.`);

      return updatedPromoCode;
    });
  }

  async deletePromoCode(id: string): Promise<void> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      const promoCodeRepo = transactionalEntityManager.getRepository(PromoCode);
      const result = await promoCodeRepo.delete(id);

      if (result.affected === 0) {
        throw new NotFoundError('Promo code not found');
      }

      await this.invalidatePromoCache(id);
      logger.info(`Deleted promo code with ID ${id}, invalidated caches.`);
    });
  }

  async addApplicablePlans(promoCodeId: string, planIds: string[]): Promise<void> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      await this._addApplicablePlans(transactionalEntityManager, promoCodeId, planIds);
      await this.invalidateSinglePromoCache(promoCodeId);
    });
  }

  private async _addApplicablePlans(entityManager: EntityManager, promoCodeId: string, planIds: string[]): Promise<void> {
    const applicablePlanRepo = entityManager.getRepository(PromoCodeApplicablePlan);
    const applicablePlans = planIds.map(planId => applicablePlanRepo.create({ promoCodeId, planId }));
    await applicablePlanRepo.save(applicablePlans);
  }

  async addApplicableUsers(promoCodeId: string, userIds: string[]): Promise<void> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      await this._addApplicableUsers(transactionalEntityManager, promoCodeId, userIds);
      await this.invalidateSinglePromoCache(promoCodeId);
    });
  }

  private async _addApplicableUsers(entityManager: EntityManager, promoCodeId: string, userIds: string[]): Promise<void> {
    const applicableUserRepo = entityManager.getRepository(PromoCodeApplicableUser);
    const applicableUsers = userIds.map(userId => applicableUserRepo.create({ promoCodeId, userId }));
    await applicableUserRepo.save(applicableUsers);
  }

  async validatePromoCode(code: string, userId: string, planId: string): Promise<{
    isValid: boolean;
    promoCode?: PromoCode;
    discountAmount?: number;
    message: string;
  }> {
    const cacheKey = `promo_validation:${code}:${userId}:${planId}`;
    const cachedResult = await promoCache.get<any>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const promoCode = await AppDataSource.getRepository(PromoCode).findOne({ where: { code } });
    if (!promoCode) {
      return { isValid: false, message: 'Promo code not found' };
    }

    const validationResult = await this.validationService.validatePromoCode(promoCode.id, userId, planId);
    if (!validationResult.isValid) {
      return { isValid: false, message: validationResult.message };
    }

    const plan = await AppDataSource.getRepository(SubscriptionPlan).findOne({ where: { id: planId } });
    if (!plan) {
      return { isValid: false, message: 'Invalid subscription plan' };
    }

    const discountAmount = this.calculateDiscount(promoCode, plan.price);
    const result = {
      isValid: true,
      promoCode,
      discountAmount,
      message: 'Promo code applied successfully',
    };

    await promoCache.set(cacheKey, result, 60 * 2);
    return result;
  }

  async applyPromoCode(subscriptionId: string, userId: string, promoCodeId: string, discountAmount: number): Promise<SubscriptionPromoCode> {
    return AppDataSource.manager.transaction(async (transactionalEntityManager) => {
      const promoCodeRepo = transactionalEntityManager.getRepository(PromoCode);
      const promoCode = await promoCodeRepo.findOne({ where: { id: promoCodeId } });

      if (!promoCode) {
        throw new NotFoundError('Promo code not found');
      }

      const validationResult = await this.validationService.validatePromoCode(promoCodeId, userId, subscriptionId);
      if (!validationResult.isValid) {
        throw new BadRequestError(validationResult.message);
      }

      await promoCodeRepo.increment({ id: promoCodeId }, 'usageCount', 1);

      const subPromoCodeRepo = transactionalEntityManager.getRepository(SubscriptionPromoCode);
      const subscriptionPromoCode = subPromoCodeRepo.create({
        promoCode: { id: promoCodeId } as PromoCode,
        discountAmount,
        appliedDate: new Date(),
        isActive: true,
      });

      const savedPromoCode = await subPromoCodeRepo.save(subscriptionPromoCode);

      await this.invalidatePromoCache(promoCodeId);
      logger.info(`Applied promo code ${promoCodeId} to subscription ${subscriptionId}, invalidated caches.`);

      return savedPromoCode;
    });
  }

  private calculateDiscount(promoCode: PromoCode, planPrice: number): number {
    if (promoCode.discountType === DiscountType.PERCENTAGE) {
      let discount = (planPrice * promoCode.discountValue) / 100;
      if (promoCode.maxDiscountAmount) {
        discount = Math.min(discount, promoCode.maxDiscountAmount);
      }
      return discount;
    } else if (promoCode.discountType === DiscountType.FIXED) {
      return Math.min(promoCode.discountValue, planPrice);
    }
    throw new BadRequestError(`Invalid discount type for promo code ${promoCode.code}`);
  }
}

export const promoCodeService = new PromoCodeService();