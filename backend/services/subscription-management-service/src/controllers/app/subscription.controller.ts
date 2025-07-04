import { Request, Response, NextFunction } from 'express';
import { formatErrorResponse } from '../../utils/error-handler';
import subscriptionService from '../../services/subscription.service';
import subscriptionPlanService from '../../services/subscription-plan.service';
import { promoCodeService } from '../../services/promo-code.service';
import logger from '../../utils/logger';
import { PlanStatus } from '../../entities/SubscriptionPlan.entity';
import { asyncHandler } from '../../utils/asyncHandler';

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
   */
  getAvailablePlans = asyncHandler(async (req: Request, res: Response) => {
    const { appId } = req.params;

    // Only return active plans for app users
    const plans = await subscriptionPlanService.getAllPlans({
      appId,
      status: PlanStatus.ACTIVE,
    });
    return res.json(plans);
  });

  /**
   * Get user's subscription for a specific app
   */
  getUserSubscription = asyncHandler(async (req: Request, res: Response) => {
    const { appId } = req.params;

    // Enhanced debug logging
    logger.debug('getUserSubscription called with params:', {
      appId,
      user: req.user,
      headers: req.headers,
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
  });

  /**
   * Create a new subscription
   */
  createSubscription = asyncHandler(async (req: Request, res: Response) => {
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
      status: 'pending', // Will be updated after payment or trial setup
    };

    const subscription = await subscriptionService.createSubscription(planId, userId, appId, promoCode);

    return res.status(201).json(subscription);
  });

  /**
   * Cancel a user's subscription
   */
  cancelSubscription = asyncHandler(async (req: Request, res: Response) => {
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
      subscription,
    });
  });

  /**
   * Validate a promo code for a specific plan
   */
  validatePromoCode = asyncHandler(async (req: Request, res: Response) => {
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
        isValid: false,
      });
    }

    // Return discount information
    return res.status(200).json({
      isValid: validation.isValid,
      message: validation.message,
      discountAmount: validation.discountAmount,
      discountType: validation.promoCode ? validation.promoCode.discountType : null,
    });
  });
}

export default new AppSubscriptionController();