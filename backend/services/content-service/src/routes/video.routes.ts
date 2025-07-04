// video.routes.ts - Routes for VideoController endpoints

import { Router, RequestHandler } from 'express';
import videoController from '../controllers/video.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../../../../src/middleware/requirePermission';

const router = Router();

router.use(authMiddleware as RequestHandler);
router.use( requirePermission('video:manage', { application: 'cms' }),)

// Public Routes
router.get('/', videoController.getVideos as RequestHandler);
router.get('/featured', videoController.getFeaturedVideos as RequestHandler);
router.get('/slug/:slug', videoController.getVideoBySlug as RequestHandler);
router.get('/:id', videoController.getVideoById as RequestHandler);
router.get('/:id/related', videoController.getRelatedVideos as RequestHandler);
router.post('/:id/view', videoController.incrementViewCount as RequestHandler);

// Protected Routes
router.post('/', videoController.createVideo as RequestHandler);
router.put('/:id', videoController.updateVideo as RequestHandler);
router.delete('/:id', videoController.deleteVideo as RequestHandler);
router.put('/:id/engagement', videoController.updateEngagementMetrics as RequestHandler);

export default router;
