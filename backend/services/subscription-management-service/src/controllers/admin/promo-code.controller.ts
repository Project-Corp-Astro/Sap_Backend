
import { Request, Response } from 'express';
import { formatErrorResponse } from '../../utils/error-handler';
import promoCodeService from '../../services/promo-code.service';
import logger from '../../utils/logger';

interface PromoCodesResponse {
  items: any[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}

export class AdminPromoCodeController {
  /**
   * Get all promo codes
   * 
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
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, expired, percentage, fixed]
   *         description: Filter by status or discount type
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search by promo code or description
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: createdAt_desc
   *           enum: [createdAt_asc, createdAt_desc, code_asc, code_desc]
   *         description: Sort order (field_direction)
   *     responses:
   *       200:
   *         description: Paginated list of promo codes
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PromoCode'
   *                 totalPages:
   *                   type: integer
   *                   description: Total number of pages
   *                 currentPage:
   *                   type: integer
   *                   description: Current page number
   *                 totalItems:
   *                   type: integer
   *                   description: Total number of promo codes
   *       400:
   *         description: Invalid query parameters
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getAllPromoCodes(req: Request, res: Response) {
    try {
      const { page = '1', status, search, sort = 'createdAt_desc' } = req.query;

      // Validate query parameters
      const pageNum = parseInt(page as string, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json(formatErrorResponse(new Error('Invalid page parameter'), 'INVALID_PAGE'));
      }

      const validStatuses = ['active', 'expired', 'percentage', 'fixed', ''];
      if (status && !validStatuses.includes(status as string)) {
        return res.status(400).json(formatErrorResponse(new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`), 'INVALID_STATUS'));
      }

      const validSorts = ['createdAt_asc', 'createdAt_desc', 'code_asc', 'code_desc'];
      if (sort && !validSorts.includes(sort as string)) {
        return res.status(400).json(formatErrorResponse(new Error(`Invalid sort. Must be one of: ${validSorts.join(', ')}`), 'INVALID_SORT'));
      }

      const filters = {
        page: pageNum,
        status: status as string || '',
        search: search as string || '',
        sort: sort as string,
      };

      const promoCodes: PromoCodesResponse = await promoCodeService.getAllPromoCodes(filters);
      return res.json(promoCodes);
    } catch (error) {
      if (error instanceof Error && error.name === 'PromoCodeError') {
        logger.error(`Error in getAllPromoCodes: ${error.message}`, error);
        return res.status(400).json(formatErrorResponse(error.message, (error as any).error || 'INVALID_REQUEST'));
      }
      logger.error('Error in getAllPromoCodes:', error);
      return res.status(500).json(formatErrorResponse('Failed to fetch promo codes', 'SERVER_ERROR'));
    }
  }

  /**
   * Get a specific promo code by ID
   */
  async getPromoCodeById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const promoCode = await promoCodeService.getPromoCodeById(id);

      if (!promoCode) {
        return res.status(404).json(formatErrorResponse('Promo code not found', 'NOT_FOUND'));
      }

