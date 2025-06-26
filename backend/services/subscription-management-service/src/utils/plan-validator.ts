import { SubscriptionPlan, PlanFeature } from '../entities';
import { SubscriptionPlanError, SubscriptionPlanServiceError, SubscriptionPlanErrorDetails } from '../types/subscription-plan.errors';
import { Repository } from 'typeorm';
import { PlanStatus } from '../entities/SubscriptionPlan.entity';

export class PlanValidator {
  // Validate plan data
  static async validatePlanData(
    data: Partial<SubscriptionPlan>,
    appId: string,
    planRepository: Repository<SubscriptionPlan>
  ): Promise<void> {
    const errors: SubscriptionPlanErrorDetails[] = [];

    // Validate required fields
    if (!data.name?.trim()) {
      errors.push({
        field: 'name',
        value: data.name,
        constraint: 'Plan name is required and must be less than 100 characters'
      });
    } else if (data.name.length > 100) {
      errors.push({
        field: 'name',
        value: data.name,
        constraint: 'Plan name must be less than 100 characters'
      });
    }

    // Validate price
    if (!data.price || typeof data.price !== 'number' || data.price < 0) {
      errors.push({
        field: 'price',
        value: data.price,
        constraint: 'Price must be a positive number'
      });
    }

    // Validate billing cycle
    if (!data.billingCycle) {
      errors.push({
        field: 'billingCycle',
        value: data.billingCycle,
        constraint: 'Billing cycle is required'
      });
    }

    // Validate trial days
    if (data.trialDays !== undefined) {
      if (typeof data.trialDays !== 'number' || data.trialDays < 0 || data.trialDays > 30) {
        errors.push({
          field: 'trialDays',
          value: data.trialDays,
          constraint: 'Trial days must be a number between 0 and 30'
        });
      }
    }

    // Check for duplicate plan name
    if (!errors.length) {
      const existingPlan = await planRepository.findOne({
        where: { name: data.name, appId },
        select: ['id']
      });

      if (existingPlan && (!data.id || existingPlan.id !== data.id)) {
        errors.push({
          field: 'name',
          value: data.name,
          constraint: 'A plan with this name already exists for this app'
        });
      }
    }

    if (errors.length > 0) {
      throw new SubscriptionPlanServiceError(
        SubscriptionPlanError.VALIDATION_FAILED,
        'Validation failed for subscription plan',
        { errors }
      );
    }
  }

  // Validate feature data
  static async validateFeatureData(
    data: Partial<PlanFeature>,
    planId: string,
    featureRepository: Repository<PlanFeature>
  ): Promise<void> {
    const errors: SubscriptionPlanErrorDetails[] = [];

    // Validate required fields
    if (!data.name?.trim()) {
      errors.push({
        field: 'name',
        value: data.name,
        constraint: 'Feature name is required and must be less than 100 characters'
      });
    } else if (data.name.length > 100) {
      errors.push({
        field: 'name',
        value: data.name,
        constraint: 'Feature name must be less than 100 characters'
      });
    }

    if (!data.description?.trim()) {
      errors.push({
        field: 'description',
        value: data.description,
        constraint: 'Feature description is required'
      });
    }

    // Validate limit if provided
    if (data.limit !== undefined) {
      if (typeof data.limit !== 'number' || data.limit < 0) {
        errors.push({
          field: 'limit',
          value: data.limit,
          constraint: 'Feature limit must be a non-negative number'
        });
      }
    }

    // Check for duplicate feature
    if (!errors.length) {
      const existingFeature = await featureRepository.findOne({
        where: { name: data.name, planId },
        select: ['id']
      });

      if (existingFeature && (!data.id || existingFeature.id !== data.id)) {
        errors.push({
          field: 'name',
          value: data.name,
          constraint: 'A feature with this name already exists for this plan'
        });
      }
    }

    if (errors.length > 0) {
      throw new SubscriptionPlanServiceError(
        SubscriptionPlanError.VALIDATION_FAILED,
        'Validation failed for plan feature',
        { errors }
      );
    }
  }

  // Validate status transition
  static validateStatusTransition(
    currentStatus: PlanStatus,
    newStatus: PlanStatus
  ): void {
    const validTransitions: Record<PlanStatus, PlanStatus[]> = {
      [PlanStatus.ACTIVE]: [PlanStatus.ARCHIVED, PlanStatus.DRAFT],
      [PlanStatus.ARCHIVED]: [],
      [PlanStatus.DRAFT]: [PlanStatus.ACTIVE]
    } as const;

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new SubscriptionPlanServiceError(
        SubscriptionPlanError.INVALID_STATUS,
        `Cannot transition from ${currentStatus} to ${newStatus}`,
        { currentStatus, newStatus }
      );
    }
  }
}
