import { Request, Response } from 'express';
import { formatErrorResponse } from '../../utils/error-handler';
import promoCodeService from '../../services/promo-code.service';
import logger from '../../utils/logger';

/**
 * Admin controller for promo code management
 * 
 * @swagger
 * tags:
 *   name: AdminPromoCodes
 *   description: Promo code management for administrators
 */
export class AdminPromoCodeController {
  /**
   * Get all promo codes
   * 
   * @swagger
   * /api/subscription/admin/promo-codes:
   *   get:
   *     summary: Get all promo codes
   *     description: Retrieves a list of all promo codes with optional filtering
   *     tags: [AdminPromoCodes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *       - in: query
   *         name: code
   *         schema:
   *           type: string
   *         description: Filter by promo code text
   *     responses:
   *       200:
   *         description: List of promo codes
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/PromoCode'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getAllPromoCodes(req: Request, res: Response) {
    try {
      const filters = req.query;
      const promoCodes = await promoCodeService.getAllPromoCodes(filters as any);
      return res.json(promoCodes);
    } catch (error) {
      logger.error('Error in getAllPromoCodes:', error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch promo codes'));
    }
  }

  /**
   * Get a specific promo code by ID
   * 
   * @swagger
   * /api/subscription/admin/promo-codes/{id}:
   *   get:
   *     summary: Get a specific promo code
   *     description: Retrieves details of a specific promo code by ID
   *     tags: [AdminPromoCodes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Promo code ID
   *     responses:
   *       200:
   *         description: Promo code details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PromoCode'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         description: Promo code not found
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getPromoCodeById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const promoCode = await promoCodeService.getPromoCodeById(id);
      
      if (!promoCode) {
        return res.status(404).json({ message: 'Promo code not found' });
      }
      
      return res.json(promoCode);
    } catch (error) {
      logger.error(`Error in getPromoCodeById for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to fetch promo code'));
    }
  }

  /**
   * Create a new promo code
   * 
   * @swagger
   * /api/subscription/admin/promo-codes:
   *   post:
   *     summary: Create a new promo code
   *     description: Creates a new promotional code with specified discount and validity
   *     tags: [AdminPromoCodes]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - code
   *               - description
   *               - discountType
   *               - discountValue
   *               - maxUses
   *               - validFrom
   *               - validTo
   *             properties:
   *               code:
   *                 type: string
   *                 description: The promo code text users will input
   *                 example: SUMMER2025
   *               description:
   *                 type: string
   *                 description: Description for admin reference
   *                 example: Summer 2025 promotion
   *               discountType:
   *                 $ref: '#/components/schemas/DiscountType'
   *               discountValue:
   *                 type: number
   *                 format: float
   *                 description: Discount amount (percentage or fixed amount)
   *                 example: 20.00
   *               maxUses:
   *                 type: integer
   *                 description: Maximum number of times this code can be used
   *                 example: 100
   *               maxUsesPerUser:
   *                 type: integer
   *                 description: Maximum times a single user can use this code
   *                 example: 1
   *               applicableType:
   *                 $ref: '#/components/schemas/ApplicableType'
   *               validFrom:
   *                 type: string
   *                 format: date-time
   *                 description: Start date when code becomes valid
   *               validTo:
   *                 type: string
   *                 format: date-time
   *                 description: End date when code expires
   *               isActive:
   *                 type: boolean
   *                 description: Whether the promo code is active
   *                 default: true
   *     responses:
   *       201:
   *         description: Promo code created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PromoCode'
   *       400:
   *         description: Invalid request data
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async createPromoCode(req: Request, res: Response) {
    try {
      const promoCodeData = req.body;
      
      // Validate required fields
      const requiredFields = ['code', 'discountType', 'discountValue'];
      const missingFields = requiredFields.filter(field => !promoCodeData[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          message: `Missing required fields: ${missingFields.join(', ')}` 
        });
      }
      
      // Validate discount type
      const validDiscountTypes = ['percentage', 'fixed'];
      if (!validDiscountTypes.includes(promoCodeData.discountType)) {
        return res.status(400).json({ 
          message: `Invalid discount type. Must be one of: ${validDiscountTypes.join(', ')}` 
        });
      }
      
      // Validate discount value
      if (promoCodeData.discountType === 'percentage' && (promoCodeData.discountValue < 0 || promoCodeData.discountValue > 100)) {
        return res.status(400).json({ 
          message: 'Percentage discount must be between 0 and 100' 
        });
      }
      
      if (promoCodeData.discountValue < 0) {
        return res.status(400).json({ 
          message: 'Discount value cannot be negative' 
        });
      }
      
      const promoCode = await promoCodeService.createPromoCode(promoCodeData);
      return res.status(201).json(promoCode);
    } catch (error) {
      logger.error('Error in createPromoCode:', error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to create promo code'));
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
          return res.status(400).json({ 
            message: `Invalid discount type. Must be one of: ${validDiscountTypes.join(', ')}` 
          });
        }
      }
      
      // Validate discount value if provided
      if (promoCodeData.discountType === 'percentage' && 
          promoCodeData.discountValue !== undefined && 
          (promoCodeData.discountValue < 0 || promoCodeData.discountValue > 100)) {
        return res.status(400).json({ 
          message: 'Percentage discount must be between 0 and 100' 
        });
      }
      
      if (promoCodeData.discountValue !== undefined && promoCodeData.discountValue < 0) {
        return res.status(400).json({ 
          message: 'Discount value cannot be negative' 
        });
      }
      
      const promoCode = await promoCodeService.updatePromoCode(id, promoCodeData);
      
      if (!promoCode) {
        return res.status(404).json({ message: 'Promo code not found' });
      }
      
      return res.json(promoCode);
    } catch (error) {
      logger.error(`Error in updatePromoCode for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to update promo code'));
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
      logger.error(`Error in deletePromoCode for id ${req.params.id}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to delete promo code'));
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
        return res.status(400).json({ 
          message: 'planIds must be a non-empty array' 
        });
      }
      
      const result = await promoCodeService.addApplicablePlans(promoCodeId, planIds);
      return res.status(201).json(result);
    } catch (error) {
      logger.error(`Error in addApplicablePlans for promoCodeId ${req.params.promoCodeId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to add applicable plans'));
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
        return res.status(400).json({ 
          message: 'userIds must be a non-empty array' 
        });
      }
      
      const result = await promoCodeService.addApplicableUsers(promoCodeId, userIds);
      return res.status(201).json(result);
    } catch (error) {
      logger.error(`Error in addApplicableUsers for promoCodeId ${req.params.promoCodeId}:`, error);
      return res.status(500).json(formatErrorResponse(error, 'Failed to add applicable users'));
    }
  }
}

export default new AdminPromoCodeController();
