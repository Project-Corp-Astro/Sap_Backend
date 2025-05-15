import express, { Router } from 'express';
import { authMiddleware, roleAuthorization } from '../middlewares/auth.middleware.js';
import * as contentController from '../controllers/content.controller.js';

const router: Router = express.Router();

/**
 * @route GET /api/content
 * @desc Get all content with pagination and filtering
 * @access Public
 */
router.get('/', contentController.getAllContent);

/**
 * @route POST /api/content
 * @desc Create new content
 * @access Private (Admin, Content Manager)
 */
router.post(
  '/',
  authMiddleware,
  roleAuthorization(['admin', 'content_manager']),
  contentController.createContent,
);

/**
 * @route GET /api/content/:contentId
 * @desc Get content by ID
 * @access Public
 */
router.get('/:contentId', contentController.getContentById);

/**
 * @route GET /api/content/slug/:slug
 * @desc Get content by slug
 * @access Public
 */
router.get('/slug/:slug', contentController.getContentBySlug);

/**
 * @route PUT /api/content/:contentId
 * @desc Update content
 * @access Private (Admin, Content Manager)
 */
router.put(
  '/:contentId',
  authMiddleware,
  roleAuthorization(['admin', 'content_manager']),
  contentController.updateContent,
);

/**
 * @route DELETE /api/content/:contentId
 * @desc Delete content
 * @access Private (Admin, Content Manager)
 */
router.delete(
  '/:contentId',
  authMiddleware,
  roleAuthorization(['admin', 'content_manager']),
  contentController.deleteContent,
);

/**
 * @route PATCH /api/content/:contentId/status
 * @desc Update content status
 * @access Private (Admin, Content Manager)
 */
router.patch(
  '/:contentId/status',
  authMiddleware,
  roleAuthorization(['admin', 'content_manager']),
  contentController.updateContentStatus,
);

/**
 * @route GET /api/content/categories
 * @desc Get all categories
 * @access Public
 */
router.get('/categories', contentController.getAllCategories);

/**
 * @route POST /api/content/categories
 * @desc Create category
 * @access Private (Admin, Content Manager)
 */
router.post(
  '/categories',
  authMiddleware,
  roleAuthorization(['admin', 'content_manager']),
  contentController.createCategory,
);

export default router;
