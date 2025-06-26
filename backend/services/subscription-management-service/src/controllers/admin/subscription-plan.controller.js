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
exports.AdminSubscriptionPlanController = void 0;
const subscription_plan_service_1 = __importDefault(require("../../services/subscription-plan.service"));
/**
 * Admin controller for subscription plan management
 *
 * @swagger
 * tags:
 *   name: AdminSubscriptionPlans
 *   description: Subscription plan management for administrators
 */
class AdminSubscriptionPlanController {
    /**
     * Get all subscription plans
     */
    getAllPlans(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { appId, page = '1', limit = '10', status, name, sortPosition, highlight, billingCycle } = req.query;
                const pageNum = parseInt(page, 10);
                const limitNum = parseInt(limit, 10);
                if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
                    return res.status(400).json({ message: 'Invalid page or limit parameters' });
                }
                const filterParams = {
                    appId: appId,
                    status: status,
                    name: name,
                    description: undefined,
                    price: undefined,
                    billingCycle: billingCycle,
                    trialDays: undefined,
                    sortPosition: sortPosition ? parseInt(sortPosition) : undefined,
                    highlight: highlight,
                    includeInactive: req.query.includeInactive === 'true'
                };
                const result = yield subscription_plan_service_1.default.getAllPlans(filterParams, pageNum, limitNum);
                const { plans, total } = result;
                return res.json({ plans, total });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get a specific plan by ID
     */
    getPlanById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!id || typeof id !== 'string') {
                    return res.status(400).json({ message: 'Invalid plan ID' });
                }
                const plan = yield subscription_plan_service_1.default.getPlanById(id);
                if (!plan) {
                    return res.status(404).json({ message: 'Subscription plan not found' });
                }
                return res.json(plan);
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Create a new subscription plan
     */
    createPlan(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const planData = req.body;
                const requiredFields = ['name', 'price', 'billingCycle'];
                const missingFields = requiredFields.filter(field => !planData[field]);
                if (missingFields.length > 0) {
                    return res.status(400).json({
                        message: `Missing required fields: ${missingFields.join(', ')}`
                    });
                }
                const plan = yield subscription_plan_service_1.default.createPlan(planData);
                return res.status(201).json(plan);
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Update an existing subscription plan
     */
    updatePlan(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const planData = req.body;
                if (!id || typeof id !== 'string') {
                    return res.status(400).json({ message: 'Invalid plan ID' });
                }
                // Validate appId if provided
                if (planData.appId && typeof planData.appId !== 'string') {
                    return res.status(400).json({ message: 'appId must be a string' });
                }
                // Remove application field if present
                if ('application' in planData) {
                    delete planData.application;
                }
                const plan = yield subscription_plan_service_1.default.updatePlan(id, planData);
                if (!plan) {
                    return res.status(404).json({ message: 'Subscription plan not found' });
                }
                return res.json(plan);
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Delete a subscription plan (mark as inactive)
     */
    deletePlan(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!id || typeof id !== 'string') {
                    return res.status(400).json({ message: 'Invalid plan ID' });
                }
                yield subscription_plan_service_1.default.deletePlan(id);
                return res.status(200).json({ message: 'Subscription plan marked as inactive' });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Hard delete a subscription plan (super admin only)
     */
    hardDeletePlan(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!id || typeof id !== 'string') {
                    return res.status(400).json({ message: 'Invalid plan ID' });
                }
                yield subscription_plan_service_1.default.hardDeletePlan(id);
                return res.status(200).json({ message: 'Subscription plan permanently deleted' });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Add a feature to a subscription plan
     */
    addFeature(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { planId } = req.params;
                const featureData = req.body;
                if (!planId || typeof planId !== 'string') {
                    return res.status(400).json({ message: 'Invalid plan ID' });
                }
                const requiredFields = ['name', 'description'];
                const missingFields = requiredFields.filter(field => !featureData[field]);
                if (missingFields.length > 0) {
                    return res.status(400).json({
                        message: `Missing required fields: ${missingFields.join(', ')}`
                    });
                }
                const feature = yield subscription_plan_service_1.default.addFeature(planId, featureData);
                return res.status(201).json(feature);
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Update a plan feature
     */
    updateFeature(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { featureId } = req.params;
                const featureData = req.body;
                if (!featureId || typeof featureId !== 'string') {
                    return res.status(400).json({ message: 'Invalid feature ID' });
                }
                const feature = yield subscription_plan_service_1.default.updateFeature(featureId, featureData);
                if (!feature) {
                    return res.status(404).json({ message: 'Feature not found' });
                }
                return res.json(feature);
            }
            catch (error) {
                next(error);
            }
        });
    }
    getAppsForDropdown(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const apps = yield subscription_plan_service_1.default.getAppsForDropdown();
                res.status(200).json(apps);
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Delete a plan feature
     */
    deleteFeature(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { featureId } = req.params;
                if (!featureId || typeof featureId !== 'string') {
                    return res.status(400).json({ message: 'Invalid feature ID' });
                }
                yield subscription_plan_service_1.default.deleteFeature(featureId);
                return res.status(200).json({ message: 'Feature deleted successfully' });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.AdminSubscriptionPlanController = AdminSubscriptionPlanController;
exports.default = new AdminSubscriptionPlanController();
