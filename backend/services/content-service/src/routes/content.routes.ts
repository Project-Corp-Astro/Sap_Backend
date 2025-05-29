import express, { Router, RequestHandler } from 'express';
import { authMiddleware, roleAuthorization } from '../middlewares/auth.middleware';
import * as contentController from '../controllers/content.controller';

const router: Router = express.Router();

/**
 * @route GET /api/content
 * @desc Get all content with pagination and filtering
 * @access Public
 */
router.get('/', contentController.getAllContent as RequestHandler);

/**
 * @route POST /api/content
 * @desc Create new content
 * @access Private (Admin, Content Manager)
 */
router.post(
  '/',
  authMiddleware as RequestHandler,
  roleAuthorization(['admin', 'content_manager']) as RequestHandler,
  contentController.createContent as RequestHandler,
);

/**
 * @route GET /api/content/articles
 * @desc Get all articles
 * @access Public
 */
router.get('/articles', contentController.getArticles as RequestHandler);

/**
 * @route GET /api/content/categories
 * @desc Get all categories
 * @access Public
 */
router.get('/categories', contentController.getAllCategories as RequestHandler);

/**
 * @route GET /api/content/slug/:slug
 * @desc Get content by slug
 * @access Public
 */
router.get('/slug/:slug', contentController.getContentBySlug as RequestHandler);

/**
 * @route GET /api/content/:contentId
 * @desc Get content by ID
 * @access Public
 */
router.get('/:contentId', contentController.getContentById as RequestHandler);

/**
 * @route PUT /api/content/:contentId
 * @desc Update content
 * @access Private (Admin, Content Manager)
 */
router.put(
  '/:contentId',
  authMiddleware as RequestHandler,
  roleAuthorization(['admin', 'content_manager']) as RequestHandler,
  contentController.updateContent as RequestHandler,
);

/**
 * @route DELETE /api/content/:contentId
 * @desc Delete content
 * @access Private (Admin, Content Manager)
 */
router.delete(
  '/:contentId',
  authMiddleware as RequestHandler,
  roleAuthorization(['admin', 'content_manager']) as RequestHandler,
  contentController.deleteContent as RequestHandler,
);

/**
 * @route PATCH /api/content/:contentId/status
 * @desc Update content status
 * @access Private (Admin, Content Manager)
 */
router.patch(
  '/:contentId/status',
  authMiddleware as RequestHandler,
  roleAuthorization(['admin', 'content_manager']) as RequestHandler,
  contentController.updateContentStatus as RequestHandler,
);

/**
 * @route POST /api/content/categories
 * @desc Create category
 * @access Private (Admin, Content Manager)
 */
router.post(
  '/categories',
  authMiddleware as RequestHandler,
  roleAuthorization(['admin', 'content_manager']) as RequestHandler,
  contentController.createCategory as RequestHandler,
);

export default router;