      return res.json(promoCode);
    } catch (error) {
      if (error instanceof Error && error.name === 'PromoCodeError') {
        logger.error(`Error in getPromoCodeById for id ${req.params.id}: ${error.message}`, error);
        return res.status(error.message.includes('NOT_FOUND') ? 404 : 400).json(formatErrorResponse(error.message, (error as any).error || 'INVALID_REQUEST'));
      }
      logger.error(`Error in getPromoCodeById for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse('Failed to fetch promo code', 'SERVER_ERROR'));
    }
  }

  /**
   * Create a new promo code
   */
  async createPromoCode(req: Request, res: Response) {
    try {
      const promoCodeData = req.body;

      // Validate required fields
      const requiredFields = ['code', 'discountType', 'discountValue'];
      const missingFields = requiredFields.filter(field => !promoCodeData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json(formatErrorResponse(`Missing required fields: ${missingFields.join(', ')}`, 'MISSING_FIELDS'));
      }

      // Validate discount type
      const validDiscountTypes = ['percentage', 'fixed'];
      if (!validDiscountTypes.includes(promoCodeData.discountType)) {
        return res.status(400).json(formatErrorResponse(`Invalid discount type. Must be one of: ${validDiscountTypes.join(', ')}`, 'INVALID_DISCOUNT_TYPE'));
      }

      // Validate discount value
      if (promoCodeData.discountType === 'percentage' && (promoCodeData.discountValue < 0 || promoCodeData.discountValue > 100)) {
        return res.status(400).json(formatErrorResponse('Percentage discount must be between 0 and 100', 'INVALID_PERCENTAGE'));
      }

      if (promoCodeData.discountValue < 0) {
        return res.status(400).json(formatErrorResponse('Discount value cannot be negative', 'INVALID_DISCOUNT_VALUE'));
      }

      const promoCode = await promoCodeService.createPromoCode(promoCodeData);
      return res.status(201).json(promoCode);
    } catch (error) {
      if (error instanceof Error && error.name === 'PromoCodeError') {
        logger.error(`Error in createPromoCode: ${error.message}`, error);
        return res.status(400).json(formatErrorResponse(error.message, (error as any).error || 'INVALID_REQUEST'));
      }
      logger.error('Error in createPromoCode:', error);
      return res.status(500).json(formatErrorResponse('Failed to create promo code', 'SERVER_ERROR'));
    }
  }

  /**
   * Update an existing promo code
   */
  async updatePromoCode(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const promoCodeData = req.body;

      // Validate discount type if provided
      if (promoCodeData.discountType) {
        const validDiscountTypes = ['percentage', 'fixed'];
        if (!validDiscountTypes.includes(promoCodeData.discountType)) {
          return res.status(400).json(formatErrorResponse(`Invalid discount type. Must be one of: ${validDiscountTypes.join(', ')}`, 'INVALID_DISCOUNT_TYPE'));
        }
      }

      // Validate discount value if provided
      if (promoCodeData.discountType === 'percentage' && 
          promoCodeData.discountValue !== undefined && 
          (promoCodeData.discountValue < 0 || promoCodeData.discountValue > 100)) {
        return res.status(400).json(formatErrorResponse('Percentage discount must be between 0 and 100', 'INVALID_PERCENTAGE'));
      }

      if (promoCodeData.discountValue !== undefined && promoCodeData.discountValue < 0) {
        return res.status(400).json(formatErrorResponse('Discount value cannot be negative', 'INVALID_DISCOUNT_VALUE'));
      }

      const promoCode = await promoCodeService.updatePromoCode(id, promoCodeData);

      if (!promoCode) {
        return res.status(404).json(formatErrorResponse('Promo code not found', 'NOT_FOUND'));
      }

      return res.json(promoCode);
    } catch (error) {
      if (error instanceof Error && error.name === 'PromoCodeError') {
        logger.error(`Error in updatePromoCode for id ${req.params.id}: ${error.message}`, error);
        return res.status(error.message.includes('NOT_FOUND') ? 404 : 400).json(formatErrorResponse(error.message, (error as any).error || 'INVALID_REQUEST'));
      }
      logger.error(`Error in updatePromoCode for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse('Failed to update promo code', 'SERVER_ERROR'));
    }
  }

  /**
   * Delete a promo code
   */
  async deletePromoCode(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await promoCodeService.deletePromoCode(id);
      return res.status(200).json({ message: 'Promo code deleted successfully' });
    } catch (error) {
      if (error instanceof Error && error.name === 'PromoCodeError') {
        logger.error(`Error in deletePromoCode for id ${req.params.id}: ${error.message}`, error);
        return res.status(error.message.includes('NOT_FOUND') ? 404 : 400).json(formatErrorResponse(error.message, (error as any).error || 'INVALID_REQUEST'));
      }
      logger.error(`Error in deletePromoCode for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse('Failed to delete promo code', 'SERVER_ERROR'));
    }
  }

  /**
   * Add applicable plans to a promo code
   */
  async addApplicablePlans(req: Request, res: Response) {
    try {
      const { promoCodeId } = req.params;
      const { planIds } = req.body;

      if (!planIds || !Array.isArray(planIds) || planIds.length === 0) {
        return res.status(400).json(formatErrorResponse('planIds must be a non-empty array', 'INVALID_PLAN_IDS'));
      }

      const result = await promoCodeService.addApplicablePlans(promoCodeId, planIds);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.name === 'PromoCodeError') {
        logger.error(`Error in addApplicablePlans for promoCodeId ${req.params.promoCodeId}: ${error.message}`, error);
        return res.status(error.message.includes('NOT_FOUND') ? 404 : 400).json(formatErrorResponse(error.message, (error as any).error || 'INVALID_REQUEST'));
      }
      logger.error(`Error in addApplicablePlans for promoCodeId ${req.params.promoCodeId}:`, error);
      return res.status(500).json(formatErrorResponse('Failed to add applicable plans', 'SERVER_ERROR'));
    }
  }

  /**
   * Add applicable users to a promo code
   */
  async addApplicableUsers(req: Request, res: Response) {
    try {
      const { promoCodeId } = req.params;
      const { userIds } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json(formatErrorResponse('userIds must be a non-empty array', 'INVALID_USER_IDS'));
      }

      const result = await promoCodeService.addApplicableUsers(promoCodeId, userIds);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.name === 'PromoCodeError') {
        logger.error(`Error in addApplicableUsers for promoCodeId ${req.params.promoCodeId}: ${error.message}`, error);
        return res.status(error.message.includes('NOT_FOUND') ? 404 : 400).json(formatErrorResponse(error.message, (error as any).error || 'INVALID_REQUEST'));
      }
      logger.error(`Error in addApplicableUsers for promoCodeId ${req.params.promoCodeId}:`, error);
      return res.status(500).json(formatErrorResponse('Failed to add applicable users', 'SERVER_ERROR'));
    }
  }
}

export default new AdminPromoCodeController();