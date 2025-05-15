/**
 * Content Analytics Routes
 * Provides routes for content analytics and metrics
 */

import express, { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';

const router: Router = express.Router();
// Authentication and authorization middleware will be added when needed

/**
 * @swagger
 * tags:
 *   name: Content Analytics
 *   description: Content analytics and metrics
 */

/**
 * @swagger
 * /api/content/analytics/metrics:
 *   get:
 *     summary: Get content metrics summary
 *     description: Retrieve summary metrics for content (total content, views, engagement, shares)
 *     tags: [Content Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for metrics (default is 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for metrics (default is current date)
 *     responses:
 *       200:
 *         description: Content metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalContent:
 *                       type: object
 *                     totalViews:
 *                       type: object
 *                     avgEngagement:
 *                       type: object
 *                     totalShares:
 *                       type: object
 *       500:
 *         description: Server error
 */
router.get('/metrics', analyticsController.getContentMetrics);

/**
 * @swagger
 * /api/content/analytics/timeseries:
 *   get:
 *     summary: Get content time series data
 *     description: Retrieve time series data for content metrics
 *     tags: [Content Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for time series (default is 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for time series (default is current date)
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *         description: Interval for time series data (default is day)
 *     responses:
 *       200:
 *         description: Time series data retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/timeseries', analyticsController.getTimeSeriesData);

/**
 * @swagger
 * /api/content/analytics/categories:
 *   get:
 *     summary: Get content distribution by category
 *     description: Retrieve content distribution by category
 *     tags: [Content Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for category distribution (optional)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for category distribution (default is current date)
 *     responses:
 *       200:
 *         description: Category distribution retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/categories', analyticsController.getCategoryDistribution);

/**
 * @swagger
 * /api/content/analytics/top:
 *   get:
 *     summary: Get top performing content
 *     description: Retrieve top performing content based on specified metric
 *     tags: [Content Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for top content (default is 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for top content (default is current date)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [views, engagement, shares]
 *         description: Metric to sort by (default is views)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of results to return (default is 10)
 *     responses:
 *       200:
 *         description: Top content retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/top', analyticsController.getTopContent);

/**
 * @swagger
 * /api/content/analytics/authors:
 *   get:
 *     summary: Get content performance by author
 *     description: Retrieve content performance metrics grouped by author
 *     tags: [Content Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for author performance (default is 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for author performance (default is current date)
 *     responses:
 *       200:
 *         description: Author performance retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/authors', analyticsController.getAuthorPerformance);

export default router;
