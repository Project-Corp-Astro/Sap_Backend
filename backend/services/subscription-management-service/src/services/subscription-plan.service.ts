import { FindOptionsWhere, In, Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { PlanStatus } from '../entities/SubscriptionPlan.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import { PlanFeature } from '../entities/PlanFeature.entity';
import logger from '../utils/logger';

export class SubscriptionPlanService {
  private planRepository!: Repository<SubscriptionPlan>;
  private featureRepository!: Repository<PlanFeature>;
  
  constructor() {
    // Initialize repositories immediately
    this.initializeRepositories();
  }
  
  private initializeRepositories() {
    try {
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
      this.featureRepository = AppDataSource.getRepository(PlanFeature);
    } catch (error) {
      logger.error('Failed to initialize repositories in SubscriptionPlanService:', error);
    }
  }
  
  private getPlanRepository(): Repository<SubscriptionPlan> {
    if (!this.planRepository) {
      this.planRepository = AppDataSource.getRepository(SubscriptionPlan);
    }
    return this.planRepository;
  }
  
  private getFeatureRepository(): Repository<PlanFeature> {
    if (!this.featureRepository) {
      this.featureRepository = AppDataSource.getRepository(PlanFeature);
    }
    return this.featureRepository;
  }

  /**
   * Get all subscription plans
   * For admin access or filtered by appId for regular users
   */
  async getAllPlans(appId?: string, includeInactive = false) {
    try {
      const query: any = {};
      
      let where: any = {};
      
      if (appId) {
        where.appId = appId;
      }
      
      if (!includeInactive) {
        where.status = PlanStatus.ACTIVE;
      }
      
      return await this.getPlanRepository().find({
        where,
        relations: ['features'],
        order: { sortPosition: 'ASC' }
      });
    } catch (error) {
      logger.error('Error getting subscription plans:', error);
      throw error;
    }
  }

  /**
   * Get a specific plan by ID
   */
  async getPlanById(id: string) {
    try {
      return await this.getPlanRepository().findOne({
        where: { id },
        relations: ['features']
      });
    } catch (error) {
      logger.error(`Error getting subscription plan ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new subscription plan - Admin access
   */
  async createPlan(planData: Partial<SubscriptionPlan>) {
    try {
      const plan = this.getPlanRepository().create({
        ...planData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return await this.getPlanRepository().save(plan);
    } catch (error) {
      logger.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  /**
   * Update an existing subscription plan - Admin access
   */
  async updatePlan(id: string, planData: Partial<SubscriptionPlan>) {
    try {
      // Exclude certain fields from direct updates
      const { createdAt, ...updateData } = planData as any;
      
      // Add updated timestamp
      updateData.updatedAt = new Date();
      
      await this.getPlanRepository().update({ id }, updateData);
      return await this.getPlanById(id);
    } catch (error) {
      logger.error(`Error updating subscription plan ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a subscription plan - Admin access
   * Typically plans are just marked as inactive rather than deleted
   */
  async deletePlan(id: string) {
    try {
      // Instead of deleting, mark as inactive
      return await this.getPlanRepository().update({ id }, { 
        status: PlanStatus.ARCHIVED,
        updatedAt: new Date()
      });
    } catch (error) {
      logger.error(`Error deleting subscription plan ${id}:`, error);
      throw error;
    }
  }

  /**
   * Hard delete a plan - Super Admin only
   */
  async hardDeletePlan(id: string) {
    try {
      return await this.getPlanRepository().delete({ id });
    } catch (error) {
      logger.error(`Error hard deleting subscription plan ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add a feature to a subscription plan - Admin access
   */
  async addFeature(planId: string, featureData: Partial<PlanFeature>) {
    try {
      // Check if plan exists
      const plan = await this.getPlanRepository().findOne({ where: { id: planId } });
      if (!plan) {
        throw new Error('Subscription plan not found');
      }
      
      const feature = this.getFeatureRepository().create({
        ...featureData,
        planId,
        createdAt: new Date()
      });
      
      return await this.getFeatureRepository().save(feature);
    } catch (error) {
      logger.error(`Error adding feature to plan ${planId}:`, error);
      throw error;
    }
  }

  /**
   * Update a plan feature - Admin access
   */
  async updateFeature(featureId: string, featureData: Partial<PlanFeature>) {
    try {
      await this.getFeatureRepository().update({ id: featureId }, featureData);
      return await this.getFeatureRepository().findOne({ where: { id: featureId } });
    } catch (error) {
      logger.error(`Error updating feature ${featureId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a plan feature - Admin access
   */
  async deleteFeature(featureId: string) {
    try {
      return await this.getFeatureRepository().delete({ id: featureId });
    } catch (error) {
      logger.error(`Error deleting feature ${featureId}:`, error);
      throw error;
    }
  }
}

export default new SubscriptionPlanService();
