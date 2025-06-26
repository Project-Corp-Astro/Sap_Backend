import express from 'express';
import appSubscriptionController from '../controllers/app/subscription.controller';
import authMiddleware from '../middlewares/auth.middleware';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// App-specific subscription routes
router.get('/apps/:appId/plans', appSubscriptionController.getAvailablePlans);
router.get('/apps/:appId/subscriptions', appSubscriptionController.getUserSubscription);
router.post('/apps/:appId/subscriptions', appSubscriptionController.createSubscription);
router.post('/apps/:appId/validate-promo-code', appSubscriptionController.validatePromoCode);
router.post('/subscriptions/:subscriptionId/cancel', appSubscriptionController.cancelSubscription);

// App dropdown route


export default router;
