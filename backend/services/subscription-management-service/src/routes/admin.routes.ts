import express from 'express';
import { AdminSubscriptionController } from '../controllers/admin/subscription.controller';
import adminSubscriptionPlanController from '../controllers/admin/subscription-plan.controller';
import { AdminPromoCodeController } from '../controllers/admin/promo-code.controller';
import promoCodeAnalyticsController from '../controllers/admin/promo-code-analytics.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../../../../src/middleware/requirePermission';

const router = express.Router();
const adminSubscriptionController = new AdminSubscriptionController();
const adminPromoCodeController = new AdminPromoCodeController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Subscription routes
router.get('/subscriptions',
    requirePermission('subscription:read', { application: 'billing', }),
    adminSubscriptionController.getAllSubscriptions);

router.get('/subscriptions/app/:appId',
    requirePermission('subscription:read', { application: 'billing', }),
    adminSubscriptionController.getSubscriptionsByApp);

router.get('/subscriptions/user/:userId',
    requirePermission('subscription:read', { application: 'billing', }),
    adminSubscriptionController.getUserSubscriptions);

router.post('/subscriptions',
    requirePermission('subscription:create', { application: 'billing', }),
    adminSubscriptionController.createSubscription);

router.get('/subscriptions/:id',
    requirePermission('subscription:read', { application: 'billing', }),    
    adminSubscriptionController.getSubscriptionById);

router.patch('/subscriptions/:id/status',
    requirePermission('subscription:update', { application: 'billing', }),
    adminSubscriptionController.updateSubscriptionStatus);

router.post('/subscriptions/:id/renew',
    requirePermission('subscription:update', { application: 'billing', }),
    adminSubscriptionController.renewSubscription);

// Subscription plan routes
router.get('/plans',
    requirePermission('subscription:read', { application: 'billing', }),
    adminSubscriptionPlanController.getAllPlans);

router.get('/plans/:id',
    requirePermission('subscription:read', { application: 'billing', }),
    adminSubscriptionPlanController.getPlanById);

router.post('/plans',
    requirePermission('subscription:create', { application: 'billing', }),
    adminSubscriptionPlanController.createPlan);

router.put('/plans/:id',
    requirePermission('subscription:update', { application: 'billing', }),
    adminSubscriptionPlanController.updatePlan);

router.delete('/plans/:id',
    requirePermission('subscription:cancel', { application: 'billing', }),
    adminSubscriptionPlanController.deletePlan);

router.delete('/plans/:id/permanent',
    requirePermission('subscription:cancel', { application: 'billing', }),
    adminSubscriptionPlanController.hardDeletePlan);

// Plan feature routes
router.post('/plans/:planId/features',
    requirePermission('subscription:create', { application: 'billing', }),
    adminSubscriptionPlanController.addFeature);

router.put('/features/:featureId',
    requirePermission('subscription:update', { application: 'billing', }),
    adminSubscriptionPlanController.updateFeature);

router.delete('/features/:featureId',
    requirePermission('subscription:cancel', { application: 'billing', }),
    adminSubscriptionPlanController.deleteFeature);

// Promo code analytics routes
router.get('/promo-codes/analytics',
    requirePermission('analytics:view', { application: 'billing', }),
    promoCodeAnalyticsController.getAnalytics);

// Promo code routes
router.get('/promo-codes',
    requirePermission('subscription:read', { application: 'billing', }),
    adminPromoCodeController.getAllPromoCodes);

router.get('/promo-codes/:id',
    requirePermission('subscription:read', { application: 'billing', }),
    adminPromoCodeController.getPromoCodeById);
router.post('/promo-codes',
    requirePermission('subscription:create', { application: 'billing', }),
    adminPromoCodeController.createPromoCode);
router.put('/promo-codes/:id',
    requirePermission('subscription:update', { application: 'billing', }),
    adminPromoCodeController.updatePromoCode);
router.delete('/promo-codes/:id', 
    requirePermission('subscription:cancel', { application: 'billing', }),
    adminPromoCodeController.deletePromoCode);

router.get('/apps/dropdown',
    requirePermission('subscription:read', { application: 'billing', }),
    adminSubscriptionPlanController.getAppsForDropdown);

export default router;