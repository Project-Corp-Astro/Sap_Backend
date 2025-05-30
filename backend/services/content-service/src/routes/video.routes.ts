// video.routes.ts - Routes for VideoController endpoints

import { Router, RequestHandler } from 'express';
import videoController from '../controllers/video.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Public Routes
router.get('/', videoController.getVideos as RequestHandler);
router.get('/featured', videoController.getFeaturedVideos as RequestHandler);
router.get('/slug/:slug', videoController.getVideoBySlug as RequestHandler);
router.get('/:id', videoController.getVideoById as RequestHandler);
router.get('/:id/related', videoController.getRelatedVideos as RequestHandler);
router.post('/:id/view', videoController.incrementViewCount as RequestHandler);

// Protected Routes
router.post('/', authMiddleware as RequestHandler, videoController.createVideo as RequestHandler);
router.put('/:id', authMiddleware as RequestHandler, videoController.updateVideo as RequestHandler);
router.delete('/:id', authMiddleware as RequestHandler, videoController.deleteVideo as RequestHandler);
router.put('/:id/engagement', authMiddleware as RequestHandler, videoController.updateEngagementMetrics as RequestHandler);

export default router;
