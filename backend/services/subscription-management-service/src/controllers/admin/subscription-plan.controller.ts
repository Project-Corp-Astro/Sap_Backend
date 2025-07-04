import { Request, Response, NextFunction } from 'express';
import { formatErrorResponse } from '../../utils/error-handler';
import subscriptionPlanService from '../../services/subscription-plan.service';
import logger from '../../utils/logger';
import { PlanStatus, BillingCycle } from '../../entities/SubscriptionPlan.entity';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Admin controller for subscription plan management
 *
 * @swagger
 * tags:
 *   name: AdminSubscriptionPlans
 *   description: Subscription plan management for administrators
 */
export class AdminSubscriptionPlanController {
  /**
   * Get all subscription plans
   */
  getAllPlans = asyncHandler(async (req: Request, res: Response) => {
    const {
      appId,
      page = '1',
      limit = '10',
      status,
      name,
      sortPosition,
      highlight,
      billingCycle,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({ message: 'Invalid page or limit parameters' });
    }

    const filterParams = {
      appId: appId as string | undefined,
      status: status as PlanStatus | undefined,
      name: name as string | undefined,
      description: undefined as string | undefined,
      price: undefined as number | undefined,
      billingCycle: billingCycle as BillingCycle | undefined,
      trialDays: undefined as number | undefined,
      sortPosition: sortPosition ? parseInt(sortPosition as string) : undefined,
      highlight: highlight as string | undefined,
      includeInactive: req.query.includeInactive === 'true',
    };

    const result = await subscriptionPlanService.getAllPlans(filterParams, pageNum, limitNum);

    const { plans, total } = result;

    return res.json({ plans, total });
  });

  /**
   * Get a specific plan by ID
   */
  getPlanById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Invalid plan ID' });
    }

    const plan = await subscriptionPlanService.getPlanById(id);

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    return res.json(plan);
  });

  /**
   * Create a new subscription plan
   */
  createPlan = asyncHandler(async (req: Request, res: Response) => {
    const planData = req.body;

    const requiredFields = ['name', 'price', 'billingCycle'];
    const missingFields = requiredFields.filter((field) => !planData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    const plan = await subscriptionPlanService.createPlan(planData);
    return res.status(201).json(plan);
  });

  /**
   * Update an existing subscription plan
   */
  updatePlan = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const planData = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Invalid plan ID' });
    }

    // Validate appId if provided
    if (planData.appId && typeof planData.appId !== 'string') {
      return res.status(400).json({ message: 'appId must be a string' });
    }

    // Remove application field if present
    if ('application' in planData) {
      delete planData.application;
    }

    const plan = await subscriptionPlanService.updatePlan(id, planData);

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    return res.json(plan);
  });

  /**
   * Delete a subscription plan (mark as inactive)
   */
  deletePlan = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Invalid plan ID' });
    }

    await subscriptionPlanService.deletePlan(id);
    return res.status(200).json({ message: 'Subscription plan marked as inactive' });
  });

  /**
   * Hard delete a subscription plan (super admin only)
   */
  hardDeletePlan = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Invalid plan ID' });
    }

    await subscriptionPlanService.hardDeletePlan(id);
    return res.status(200).json({ message: 'Subscription plan permanently deleted' });
  });

  /**
   * Add a feature to a subscription plan
   */
  addFeature = asyncHandler(async (req: Request, res: Response) => {
    const { planId } = req.params;
    const featureData = req.body;

    if (!planId || typeof planId !== 'string') {
      return res.status(400).json({ message: 'Invalid plan ID' });
    }

    const requiredFields = ['name', 'description'];
    const missingFields = requiredFields.filter((field) => !featureData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    const feature = await subscriptionPlanService.addFeature(planId, featureData);
    return res.status(201).json(feature);
  });

  /**
   * Update a plan feature
   */
  updateFeature = asyncHandler(async (req: Request, res: Response) => {
    const { featureId } = req.params;
    const featureData = req.body;

    if (!featureId || typeof featureId !== 'string') {
      return res.status(400).json({ message: 'Invalid feature ID' });
    }

    const feature = await subscriptionPlanService.updateFeature(featureId, featureData);

    if (!feature) {
      return res.status(404).json({ message: 'Feature not found' });
    }

    return res.json(feature);
  });

  /**
   * Get apps for dropdown
   */
  getAppsForDropdown = asyncHandler(async (req: Request, res: Response) => {
    const apps = await subscriptionPlanService.getAppsForDropdown();
    return res.status(200).json(apps);
  });

  /**
   * Delete a plan feature
   */
  deleteFeature = asyncHandler(async (req: Request, res: Response) => {
    const { featureId } = req.params;
    if (!featureId || typeof featureId !== 'string') {
      return res.status(400).json({ message: 'Invalid feature ID' });
    }

    await subscriptionPlanService.deleteFeature(featureId);
    return res.status(200).json({ message: 'Feature deleted successfully' });
  });
}

export default new AdminSubscriptionPlanController();