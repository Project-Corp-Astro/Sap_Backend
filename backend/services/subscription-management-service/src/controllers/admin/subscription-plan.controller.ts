import { Request, Response } from 'express';
import { formatErrorResponse } from '../../utils/error-handler';
import subscriptionPlanService from '../../services/subscription-plan.service';
import logger from '../../utils/logger';

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
   *
   * @swagger
   * /api/subscription/admin/plans:
   *   get:
   *     summary: Get all subscription plans
   *     description: Retrieves a list of all subscription plans with optional filtering
   *     tags: [AdminSubscriptionPlans]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: appId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter by application ID
   *       - in: query
   *         name: includeInactive
   *         schema:
   *           type: boolean
   *         description: Whether to include inactive plans
   *     responses:
   *       200:
   *         description: List of subscription plans
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/SubscriptionPlan'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getAllPlans(req: Request, res: Response) {
    try {
      const { appId } = req.query;
      const includeInactive = req.query.includeInactive === 'true';
      const plans = await subscriptionPlanService.getAllPlans(appId as string, includeInactive);
      return res.json(plans);
    } catch (error) {
      logger.error('Error in getAllPlans:', error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch subscription plans'));
    }
  }

  /**
   * Get a specific plan by ID
   *
   * @swagger
   * /api/subscription/admin/plans/{id}:
   *   get:
   *     summary: Get a specific subscription plan
   *     description: Retrieves details of a specific subscription plan by ID
   *     tags: [AdminSubscriptionPlans]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Subscription plan ID
   *     responses:
   *       200:
   *         description: Subscription plan details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SubscriptionPlan'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         description: Subscription plan not found
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getPlanById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const plan = await subscriptionPlanService.getPlanById(id);
      
      if (!plan) {
        return res.status(404).json({ message: 'Subscription plan not found' });
      }
      
      return res.json(plan);
    } catch (error) {
      logger.error(`Error in getPlanById for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch subscription plan'));
    }
  }

  /**
   * Create a new subscription plan
   *
   * @swagger
   * /api/subscription/admin/plans:
   *   post:
   *     summary: Create a new subscription plan
   *     description: Creates a new subscription plan with specified details
   *     tags: [AdminSubscriptionPlans]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - description
   *               - price
   *               - billingCycle
   *               - appId
   *             properties:
   *               name:
   *                 type: string
   *                 description: Name of the subscription plan
   *                 example: Premium Plan
   *               description:
   *                 type: string
   *                 description: Description of the plan features
   *                 example: Access to all premium features
   *               price:
   *                 type: number
   *                 format: float
   *                 description: Regular price of the plan
   *                 example: 19.99
   *               annualPrice:
   *                 type: number
   *                 format: float
   *                 description: Annual price (optional)
   *                 example: 199.99
   *               billingCycle:
   *                 $ref: '#/components/schemas/BillingCycle'
   *               trialDays:
   *                 type: integer
   *                 description: Number of trial days (optional)
   *                 example: 14
   *               status:
   *                 $ref: '#/components/schemas/PlanStatus'
   *               appId:
   *                 type: string
   *                 format: uuid
   *                 description: ID of the app this plan belongs to
   *               features:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     name:
   *                       type: string
   *                     description:
   *                       type: string
   *     responses:
   *       201:
   *         description: Subscription plan created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SubscriptionPlan'
   *       400:
   *         description: Invalid request data
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async createPlan(req: Request, res: Response) {
    try {
      const planData = req.body;
      
      // Validate required fields
      const requiredFields = ['name', 'price', 'duration', 'billingCycle', 'appId'];
      const missingFields = requiredFields.filter(field => !planData[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          message: `Missing required fields: ${missingFields.join(', ')}` 
        });
      }
      
      const plan = await subscriptionPlanService.createPlan(planData);
      return res.status(201).json(plan);
    } catch (error) {
      logger.error('Error in createPlan:', error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to create subscription plan'));
    }
  }

  /**
   * Update an existing subscription plan
   */
  async updatePlan(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const planData = req.body;
      
      const plan = await subscriptionPlanService.updatePlan(id, planData);
      
      if (!plan) {
        return res.status(404).json({ message: 'Subscription plan not found' });
      }
      
      return res.json(plan);
    } catch (error) {
      logger.error(`Error in updatePlan for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to update subscription plan'));
    }
  }

  /**
   * Delete a subscription plan (mark as inactive)
   */
  async deletePlan(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await subscriptionPlanService.deletePlan(id);
      return res.status(200).json({ message: 'Subscription plan marked as inactive' });
    } catch (error) {
      logger.error(`Error in deletePlan for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to delete subscription plan'));
    }
  }

  /**
   * Hard delete a subscription plan (super admin only)
   */
  async hardDeletePlan(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await subscriptionPlanService.hardDeletePlan(id);
      return res.status(200).json({ message: 'Subscription plan permanently deleted' });
    } catch (error) {
      logger.error(`Error in hardDeletePlan for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to permanently delete subscription plan'));
    }
  }

  /**
   * Add a feature to a subscription plan
   */
  async addFeature(req: Request, res: Response) {
    try {
      const { planId } = req.params;
      const featureData = req.body;
      
      // Validate required fields
      const requiredFields = ['name', 'description'];
      const missingFields = requiredFields.filter(field => !featureData[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          message: `Missing required fields: ${missingFields.join(', ')}` 
        });
      }
      
      const feature = await subscriptionPlanService.addFeature(planId, featureData);
      return res.status(201).json(feature);
    } catch (error) {
      logger.error(`Error in addFeature for planId ${req.params.planId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to add feature to subscription plan'));
    }
  }

  /**
   * Update a plan feature
   */
  async updateFeature(req: Request, res: Response) {
    try {
      const { featureId } = req.params;
      const featureData = req.body;
      
      const feature = await subscriptionPlanService.updateFeature(featureId, featureData);
      
      if (!feature) {
        return res.status(404).json({ message: 'Feature not found' });
      }
      
      return res.json(feature);
    } catch (error) {
      logger.error(`Error in updateFeature for featureId ${req.params.featureId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to update plan feature'));
    }
  }

  /**
   * Delete a plan feature
   */
  async deleteFeature(req: Request, res: Response) {
    try {
      const { featureId } = req.params;
      await subscriptionPlanService.deleteFeature(featureId);
      return res.status(200).json({ message: 'Feature deleted successfully' });
    } catch (error) {
      logger.error(`Error in deleteFeature for featureId ${req.params.featureId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to delete plan feature'));
    }
  }
}

export default new AdminSubscriptionPlanController();
