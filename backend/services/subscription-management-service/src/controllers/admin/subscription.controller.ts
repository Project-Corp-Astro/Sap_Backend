import { Request, Response } from 'express';
import { formatErrorResponse } from '../../utils/error-handler';
import subscriptionService from '../../services/subscription.service';
import logger from '../../utils/logger';

/**
 * Admin controller for subscription management
 * Provides all admin functionality for managing subscriptions across all apps and users
 *
 * @swagger
 * tags:
 *   name: AdminSubscriptions
 *   description: Administrative management of user subscriptions across all apps
 */
export class AdminSubscriptionController {
  /**
   * Get all subscriptions with optional filters
   *
   * @swagger
   * /api/subscription/admin/subscriptions:
   *   get:
   *     summary: Get all subscriptions
   *     description: Retrieves a list of all subscriptions with optional filtering
   *     tags: [AdminSubscriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, expired, cancelled, trial, past_due]
   *         description: Filter by subscription status
   *       - in: query
   *         name: planId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter by subscription plan ID
   *     responses:
   *       200:
   *         description: List of subscriptions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Subscription'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getAllSubscriptions(req: Request, res: Response) {
    try {
      const filters = req.query;
      const subscriptions = await subscriptionService.getAllSubscriptions(filters as any);
      return res.json(subscriptions);
    } catch (error) {
      logger.error('Error in getAllSubscriptions:', error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch subscriptions'));
    }
  }

  /**
   * Get subscriptions for a specific app
   *
   * @swagger
   * /api/subscription/admin/subscriptions/app/{appId}:
   *   get:
   *     summary: Get subscriptions by app
   *     description: Retrieves all subscriptions for a specific application
   *     tags: [AdminSubscriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: appId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Application ID
   *     responses:
   *       200:
   *         description: List of subscriptions for the specified app
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Subscription'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getSubscriptionsByApp(req: Request, res: Response) {
    try {
      const { appId } = req.params;
      const subscriptions = await subscriptionService.getSubscriptionsByApp(appId);
      return res.json(subscriptions);
    } catch (error) {
      logger.error(`Error in getSubscriptionsByApp for app ${req.params.appId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch subscriptions for this app'));
    }
  }

  /**
   * Get subscriptions for a specific user
   *
   * @swagger
   * /api/subscription/admin/subscriptions/user/{userId}:
   *   get:
   *     summary: Get user subscriptions
   *     description: Retrieves all subscriptions for a specific user
   *     tags: [AdminSubscriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: User ID
   *       - in: query
   *         name: appId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Optional app ID filter
   *     responses:
   *       200:
   *         description: List of user subscriptions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Subscription'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getUserSubscriptions(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { appId } = req.query;
      const subscriptions = await subscriptionService.getUserSubscriptions(
        userId, 
        appId as string
      );
      return res.json(subscriptions);
    } catch (error) {
      logger.error(`Error in getUserSubscriptions for user ${req.params.userId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch user subscriptions'));
    }
  }

  /**
   * Get a specific subscription by ID
   */
  async createSubscription(req: Request, res: Response) {
    try {
      const { planId, userId, appId, promoCodeId } = req.body;
      if (!planId || !userId || !appId) {
        return res.status(400).json({ message: 'planId, userId, and appId are required' });
      }
      const subscription = await subscriptionService.createSubscription(planId, userId, appId, promoCodeId);
      return res.status(201).json(subscription);
    } catch (error) {
      logger.error('Error in createSubscription:', error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to create subscription'));
    }
  }

  /**
   * Get a specific subscription by ID
   */
  async getSubscriptionById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const subscription = await subscriptionService.getSubscriptionById(id);
      
      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }
      
      return res.json(subscription);
    } catch (error) {
      logger.error(`Error in getSubscriptionById for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch subscription details'));
    }
  }

  /**
   * Update subscription status (admin function)
   */
  async updateSubscriptionStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }
      
      const allowedStatuses = ['active', 'canceled', 'expired', 'suspended', 'past_due'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ 
          message: `Status must be one of: ${allowedStatuses.join(', ')}`
        });
      }
      
      const subscription = await subscriptionService.updateSubscriptionStatus(id, status);
      
      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }
      
      return res.json(subscription);
    } catch (error) {
      logger.error(`Error in updateSubscriptionStatus for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to update subscription status'));
    }
  }

  /**
   * Force renewal of a subscription (admin function)
   */
  async renewSubscription(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const subscription = await subscriptionService.renewSubscription(id);
      
      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }
      
      return res.json(subscription);
    } catch (error) {
      logger.error(`Error in renewSubscription for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to renew subscription'));
    }
  }
}

export default new AdminSubscriptionController();
