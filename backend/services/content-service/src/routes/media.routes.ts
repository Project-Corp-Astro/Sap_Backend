import express, { Router, RequestHandler } from 'express';
import { check } from 'express-validator';
import mediaController from '../controllers/media.controller';
import { authMiddleware, roleAuthorization } from '../middlewares/auth.middleware';
import { MediaType, VideoProvider } from '../interfaces/media.interfaces';
import { ContentStatus } from '../interfaces/content.interfaces';

const router: Router = express.Router();

/**
 * @route GET /api/media
 * @desc Get all media with pagination and filtering
 * @access Public
 */
router.get('/', mediaController.getAllMedia as RequestHandler);

/**
 * @route POST /api/media
 * @desc Create a new media item
 * @access Private (Content Manager, Admin)
 */
router.post('/', 
  authMiddleware as RequestHandler, 
  roleAuthorization(['admin', 'content_manager']) as RequestHandler, 
  [
    check('title', 'Title is required').notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('type', `Type must be one of: ${Object.values(MediaType).join(', ')}`).isIn(Object.values(MediaType)),
    check('url', 'URL is required').notEmpty(),
    check('category', 'Category is required').notEmpty(),
  ],
  mediaController.createMedia as RequestHandler
);

/**
 * @route GET /api/media/:mediaId
 * @desc Get media by ID
 * @access Public
 */
router.get('/:mediaId', mediaController.getMediaById as RequestHandler);

/**
 * @route GET /api/media/slug/:slug
 * @desc Get media by slug
 * @access Public
 */
router.get('/slug/:slug', mediaController.getMediaBySlug as RequestHandler);

/**
 * @route PUT /api/media/:mediaId
 * @desc Update media
 * @access Private (Content Manager, Admin)
 */
router.put('/:mediaId', 
  authMiddleware as RequestHandler, 
  roleAuthorization(['admin', 'content_manager']) as RequestHandler, 
  [
    check('title', 'Title must not be empty if provided').optional().notEmpty(),
    check('description', 'Description must not be empty if provided').optional().notEmpty(),
    check('type', `Type must be one of: ${Object.values(MediaType).join(', ')} if provided`).optional().isIn(Object.values(MediaType)),
    check('url', 'URL must not be empty if provided').optional().notEmpty(),
    check('category', 'Category must not be empty if provided').optional().notEmpty(),
    check('videoProvider', `Video provider must be one of: ${Object.values(VideoProvider).join(', ')} if provided`).optional().isIn(Object.values(VideoProvider)),
  ],
  mediaController.updateMedia as RequestHandler
);

/**
 * @route DELETE /api/media/:mediaId
 * @desc Delete media
 * @access Private (Content Manager, Admin)
 */
router.delete('/:mediaId', 
  authMiddleware as RequestHandler, 
  roleAuthorization(['admin', 'content_manager']) as RequestHandler, 
  mediaController.deleteMedia as RequestHandler
);

/**
 * @route PATCH /api/media/:mediaId/status
 * @desc Update media status
 * @access Private (Content Manager, Admin)
 */
router.patch('/:mediaId/status', 
  authMiddleware as RequestHandler, 
  roleAuthorization(['admin', 'content_manager']) as RequestHandler, 
  [
    check('status', `Status must be one of: ${Object.values(ContentStatus).join(', ')}`).isIn(Object.values(ContentStatus)),
  ],
  mediaController.updateMediaStatus as RequestHandler
);

/**
 * @route POST /api/media/:mediaId/download
 * @desc Track media download
 * @access Public
 */
router.post('/:mediaId/download', mediaController.trackDownload as RequestHandler);

/**
 * @route GET /api/media/type/:type
 * @desc Get media by type
 * @access Public
 */
router.get('/type/:type', mediaController.getMediaByType as RequestHandler);

export default router;
