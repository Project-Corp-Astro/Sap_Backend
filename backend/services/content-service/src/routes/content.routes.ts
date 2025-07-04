import express, { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import * as contentController from '../controllers/content.controller';
import { requirePermission } from '../../../../src/middleware/requirePermission';

const router: Router = express.Router();

router.use(authMiddleware as RequestHandler);
/**
 * @route GET /api/content
 * @desc Get all content with pagination and filtering
 * @access Private (super_admin, content_manager)
 */
router.get('/', 
  requirePermission('content:read', { application: 'cms' }),
  contentController.getAllContent as RequestHandler);

/**
 * @route POST /api/content
 * @desc Create new content
 * @access Private (Admin, Content Manager)
 */
router.post(
  '/',
  requirePermission('content:create', { application: 'cms' }),
  contentController.createContent as RequestHandler,
);

/**
 * @route GET /api/content/articles
 * @desc Get all articles
 * @access Public
 */
router.get('/articles', 
  requirePermission('content:read', { application: 'cms' }),
  contentController.getArticles as RequestHandler);

/**
 * @route GET /api/content/categories
 * @desc Get all categories
 * @access Public
 */
router.get('/categories',
  requirePermission('content:read', { application: 'cms' }),
  contentController.getAllCategories as RequestHandler);

/**
 * @route GET /api/content/slug/:slug
 * @desc Get content by slug
 * @access Public
 */
router.get('/slug/:slug', 
  requirePermission('content:read', { application: 'cms' }),
  contentController.getContentBySlug as RequestHandler);

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
  requirePermission('content:update', { application: 'cms' }),
  contentController.updateContent as RequestHandler,
);

/**
 * @route DELETE /api/content/:contentId
 * @desc Delete content
 * @access Private (Admin, Content Manager)
 */
router.delete(
  '/:contentId',
  requirePermission('content:delete', { application: 'cms' }),
  contentController.deleteContent as RequestHandler,
);

/**
 * @route PATCH /api/content/:contentId/status
 * @desc Update content status
 * @access Private (Admin, Content Manager)
 */
router.patch(
  '/:contentId/status',
  requirePermission('content:update', { application: 'cms' }),
  contentController.updateContentStatus as RequestHandler,
);

/**
 * @route POST /api/content/categories
 * @desc Create category
 * @access Private (Admin, Content Manager)
 */
router.post(
  '/categories',
  requirePermission('content:create', { application: 'cms' }),
  contentController.createCategory as RequestHandler,
);

export default router;
