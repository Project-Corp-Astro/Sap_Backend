import { Router } from 'express';
import videoController from '../controllers/video.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Public routes
router.get('/', videoController.getVideos);
router.get('/featured', videoController.getFeaturedVideos);
router.get('/slug/:slug', videoController.getVideoBySlug);
router.get('/:id', videoController.getVideoById);
router.get('/:id/related', videoController.getRelatedVideos);
router.post('/:id/view', videoController.incrementViewCount);

// Protected routes - require authentication
router.post('/', authMiddleware, videoController.createVideo);
router.put('/:id', authMiddleware, videoController.updateVideo);
router.delete('/:id', authMiddleware, videoController.deleteVideo);
router.put('/:id/engagement', authMiddleware, videoController.updateEngagementMetrics);

export default router;
