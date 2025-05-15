import express from 'express';
import { check } from 'express-validator';
import mediaController from '../controllers/media.controller.js';
import { authMiddleware, roleAuthorization } from '../middlewares/auth.middleware.js';
import { MediaType, VideoProvider } from '../interfaces/media.interfaces.js';
import { ContentStatus } from '../interfaces/content.interfaces.js';
const router = express.Router();
/**
 * @route GET /api/media
 * @desc Get all media with pagination and filtering
 * @access Public
 */
router.get('/', mediaController.getAllMedia);
/**
 * @route POST /api/media
 * @desc Create a new media item
 * @access Private (Content Manager, Admin)
 */
router.post('/', authMiddleware, roleAuthorization(['admin', 'content_manager']), [
    check('title', 'Title is required').notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('type', `Type must be one of: ${Object.values(MediaType).join(', ')}`).isIn(Object.values(MediaType)),
    check('url', 'URL is required').notEmpty(),
    check('category', 'Category is required').notEmpty(),
], mediaController.createMedia);
/**
 * @route GET /api/media/:mediaId
 * @desc Get media by ID
 * @access Public
 */
router.get('/:mediaId', mediaController.getMediaById);
/**
 * @route GET /api/media/slug/:slug
 * @desc Get media by slug
 * @access Public
 */
router.get('/slug/:slug', mediaController.getMediaBySlug);
/**
 * @route PUT /api/media/:mediaId
 * @desc Update media
 * @access Private (Content Manager, Admin)
 */
router.put('/:mediaId', authMiddleware, roleAuthorization(['admin', 'content_manager']), [
    check('title', 'Title must not be empty if provided').optional().notEmpty(),
    check('description', 'Description must not be empty if provided').optional().notEmpty(),
    check('type', `Type must be one of: ${Object.values(MediaType).join(', ')} if provided`).optional().isIn(Object.values(MediaType)),
    check('url', 'URL must not be empty if provided').optional().notEmpty(),
    check('category', 'Category must not be empty if provided').optional().notEmpty(),
    check('videoProvider', `Video provider must be one of: ${Object.values(VideoProvider).join(', ')} if provided`).optional().isIn(Object.values(VideoProvider)),
], mediaController.updateMedia);
/**
 * @route DELETE /api/media/:mediaId
 * @desc Delete media
 * @access Private (Content Manager, Admin)
 */
router.delete('/:mediaId', authMiddleware, roleAuthorization(['admin', 'content_manager']), mediaController.deleteMedia);
/**
 * @route PATCH /api/media/:mediaId/status
 * @desc Update media status
 * @access Private (Content Manager, Admin)
 */
router.patch('/:mediaId/status', authMiddleware, roleAuthorization(['admin', 'content_manager']), [
    check('status', `Status must be one of: ${Object.values(ContentStatus).join(', ')}`).isIn(Object.values(ContentStatus)),
], mediaController.updateMediaStatus);
/**
 * @route POST /api/media/:mediaId/download
 * @desc Track media download
 * @access Public
 */
router.post('/:mediaId/download', mediaController.trackDownload);
/**
 * @route GET /api/media/type/:type
 * @desc Get media by type
 * @access Public
 */
router.get('/type/:type', mediaController.getMediaByType);
export default router;
