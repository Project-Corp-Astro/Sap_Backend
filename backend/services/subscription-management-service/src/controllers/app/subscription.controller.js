"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppSubscriptionController = void 0;
const error_handler_1 = require("../../utils/error-handler");
const subscription_service_1 = __importDefault(require("../../services/subscription.service"));
const subscription_plan_service_1 = __importDefault(require("../../services/subscription-plan.service"));
const promo_code_service_1 = require("../../services/promo-code.service");
const logger_1 = __importDefault(require("../../utils/logger"));
const SubscriptionPlan_entity_1 = require("../../entities/SubscriptionPlan.entity");
/**
 * App-specific controller for subscription management
 * Designed for end users accessing their own subscriptions
 *
 * @swagger
 * tags:
 *   name: UserSubscriptions
 *   description: Manage user subscriptions
 */
class AppSubscriptionController {
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
    getAvailablePlans(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { appId } = req.params;
                // Only return active plans for app users
                const plans = yield subscription_plan_service_1.default.getAllPlans({
                    appId,
                    status: SubscriptionPlan_entity_1.PlanStatus.ACTIVE
                });
                return res.json(plans);
            }
            catch (error) {
                logger_1.default.error(`Error in getAvailablePlans for appId ${req.params.appId}:`, error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to fetch subscription plans'));
            }
        });
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
    getUserSubscription(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { appId } = req.params;
                // Enhanced debug logging
                logger_1.default.debug('getUserSubscription called with params:', {
                    appId,
                    user: req.user,
                    headers: req.headers
                });
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id; // Access _id as per existing auth middleware structure
                if (!userId) {
                    logger_1.default.warn('Authentication issue: No user ID found in request', { user: req.user });
                    return res.status(401).json({ message: 'User authentication required' });
                }
                logger_1.default.debug('Fetching subscriptions for user', { userId, appId });
                const subscriptions = yield subscription_service_1.default.getUserSubscriptions(userId, appId);
                logger_1.default.debug('Subscriptions retrieved successfully', { count: subscriptions.length });
                // Most cases will only have one active subscription per user per app
                // But we return all of them to handle edge cases
                return res.json(subscriptions);
            }
            catch (error) {
                // More detailed error logging
                logger_1.default.error(`Error in getUserSubscription for appId ${req.params.appId}:`, {
                    error: error instanceof Error ? {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    } : error,
                    user: req.user ? { id: req.user._id } : 'No user'
                });
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to fetch subscription'));
            }
        });
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
    createSubscription(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { appId } = req.params;
                const { planId, paymentMethodId, promoCode } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id; // Access _id as per existing auth middleware structure
                if (!userId) {
                    return res.status(401).json({ message: 'User authentication required' });
                }
                if (!planId) {
                    return res.status(400).json({ message: 'Plan ID is required' });
                }
                // Check if plan exists and belongs to the specified app
                const plan = yield subscription_plan_service_1.default.getPlanById(planId);
                if (!plan) {
                    return res.status(404).json({ message: 'Subscription plan not found' });
                }
                if (plan.appId !== appId) {
                    return res.status(400).json({ message: 'Plan does not belong to this app' });
                }
                // Create subscription data object
                const subscriptionData = {
                    userId,
                    appId,
                    planId,
                    status: 'pending' // Will be updated after payment or trial setup
                };
                const subscription = yield subscription_service_1.default.createSubscription(planId, userId, appId, promoCode);
                return res.status(201).json(subscription);
            }
            catch (error) {
                logger_1.default.error(`Error in createSubscription for appId ${req.params.appId}:`, error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to create subscription'));
            }
        });
    }
    /**
     * Cancel a user's subscription
     */
    cancelSubscription(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { subscriptionId } = req.params;
                const { cancelImmediately = false } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id; // Access _id as per existing auth middleware structure
                if (!userId) {
                    return res.status(401).json({ message: 'User authentication required' });
                }
                // Cancel subscription (user can only cancel their own subscriptions)
                const subscription = yield subscription_service_1.default.cancelSubscription(subscriptionId, userId, cancelImmediately);
                return res.json({
                    message: cancelImmediately
                        ? 'Subscription canceled immediately'
                        : 'Subscription will be canceled at the end of the billing period',
                    subscription
                });
            }
            catch (error) {
                logger_1.default.error(`Error in cancelSubscription for id ${req.params.subscriptionId}:`, error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to cancel subscription'));
            }
        });
    }
    /**
     * Validate a promo code for a specific plan
     */
    validatePromoCode(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { appId } = req.params;
                const { code, planId } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id; // Access _id as per existing auth middleware structure
                if (!userId) {
                    return res.status(401).json({ message: 'User authentication required' });
                }
                if (!code || !planId) {
                    return res.status(400).json({ message: 'Code and planId are required' });
                }
                // Check if plan exists and belongs to the app
                const plan = yield subscription_plan_service_1.default.getPlanById(planId);
                if (!plan) {
                    return res.status(404).json({ message: 'Subscription plan not found' });
                }
                if (plan.appId !== appId) {
                    return res.status(400).json({ message: 'Plan does not belong to this app' });
                }
                // Validate the promo code
                const validation = yield promo_code_service_1.promoCodeService.validatePromoCode(code, userId, planId);
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
            }
            catch (error) {
                logger_1.default.error(`Error in validatePromoCode for appId ${req.params.appId}:`, error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to validate promo code'));
            }
        });
    }
}
exports.AppSubscriptionController = AppSubscriptionController;
exports.default = new AppSubscriptionController();
