import { Router, RequestHandler } from 'express';
import monitoringController from '../controllers/monitoring.controller';

const router = Router();

/**
 * @route GET /api/monitoring/metrics
 * @description Get performance metrics including cache hit rates, response times, and memory usage
 * @access Private - Admin only
 */
router.get('/metrics', monitoringController.getMetrics as RequestHandler);

/**
 * @route POST /api/monitoring/metrics/reset
 * @description Reset performance metrics
 * @access Private - Admin only
 */
router.post('/metrics/reset', monitoringController.resetMetrics);

/**
 * @route GET /api/monitoring/health
 * @description Get health status of the service
 * @access Public
 */
router.get('/health', monitoringController.getHealth);

export default router;
