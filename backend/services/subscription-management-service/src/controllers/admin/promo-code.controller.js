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
exports.AdminPromoCodeController = void 0;
const promo_code_service_1 = require("../../services/promo-code.service");
const console_1 = __importDefault(require("console"));
class AdminPromoCodeController {
    /**
     * @swagger
     * /api/subscription/admin/promo-codes:
     *   get:
     *     summary: Get all promo codes
     *     description: Retrieves a paginated list of promo codes with optional filtering and sorting
     *     tags: [AdminPromoCodes]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number for pagination
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of items per page
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [active, inactive, percentage, fixed]
     *         description: Filter by status or discount type
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *         description: Search by promo code
     *       - in: query
     *         name: sort
     *         schema:
     *           type: string
     *           default: createdAt:DESC
     *           description: Sort order (field:direction)
     *     responses:
     *       200:
     *         description: A paginated list of promo codes.
     *       400:
     *         description: Invalid query parameters.
     */
    getAllPromoCodes(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console_1.default.log('=== PROMO CODE CONTROLLER ===');
                console_1.default.log('Raw query parameters:', req.query);
                console_1.default.log('Request headers:', req.headers);
                const { status, discountType, search, sort, page, pageSize } = req.query;
                console_1.default.log('Parsed parameters:', {
                    status,
                    discountType,
                    search,
                    sort,
                    page,
                    pageSize
                });
                // If status is 'percentage' or 'fixed', treat it as a discountType
                const isDiscountType = status === 'percentage' || status === 'fixed';
                const statusFilter = isDiscountType ? undefined : status;
                console_1.default.log('Discount type detection:', {
                    isDiscountType,
                    statusFilter,
                    statusValue: status
                });
                // Ensure discountType is either 'percentage', 'fixed', or undefined
                let discountTypeFilter;
                if (isDiscountType) {
                    discountTypeFilter = status;
                    console_1.default.log(`Treating status '${status}' as discount type filter`);
                }
                else if (discountType === 'percentage' || discountType === 'fixed') {
                    discountTypeFilter = discountType;
                    console_1.default.log(`Using explicit discount type filter: ${discountType}`);
                }
                else {
                    console_1.default.log('No discount type filter will be applied');
                }
                const serviceParams = {
                    status: statusFilter,
                    discountType: discountTypeFilter,
                    search: search,
                    sort: sort,
                    page: page ? parseInt(page) : undefined,
                    pageSize: pageSize ? parseInt(pageSize) : undefined,
                };
                console_1.default.log('Calling promoCodeService.getAllPromoCodes with params:', JSON.stringify(serviceParams, null, 2));
                const startTime = Date.now();
                const promoCodes = yield promo_code_service_1.promoCodeService.getAllPromoCodes(serviceParams);
                const duration = Date.now() - startTime;
                console_1.default.log(`Service call completed in ${duration}ms`);
                console_1.default.log(`Returning ${promoCodes.items.length} promo codes`);
                res.json(promoCodes);
            }
            catch (error) {
                console_1.default.error('Error in getAllPromoCodes:', error);
                next(error);
            }
        });
    }
    /**
     * @swagger
     * /api/subscription/admin/promo-codes/{id}:
     *   get:
     *     summary: Get a specific promo code by ID
     *     tags: [AdminPromoCodes]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Promo code details.
     *       404:
     *         description: Promo code not found.
     */
    getPromoCodeById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const promoCode = yield promo_code_service_1.promoCodeService.getPromoCodeById(req.params.id);
                res.json(promoCode);
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * @swagger
     * /api/subscription/admin/promo-codes:
     *   post:
     *     summary: Create a new promo code
     *     tags: [AdminPromoCodes]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/PromoCode'
     *     responses:
     *       201:
     *         description: Promo code created successfully.
     *       400:
     *         description: Invalid promo code data.
     */
    createPromoCode(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const newPromoCode = yield promo_code_service_1.promoCodeService.createPromoCode(req.body);
                res.status(201).json(newPromoCode);
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * @swagger
     * /api/subscription/admin/promo-codes/{id}:
     *   patch:
     *     summary: Update an existing promo code
     *     tags: [AdminPromoCodes]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/PromoCode'
     *     responses:
     *       200:
     *         description: Promo code updated successfully.
     *       400:
     *         description: Invalid promo code data.
     *       404:
     *         description: Promo code not found.
     */
    updatePromoCode(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedPromoCode = yield promo_code_service_1.promoCodeService.updatePromoCode(req.params.id, req.body);
                res.json(updatedPromoCode);
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * @swagger
     * /api/subscription/admin/promo-codes/{id}:
     *   delete:
     *     summary: Delete a promo code
     *     tags: [AdminPromoCodes]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       204:
     *         description: Promo code deleted successfully.
     *       404:
     *         description: Promo code not found.
     */
    deletePromoCode(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield promo_code_service_1.promoCodeService.deletePromoCode(req.params.id);
                res.status(204).send();
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.AdminPromoCodeController = AdminPromoCodeController;
