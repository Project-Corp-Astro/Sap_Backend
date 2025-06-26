import { Request, Response } from 'express';
import { subscriptionAnalyticsService } from '../services/subscription-analytics.service';
import { DateRangeDto } from '../dtos/subscription-analytics.dto';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import logger from '../utils/logger';

export class SubscriptionAnalyticsController {
  /**
   * Get analytics for a specific date range
   */
  public static async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // Convert query params to DTO
      const dateRange = plainToInstance(DateRangeDto, {
        startDate: req.query.startDate || new Date(0).toISOString(),
        endDate: req.query.endDate || new Date().toISOString(),
        appId: req.query.appId
      });

      // Validate DTO
      await validateOrReject(dateRange, { 
        validationError: { target: false },
        whitelist: true,
        forbidNonWhitelisted: true
      });

      // Get analytics
      const analytics = await subscriptionAnalyticsService.getAnalytics({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        appId: dateRange.appId
      });
      
      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting subscription analytics:', error);
      
      if (Array.isArray(error) && error.length > 0) {
        // Handle validation errors
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.map(err => ({
            property: err.property,
            constraints: err.constraints,
            value: err.value
          }))
        });
      } else {
        // Handle other errors
        res.status(500).json({ 
          success: false,
          error: 'Failed to get analytics',
          message: error instanceof Error ? error.message : 'An unknown error occurred'
        });
      }
    }
  }

  /**
   * Get analytics for the last 30 days
   */
  public static async getCurrentAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dateRange = {
        startDate: thirtyDaysAgo.toISOString(),
        endDate: new Date().toISOString(),
        appId: req.query.appId as string | undefined
      };

      const analytics = await subscriptionAnalyticsService.getAnalytics({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        appId: dateRange.appId
      });
      
      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting current analytics:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get current analytics',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }
}
