/**
 * Monitoring Routes
 * Routes for monitoring service health and performance
 */

import express from 'express';
import * as monitoringController from '../controllers/monitoring.controller';

const router = express.Router();

/**
 * @route GET /health
 * @desc Get service health status
 * @access Public
 */
// @ts-ignore - Ignoring type error for route handler compatibility
router.get('/health', monitoringController.getHealth);

/**
 * @route GET /metrics
 * @desc Get detailed performance metrics
 * @access Private
 */
// @ts-ignore - Ignoring type error for route handler compatibility
router.get('/metrics', monitoringController.getMetrics);

/**
 * @route GET /system
 * @desc Get system information
 * @access Private
 */
// @ts-ignore - Ignoring type error for route handler compatibility
router.get('/system', monitoringController.getSystemInfo);

/**
 * @route POST /metrics/reset
 * @desc Reset performance metrics
 * @access Private/Admin
 */
// @ts-ignore - Ignoring type error for route handler compatibility
router.post('/metrics/reset', monitoringController.resetMetrics);

export default router;
