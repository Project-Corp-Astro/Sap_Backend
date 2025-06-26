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
exports.AdminSubscriptionController = void 0;
const error_handler_1 = require("../../utils/error-handler");
const subscription_service_1 = __importDefault(require("../../services/subscription.service"));
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Admin controller for subscription management
 * Provides all admin functionality for managing subscriptions across all apps and users
 *
 * @swagger
 * tags:
 *   name: AdminSubscriptions
 *   description: Administrative management of user subscriptions across all apps
 */
class AdminSubscriptionController {
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
    getAllSubscriptions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filters = req.query;
                const subscriptions = yield subscription_service_1.default.getAllSubscriptions(filters);
                return res.json(subscriptions);
            }
            catch (error) {
                logger_1.default.error('Error in getAllSubscriptions:', error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to fetch subscriptions'));
            }
        });
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
    getSubscriptionsByApp(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { appId } = req.params;
                const subscriptions = yield subscription_service_1.default.getSubscriptionsByApp(appId);
                return res.json(subscriptions);
            }
            catch (error) {
                logger_1.default.error(`Error in getSubscriptionsByApp for app ${req.params.appId}:`, error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to fetch subscriptions for this app'));
            }
        });
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
    getUserSubscriptions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.params;
                const { appId } = req.query;
                const subscriptions = yield subscription_service_1.default.getUserSubscriptions(userId, appId);
                return res.json(subscriptions);
            }
            catch (error) {
                logger_1.default.error(`Error in getUserSubscriptions for user ${req.params.userId}:`, error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to fetch user subscriptions'));
            }
        });
    }
    /**
     * Get a specific subscription by ID
     */
    createSubscription(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { planId, userId, appId, promoCodeId } = req.body;
                if (!planId || !userId || !appId) {
                    return res.status(400).json({ message: 'planId, userId, and appId are required' });
                }
                const subscription = yield subscription_service_1.default.createSubscription(planId, userId, appId, promoCodeId);
                return res.status(201).json(subscription);
            }
            catch (error) {
                logger_1.default.error('Error in createSubscription:', error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to create subscription'));
            }
        });
    }
    /**
     * Get a specific subscription by ID
     */
    getSubscriptionById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const subscription = yield subscription_service_1.default.getSubscriptionById(id);
                if (!subscription) {
                    return res.status(404).json({ message: 'Subscription not found' });
                }
                return res.json(subscription);
            }
            catch (error) {
                logger_1.default.error(`Error in getSubscriptionById for id ${req.params.id}:`, error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to fetch subscription details'));
            }
        });
    }
    /**
     * Update subscription status (admin function)
     */
    updateSubscriptionStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const subscription = yield subscription_service_1.default.updateSubscriptionStatus(id, status);
                if (!subscription) {
                    return res.status(404).json({ message: 'Subscription not found' });
                }
                return res.json(subscription);
            }
            catch (error) {
                logger_1.default.error(`Error in updateSubscriptionStatus for id ${req.params.id}:`, error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to update subscription status'));
            }
        });
    }
    /**
     * Force renewal of a subscription (admin function)
     */
    renewSubscription(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const subscription = yield subscription_service_1.default.renewSubscription(id);
                if (!subscription) {
                    return res.status(404).json({ message: 'Subscription not found' });
                }
                return res.json(subscription);
            }
            catch (error) {
                logger_1.default.error(`Error in renewSubscription for id ${req.params.id}:`, error);
                return res.status(500).json((0, error_handler_1.formatErrorResponse)(error, 'Failed to renew subscription'));
            }
        });
    }
}
exports.AdminSubscriptionController = AdminSubscriptionController;
exports.default = new AdminSubscriptionController();
