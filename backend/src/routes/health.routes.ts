/**
 * Health Check Routes
 * Provides endpoints to check the health of the application and its dependencies
 */

import { Router, Request, Response, NextFunction } from 'express';
import healthController from '../controllers/HealthController';

const router = Router();

/**
 * @route GET /health
 * @desc Simple health check endpoint
 * @access Public
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  healthController.check(req, res).catch(next);
});

/**
 * @route GET /health/detailed
 * @desc Detailed health check endpoint
 * @access Private
 */
router.get('/detailed', (req: Request, res: Response, next: NextFunction) => {
  healthController.detailed(req, res).catch(next);
});

/**
 * @route GET /health/database/:type
 * @desc Database-specific health check endpoint
 * @access Private
 */
router.get('/database/:type', (req: Request, res: Response, next: NextFunction) => {
  healthController.database(req, res).catch(next);
});

export default router;
