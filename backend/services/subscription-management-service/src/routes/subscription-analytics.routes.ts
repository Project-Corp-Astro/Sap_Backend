import { Router } from 'express';
import { SubscriptionAnalyticsController } from '../controllers/subscription-analytics.controller';
import authMiddleware from '../middlewares/auth.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware.authenticate);
router.use(authMiddleware.checkBlacklist);

// Get analytics for a specific date range
router.get('/', 
  authMiddleware.requirePermission('view_analytics'),
  SubscriptionAnalyticsController.getAnalytics
);

// Get analytics for the last 30 days
router.get('/current', 
  authMiddleware.requirePermission('view_analytics'),
  SubscriptionAnalyticsController.getCurrentAnalytics
);

export default router;
