import { Request, Response, NextFunction } from 'express';
import { promoCodeService } from '../../services/promo-code.service';
import console from 'console';
import { DiscountType } from '../../entities/PromoCode.entity';

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
  async getAllPromoCodes(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('=== PROMO CODE CONTROLLER ===');
      console.log('Raw query parameters:', req.query);
      console.log('Request headers:', req.headers);
      
      const { status, discountType, search, sort, page, pageSize } = req.query;
      
      console.log('Parsed parameters:', {
        status,
        discountType,
        search,
        sort,
        page,
        pageSize
      });

      // If status is 'percentage' or 'fixed', treat it as a discountType
      const isDiscountType = status === 'percentage' || status === 'fixed';
      const statusFilter = isDiscountType ? undefined : status as string;
      
      console.log('Discount type detection:', { 
        isDiscountType, 
        statusFilter,
        statusValue: status
      });
      
      // Ensure discountType is either 'percentage', 'fixed', or undefined
      let discountTypeFilter: 'percentage' | 'fixed' | undefined;
      if (isDiscountType) {
        discountTypeFilter = status as 'percentage' | 'fixed';
        console.log(`Treating status '${status}' as discount type filter`);
      } else if (discountType === 'percentage' || discountType === 'fixed') {
        discountTypeFilter = discountType;
        console.log(`Using explicit discount type filter: ${discountType}`);
      } else {
        console.log('No discount type filter will be applied');
      }

      const serviceParams = {
        status: statusFilter,
        discountType: discountTypeFilter,
        search: search as string,
        sort: sort as string,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      };
      
      console.log('Calling promoCodeService.getAllPromoCodes with params:', JSON.stringify(serviceParams, null, 2));
      
      const startTime = Date.now();
      const promoCodes = await promoCodeService.getAllPromoCodes(serviceParams);
      const duration = Date.now() - startTime;
      
      console.log(`Service call completed in ${duration}ms`);
      console.log(`Returning ${promoCodes.items.length} promo codes`);
      
      res.json(promoCodes);
    } catch (error) {
      console.error('Error in getAllPromoCodes:', error);
      next(error);
    }
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
  async getPromoCodeById(req: Request, res: Response, next: NextFunction) {
    try {
      const promoCode = await promoCodeService.getPromoCodeById(req.params.id);
      res.json(promoCode);
    } catch (error) {
      next(error);
    }
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
  async createPromoCode(req: Request, res: Response, next: NextFunction) {
    try {
      const newPromoCode = await promoCodeService.createPromoCode(req.body);
      res.status(201).json(newPromoCode);
    } catch (error) {
      next(error);
    }
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
  async updatePromoCode(req: Request, res: Response, next: NextFunction) {
    try {
      const updatedPromoCode = await promoCodeService.updatePromoCode(req.params.id, req.body);
      res.json(updatedPromoCode);
    } catch (error) {
      next(error);
    }
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
  async deletePromoCode(req: Request, res: Response, next: NextFunction) {
    try {
      await promoCodeService.deletePromoCode(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export { AdminPromoCodeController };