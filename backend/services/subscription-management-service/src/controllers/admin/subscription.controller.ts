import { Request, Response } from 'express';
import subscriptionService from '../../services/subscription.service';
import { asyncHandler } from '../../utils/asyncHandler';

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
   */
  getAllSubscriptions = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query;
    const subscriptions = await subscriptionService.getAllSubscriptions(filters as any);
    return res.json(subscriptions);
  });

  /**
   * Get subscriptions for a specific app
   */
  getSubscriptionsByApp = asyncHandler(async (req: Request, res: Response) => {
    const { appId } = req.params;
    const subscriptions = await subscriptionService.getSubscriptionsByApp(appId);
    return res.json(subscriptions);
  });

  /**
   * Get subscriptions for a specific user
   */
  getUserSubscriptions = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { appId } = req.query;
    const subscriptions = await subscriptionService.getUserSubscriptions(
      userId,
      appId as string
    );
    return res.json(subscriptions);
  });

  /**
   * Create a new subscription
   */
  createSubscription = asyncHandler(async (req: Request, res: Response) => {
    const { planId, userId, appId, promoCodeId } = req.body;
    if (!planId || !userId || !appId) {
      return res.status(400).json({ message: 'planId, userId, and appId are required' });
    }
    const subscription = await subscriptionService.createSubscription(
      planId,
      userId,
      appId,
      promoCodeId
    );
    return res.status(201).json(subscription);
  });

  /**
   * Get a specific subscription by ID
   */
  getSubscriptionById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const subscription = await subscriptionService.getSubscriptionById(id);

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    return res.json(subscription);
  });

  /**
   * Update subscription status (admin function)
   */
  updateSubscriptionStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const allowedStatuses = ['active', 'canceled', 'expired', 'suspended', 'past_due'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const subscription = await subscriptionService.updateSubscriptionStatus(id, status);

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    return res.json(subscription);
  });

  /**
   * Force renewal of a subscription (admin function)
   */
  renewSubscription = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const subscription = await subscriptionService.renewSubscription(id);

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    return res.json(subscription);
  });
}

export default new AdminSubscriptionController();