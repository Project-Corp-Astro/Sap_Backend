/**
 * Content Analytics Controller
 * Provides endpoints for content analytics and metrics
 */

import { Request, Response, NextFunction } from 'express';
import Content from '../models/Content.js';
import { createServiceLogger } from '../utils/sharedLogger.js';
import { AppError, ErrorTypes } from '../utils/errorHandler.js';
import {
  ContentMetrics,
  TimeSeriesDataPoint,
  CategoryDataPoint,
  TopContentItem,
  AuthorPerformance,
  TimeGroup
} from '../interfaces/analytics.interfaces.js';

// Create a logger for this controller
const logger = createServiceLogger('content-analytics-controller');

/**
 * Create an internal error
 */
const createInternalError = (message: string, details: Record<string, any> = {}, originalError?: Error): AppError => {
  logger.error(message, { details, originalError: originalError?.message });
  return new AppError(message, ErrorTypes.INTERNAL, 500);
};

/**
 * Get content metrics summary
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export async function getContentMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logger.info('Fetching content metrics summary');

    // Get date range from query parameters or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Get total content count
    const totalContent = await Content.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Get total views
    const viewsResult = await Content.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, totalViews: { $sum: '$viewCount' } } },
    ]);
    const totalViews = viewsResult.length > 0 ? viewsResult[0].totalViews : 0;

    // Get average engagement (using likeCount as a proxy for engagement)
    const engagementResult = await Content.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, avgEngagement: { $avg: '$likeCount' } } },
    ]);
    const avgEngagement = engagementResult.length > 0 ? engagementResult[0].avgEngagement : 0;

    // Get total shares (assuming a shareCount field exists)
    const sharesResult = await Content.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, totalShares: { $sum: '$shareCount' } } },
    ]);
    const totalShares = sharesResult.length > 0 ? sharesResult[0].totalShares : 0;

    // Get previous period metrics for comparison
    const prevStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

    // Get previous period total views
    const prevViewsResult = await Content.aggregate([
      { $match: { createdAt: { $gte: prevStartDate, $lt: startDate } } },
      { $group: { _id: null, totalViews: { $sum: '$viewCount' } } },
    ]);
    const prevTotalViews = prevViewsResult.length > 0 ? prevViewsResult[0].totalViews : 0;

    // Calculate change percentages
    const viewsChange = prevTotalViews > 0
      ? ((totalViews - prevTotalViews) / prevTotalViews) * 100
      : 0;

    // Prepare response
    const metrics: ContentMetrics = {
      totalContent: {
        value: totalContent,
        change: 0, // Placeholder - would need previous period data
        trend: 'neutral',
      },
      totalViews: {
        value: totalViews,
        change: viewsChange,
        trend: viewsChange > 0 ? 'up' : viewsChange < 0 ? 'down' : 'neutral',
      },
      avgEngagement: {
        value: avgEngagement,
        change: 0, // Placeholder - would need previous period data
        trend: 'neutral',
      },
      totalShares: {
        value: totalShares,
        change: 0, // Placeholder - would need previous period data
        trend: 'neutral',
      },
    };

    res.status(200).json({
      success: true,
      data: metrics,
      meta: {
        dateRange: {
          startDate,
          endDate,
        },
      },
    });
  } catch (err) {
    logger.error('Error fetching content metrics', { error: (err as Error).message });
    throw new AppError(
      'Failed to fetch content metrics',
      ErrorTypes.INTERNAL,
      500
    );
  }
}

/**
 * Get content time series data
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export async function getTimeSeriesData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logger.info('Fetching content time series data');

    // Get date range from query parameters or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Get interval from query parameters or use default (day)
    const interval = req.query.interval as string || 'day';

    // Define time grouping based on interval
    let timeGroup: TimeGroup;
    switch (interval) {
      case 'hour':
        timeGroup = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' },
        };
        break;
      case 'day':
        timeGroup = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
        break;
      case 'week':
        timeGroup = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' },
        };
        break;
      case 'month':
        timeGroup = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        };
        break;
      default:
        timeGroup = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
    }

    // Aggregate time series data
    const timeSeriesData = await Content.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: timeGroup,
          views: { $sum: '$viewCount' },
          engagement: { $sum: '$likeCount' },
          shares: { $sum: '$shareCount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1,
        },
      },
    ]);

    // Format time series data
    const formattedData: TimeSeriesDataPoint[] = timeSeriesData.map((item) => {
      // Create date based on interval
      let date: Date;
      switch (interval) {
        case 'hour': {
          date = new Date(
            item._id.year,
            item._id.month - 1,
            item._id.day,
            item._id.hour,
          );
          break;
        }
        case 'day': {
          date = new Date(
            item._id.year,
            item._id.month - 1,
            item._id.day,
          );
          break;
        }
        case 'week': {
          // Create date for the first day of the week
          const firstDayOfYear = new Date(item._id.year, 0, 1);
          date = new Date(firstDayOfYear);
          date.setDate(firstDayOfYear.getDate() + (item._id.week * 7));
          break;
        }
        case 'month': {
          date = new Date(
            item._id.year,
            item._id.month - 1,
            1,
          );
          break;
        }
        default: {
          date = new Date(
            item._id.year,
            item._id.month - 1,
            item._id.day,
          );
        }
      }

      return {
        date: date.toISOString(),
        views: item.views || 0,
        engagement: item.engagement || 0,
        shares: item.shares || 0,
        count: item.count || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedData,
      meta: {
        dateRange: {
          startDate,
          endDate,
        },
        interval,
      },
    });
  } catch (err) {
    logger.error('Error fetching time series data', { error: (err as Error).message });
    next(createInternalError('Failed to fetch time series data', {}, err as Error));
  }
}

/**
 * Get content distribution by category
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export async function getCategoryDistribution(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logger.info('Fetching content category distribution');

    // Get date range from query parameters or use default (all time)
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : null;

    // Build match criteria
    const matchCriteria = startDate
      ? { createdAt: { $gte: startDate, $lte: endDate } }
      : {};

    // Aggregate category distribution
    const categoryData = await Content.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          views: { $sum: '$viewCount' },
          engagement: { $sum: '$likeCount' },
          shares: { $sum: '$shareCount' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Calculate total count for percentage
    const totalCount = categoryData.reduce((sum, item) => sum + item.count, 0);

    // Format category data
    const formattedData: CategoryDataPoint[] = categoryData.map((item) => ({
      category: item._id,
      count: item.count,
      percentage: totalCount > 0 ? (item.count / totalCount) * 100 : 0,
      views: item.views || 0,
      engagement: item.engagement || 0,
      shares: item.shares || 0,
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
      meta: {
        dateRange: {
          startDate: startDate || 'all',
          endDate,
        },
        totalCount,
      },
    });
  } catch (err) {
    logger.error('Error fetching category distribution', { error: (err as Error).message });
    next(createInternalError('Failed to fetch category distribution', {}, err as Error));
  }
}

/**
 * Get top performing content
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export async function getTopContent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logger.info('Fetching top performing content');

    // Get date range from query parameters or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Get sort field and limit
    const sortBy = req.query.sortBy as string || 'views';
    const limit = parseInt(req.query.limit as string, 10) || 10;

    // Define sort field
    let sortField: string;
    switch (sortBy) {
      case 'views':
        sortField = 'viewCount';
        break;
      case 'engagement':
        sortField = 'likeCount';
        break;
      case 'shares':
        sortField = 'shareCount';
        break;
      default:
        sortField = 'viewCount';
    }

    // Get top content
    const topContent = await Content.find({
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ [sortField]: -1 })
      .limit(limit)
      .select('_id title slug viewCount likeCount shareCount author publishedAt');

    // Format top content
    const formattedData: TopContentItem[] = topContent.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      slug: item.slug,
      views: item.viewCount || 0,
      engagement: item.likeCount || 0,
      shares: (item as any).shareCount || 0,
      author: {
        id: item.author.id,
        name: item.author.name,
      },
      publishedAt: item.publishedAt ? item.publishedAt.toISOString() : '',
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
      meta: {
        dateRange: {
          startDate,
          endDate,
        },
        sortBy,
        limit,
      },
    });
  } catch (err) {
    logger.error('Error fetching top content', { error: (err as Error).message });
    next(createInternalError('Failed to fetch top content', {}, err as Error));
  }
}

/**
 * Get content performance by author
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export async function getAuthorPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logger.info('Fetching content performance by author');

    // Get date range from query parameters or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Aggregate author performance
    const authorData = await Content.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$author.id',
          name: { $first: '$author.name' },
          contentCount: { $sum: 1 },
          totalViews: { $sum: '$viewCount' },
          totalEngagement: { $sum: '$likeCount' },
        },
      },
      {
        $project: {
          id: '$_id',
          name: 1,
          contentCount: 1,
          totalViews: 1,
          avgViews: { $divide: ['$totalViews', '$contentCount'] },
          totalEngagement: 1,
          avgEngagement: { $divide: ['$totalEngagement', '$contentCount'] },
        },
      },
      { $sort: { totalViews: -1 } },
    ]);

    // Format author data
    const formattedData: AuthorPerformance[] = authorData.map((item) => ({
      id: item.id,
      name: item.name,
      contentCount: item.contentCount,
      totalViews: item.totalViews || 0,
      avgViews: item.avgViews || 0,
      totalEngagement: item.totalEngagement || 0,
      avgEngagement: item.avgEngagement || 0,
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
      meta: {
        dateRange: {
          startDate,
          endDate,
        },
      },
    });
  } catch (err) {
    logger.error('Error fetching author performance', { error: (err as Error).message });
    next(createInternalError('Failed to fetch author performance', {}, err as Error));
  }
}
