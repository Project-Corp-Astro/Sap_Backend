import express from 'express';
import { AppSubscriptionController } from '../controllers/app/subscription.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();
const appSubscriptionController = new AppSubscriptionController();

// Apply authentication middleware to routes that require user authentication
router.use(authMiddleware);

// Subscription routes
router.get('/app/:appId/plans', appSubscriptionController.getAvailablePlans);
router.get('/app/:appId/user', appSubscriptionController.getUserSubscription);
router.post('/app/:appId/subscribe', appSubscriptionController.createSubscription);
router.post('/app/:appId/subscription/:subscriptionId/cancel', appSubscriptionController.cancelSubscription);
router.post('/app/:appId/promo-code/validate', appSubscriptionController.validatePromoCode);

export default router;