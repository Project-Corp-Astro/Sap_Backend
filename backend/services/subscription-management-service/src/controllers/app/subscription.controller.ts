import { Request, Response } from 'express';
import { formatErrorResponse } from '../../utils/error-handler';
import subscriptionService from '../../services/subscription.service';
import subscriptionPlanService from '../../services/subscription-plan.service';
import promoCodeService from '../../services/promo-code.service';
import logger from '../../utils/logger';

/**
 * App-specific controller for subscription management
 * Designed for end users accessing their own subscriptions
 *
 * @swagger
 * tags:
 *   name: UserSubscriptions
 *   description: Manage user subscriptions
 */
export class AppSubscriptionController {
  /**
   * Get available subscription plans for an app
   *
   * @swagger
   * /api/subscription/app/{appId}/plans:
   *   get:
   *     summary: Get available subscription plans for an app
   *     tags: [UserSubscriptions]
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
   *         description: List of available subscription plans
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/SubscriptionPlan'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getAvailablePlans(req: Request, res: Response) {
    try {
      const { appId } = req.params;
      
      // Only return active plans for app users
      const plans = await subscriptionPlanService.getAllPlans(appId);
      return res.json(plans);
    } catch (error) {
      logger.error(`Error in getAvailablePlans for appId ${req.params.appId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch subscription plans'));
    }
  }

  /**
   * Get user's subscription for a specific app
   *
   * @swagger
   * /api/subscription/app/{appId}/user:
   *   get:
   *     summary: Get user's subscriptions for a specific app
   *     tags: [UserSubscriptions]
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
   *         description: List of user subscriptions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Subscription'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getUserSubscription(req: Request, res: Response) {
    try {
      const { appId } = req.params;
      
      // Enhanced debug logging
      logger.debug('getUserSubscription called with params:', { 
        appId, 
        user: req.user,
        headers: req.headers
      });
      
      const userId = req.user?._id; // Access _id as per existing auth middleware structure

      if (!userId) {
        logger.warn('Authentication issue: No user ID found in request', { user: req.user });
        return res.status(401).json({ message: 'User authentication required' });
      }

      logger.debug('Fetching subscriptions for user', { userId, appId });
      const subscriptions = await subscriptionService.getUserSubscriptions(userId, appId);
      
      logger.debug('Subscriptions retrieved successfully', { count: subscriptions.length });
      
      // Most cases will only have one active subscription per user per app
      // But we return all of them to handle edge cases
      return res.json(subscriptions);
    } catch (error) {
      // More detailed error logging
      logger.error(`Error in getUserSubscription for appId ${req.params.appId}:`, {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        user: req.user ? { id: req.user._id } : 'No user'
      });
      
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch subscription'));
    }
  }

  /**
   * Create a new subscription
   *
   * @swagger
   * /api/subscription/app/{appId}/subscribe:
   *   post:
   *     summary: Create a new subscription
   *     tags: [UserSubscriptions]
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
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - planId
   *             properties:
   *               planId:
   *                 type: string
   *                 format: uuid
   *                 description: ID of the subscription plan
   *               paymentMethodId:
   *                 type: string
   *                 description: ID of the payment method to use
   *               promoCode:
   *                 type: string
   *                 description: Optional promo code to apply
   *     responses:
   *       201:
   *         description: Subscription successfully created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Subscription'
   *       400:
   *         description: Invalid request parameters
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         description: Subscription plan not found
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async createSubscription(req: Request, res: Response) {
    try {
      const { appId } = req.params;
      const { planId, paymentMethodId, promoCode } = req.body;
      const userId = req.user?._id; // Access _id as per existing auth middleware structure

      if (!userId) {
        return res.status(401).json({ message: 'User authentication required' });
      }

      if (!planId) {
        return res.status(400).json({ message: 'Plan ID is required' });
      }

      // Check if plan exists and belongs to the specified app
      const plan = await subscriptionPlanService.getPlanById(planId);
      if (!plan) {
        return res.status(404).json({ message: 'Subscription plan not found' });
      }

      if (plan.appId !== appId) {
        return res.status(400).json({ message: 'Plan does not belong to this app' });
      }

      // Create subscription data object
      const subscriptionData: any = {
        userId,
        appId,
        planId,
        status: 'pending' // Will be updated after payment or trial setup
      };

      // Handle promo code if provided
      if (promoCode && promoCode.trim() !== '') {
        const validation = await promoCodeService.validatePromoCode(
          promoCode,
          userId,
          planId
        );

        if (!validation.isValid) {
          return res.status(400).json({ 
            message: validation.message || 'Invalid promo code' 
          });
        }

        // Save promo code information for later use
        if (validation.promoCode) {
          subscriptionData.promoCodeDetails = {
            promoCodeId: validation.promoCode.id,
            discountAmount: validation.discountAmount
          };
        }
      }

      // Create subscription
      const subscription = await subscriptionService.createSubscription(
        planId,
        userId,
        appId,
        subscriptionData.promoCodeDetails?.promoCodeId
      );

      // Apply promo code if valid
      if (subscriptionData.promoCodeDetails) {
        await promoCodeService.applyPromoCode(
          subscription.id,
          userId,
          subscriptionData.promoCodeDetails.promoCodeId,
          subscriptionData.promoCodeDetails.discountAmount
        );
      }

      return res.status(201).json(subscription);
    } catch (error) {
      logger.error(`Error in createSubscription for appId ${req.params.appId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to create subscription'));
    }
  }

  /**
   * Cancel a user's subscription
   */
  async cancelSubscription(req: Request, res: Response) {
    try {
      const { subscriptionId } = req.params;
      const { cancelImmediately = false } = req.body;
      const userId = req.user?._id; // Access _id as per existing auth middleware structure

      if (!userId) {
        return res.status(401).json({ message: 'User authentication required' });
      }

      // Cancel subscription (user can only cancel their own subscriptions)
      const subscription = await subscriptionService.cancelSubscription(
        subscriptionId,
        userId,
        cancelImmediately
      );

      return res.json({
        message: cancelImmediately 
          ? 'Subscription canceled immediately'
          : 'Subscription will be canceled at the end of the billing period',
        subscription
      });
    } catch (error) {
      logger.error(`Error in cancelSubscription for id ${req.params.subscriptionId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to cancel subscription'));
    }
  }

  /**
   * Validate a promo code for a specific plan
   */
  async validatePromoCode(req: Request, res: Response) {
    try {
      const { appId } = req.params;
      const { code, planId } = req.body;
      const userId = req.user?._id; // Access _id as per existing auth middleware structure

      if (!userId) {
        return res.status(401).json({ message: 'User authentication required' });
      }

      if (!code || !planId) {
        return res.status(400).json({ message: 'Code and planId are required' });
      }

      // Check if plan exists and belongs to the app
      const plan = await subscriptionPlanService.getPlanById(planId);
      if (!plan) {
        return res.status(404).json({ message: 'Subscription plan not found' });
      }

      if (plan.appId !== appId) {
        return res.status(400).json({ message: 'Plan does not belong to this app' });
      }

      // Validate the promo code
      const validation = await promoCodeService.validatePromoCode(code, userId, planId);

      if (!validation.isValid) {
        return res.status(400).json({ 
          message: validation.message || 'Invalid promo code',
          isValid: false
        });
      }

      // Return discount information
      return res.status(200).json({
        isValid: validation.isValid,
        message: validation.message,
        discountAmount: validation.discountAmount,
        discountType: validation.promoCode ? validation.promoCode.discountType : null
      });
    } catch (error) {
      logger.error(`Error in validatePromoCode for appId ${req.params.appId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to validate promo code'));
    }
  }
}

export default new AppSubscriptionController();
