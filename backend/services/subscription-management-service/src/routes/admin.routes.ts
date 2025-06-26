import express from 'express';
import adminSubscriptionController from '../controllers/admin/subscription.controller';
import adminSubscriptionPlanController from '../controllers/admin/subscription-plan.controller';
import { AdminPromoCodeController } from '../controllers/admin/promo-code.controller';
const adminPromoCodeController = new AdminPromoCodeController();
import promoCodeAnalyticsController from '../controllers/admin/promo-code-analytics.controller';
import authMiddleware from '../middlewares/auth.middleware';

const router = express.Router();

// Apply authentication and admin role check to all routes
router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireManagementRole); // This middleware checks for admin, super_admin, and business_admin roles

// Subscription routes
router.get('/subscriptions', adminSubscriptionController.getAllSubscriptions);
router.get('/subscriptions/app/:appId', adminSubscriptionController.getSubscriptionsByApp);
router.get('/subscriptions/user/:userId', adminSubscriptionController.getUserSubscriptions);
router.post('/subscriptions', adminSubscriptionController.createSubscription);
router.get('/subscriptions/:id', adminSubscriptionController.getSubscriptionById);
router.patch('/subscriptions/:id/status', adminSubscriptionController.updateSubscriptionStatus);
router.post('/subscriptions/:id/renew', adminSubscriptionController.renewSubscription);

// Subscription plan routes
router.get('/plans', adminSubscriptionPlanController.getAllPlans);
router.get('/plans/:id', adminSubscriptionPlanController.getPlanById);
router.post('/plans', adminSubscriptionPlanController.createPlan);
router.put('/plans/:id', adminSubscriptionPlanController.updatePlan);
router.delete('/plans/:id', adminSubscriptionPlanController.deletePlan);
router.delete('/plans/:id/permanent', adminSubscriptionPlanController.hardDeletePlan);

// Plan feature routes
router.post('/plans/:planId/features', adminSubscriptionPlanController.addFeature);
router.put('/features/:featureId', adminSubscriptionPlanController.updateFeature);
router.delete('/features/:featureId', adminSubscriptionPlanController.deleteFeature);

// Promo code analytics routes
router.get('/promo-codes/analytics', promoCodeAnalyticsController.getAnalytics);

// Promo code routes
router.get('/promo-codes', adminPromoCodeController.getAllPromoCodes);
router.get('/promo-codes/:id', adminPromoCodeController.getPromoCodeById);
router.post('/promo-codes', adminPromoCodeController.createPromoCode);
router.put('/promo-codes/:id', adminPromoCodeController.updatePromoCode);
router.delete('/promo-codes/:id', adminPromoCodeController.deletePromoCode);



router.get('/apps/dropdown', adminSubscriptionPlanController.getAppsForDropdown);
export default router;
