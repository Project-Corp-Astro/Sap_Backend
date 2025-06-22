
import { Request, Response } from 'express';
import { formatErrorResponse } from '../../utils/error-handler';
import { PromoCodeAnalyticsService } from '../../services/promo-code-analytics.service';
import logger from '../../utils/logger';

// Create the singleton instance
const promoCodeAnalyticsService = PromoCodeAnalyticsService.getInstance();

/**
 * Controller for promo code analytics
 */
export class PromoCodeAnalyticsController {
  /**
   * Get comprehensive promo code analytics
   */
  async getAnalytics(req: Request, res: Response) {
    try {
      const analytics = await promoCodeAnalyticsService.getAnalytics();
      res.status(200).json(analytics);
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error getting promo code analytics:', { error: error.message, stack: error.stack });
        res.status(500).json(formatErrorResponse(error.message));
      } else {
        logger.error('Error getting promo code analytics:', { error: String(error) });
        res.status(500).json(formatErrorResponse('Unknown error occurred while fetching promo code analytics'));
      }
    }
  }
}

export default new PromoCodeAnalyticsController();