import { Request, Response, NextFunction } from 'express';
import * as contentService from '../services/content.service';
import { createServiceLogger } from '../utils/sharedLogger';
import { 
  ContentDocument, 
  ContentFilter, 
  ContentPaginationResult,
  CategoryDocument
} from '../interfaces/shared-types';
import { Content, ContentStatus, ContentType } from '@corp-astro/shared-types';

// Initialize logger
const logger = createServiceLogger('content-controller');

/**
 * Content management controller
 */
class ContentController {
  /**
   * Create new content
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async createContent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const contentData = req.body;
      const { user } = req;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      logger.info('Creating new content', { 
        userId: user.userId,
        contentTitle: contentData.title 
      });

      // Validate required fields
      const requiredFields = ['title', 'description', 'body', 'category'];
      const missingFields = requiredFields.filter(field => !contentData[field]);
      
      if (missingFields.length > 0) {
        logger.warn('Missing required fields', { 
          missingFields,
          userId: user.userId 
        });
        
        return res.status(400).json({
          success: false,
          message: 'Required fields missing',
          missingFields,
        });
      }

      const content = await contentService.createContent(contentData, user);
      
      logger.info('Content created successfully', { 
        contentId: content._id,
        title: content.title,
        userId: user.userId
      });
      
      return res.status(201).json({
        success: true,
        message: 'Content created successfully',
        data: content,
      });
    } catch (error) {
      logger.error('Error in createContent controller', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.userId
      });
      return next(error);
    }
  }

  /**
   * Get all content with pagination and filtering
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async getAllContent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';
      const search = req.query.search as string;
      const category = req.query.category as string;
      const tag = req.query.tag as string;
      const status = req.query.status as string;
      const author = req.query.author as string;

      logger.info('Fetching all content', {
        query: { page, limit, sortBy, sortOrder, search, category, tag, status, author },
        userId: req.user?.userId || 'anonymous'
      });

      // Build filters
      const filters: ContentFilter = {};
      if (search) filters.$text = { $search: search };
      if (category) filters.category = category;
      if (tag) filters.tags = tag;
      if (status) filters.status = status;
      if (author) filters['author.id'] = author;

      const result = await contentService.getAllContent(
        filters,
        page,
        limit,
        sortBy,
        sortOrder
      );

      logger.info('Successfully fetched content', {
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        itemsPerPage: result.itemsPerPage
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching content', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        query: req.query,
        userId: req.user?.userId || 'anonymous'
      });
      return next(error);
    }
  }

  /**
   * Get content by ID
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async getContentById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { contentId } = req.params;

      logger.info('Fetching content by ID', { contentId });

      const content = await contentService.getContentById(contentId);

      logger.info('Content found', { contentId });

      return res.status(200).json({
        success: true,
        message: 'Content retrieved successfully',
        data: content,
      });
    } catch (error) {
      logger.error('Error fetching content by ID', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        contentId: req.params.contentId
      });

      if ((error as Error).message === 'Content not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message,
        });
      }

      return next(error);
    }
  }

  /**
   * Get content by slug
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async getContentBySlug(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { slug } = req.params;

      logger.info('Fetching content by slug', { slug });

      const content = await contentService.getContentBySlug(slug);

      logger.info('Content found by slug', { slug });

      return res.status(200).json({
        success: true,
        message: 'Content retrieved successfully',
        data: content,
      });
    } catch (error) {
      logger.error('Error fetching content by slug', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        slug: req.params.slug
      });

      if ((error as Error).message === 'Content not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message,
        });
      }

      return next(error);
    }
  }

  /**
   * Update content
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async updateContent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { contentId } = req.params;
      const updateData = req.body;
      const { user } = req;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      logger.info('Updating content', { 
        contentId,
        userId: user.userId,
        updateFields: Object.keys(updateData)
      });

      const content = await contentService.updateContent(contentId, updateData, user);

      logger.info('Content updated successfully', { 
        contentId,
        userId: user.userId
      });

      return res.status(200).json({
        success: true,
        message: 'Content updated successfully',
        data: content,
      });
    } catch (error) {
      logger.error('Error updating content', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        contentId: req.params.contentId,
        userId: req.user?.userId
      });

      if ((error as Error).message === 'Content not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message,
        });
      }

      return next(error);
    }
  }

  /**
   * Delete content
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async deleteContent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { contentId } = req.params;
      const { user } = req;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      logger.info('Deleting content', { 
        contentId,
        userId: user.userId
      });

      await contentService.deleteContent(contentId, user);

      logger.info('Content deleted successfully', { 
        contentId,
        userId: user.userId
      });

      return res.status(200).json({
        success: true,
        message: 'Content deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting content', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        contentId: req.params.contentId,
        userId: req.user?.userId
      });

      if ((error as Error).message === 'Content not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message,
        });
      }

      return next(error);
    }
  }

  /**
   * Update content status
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async updateContentStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { contentId } = req.params;
      const { status } = req.body;
      const { user } = req;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      logger.info('Updating content status', { 
        contentId,
        status,
        userId: user.userId
      });

      const content = await contentService.updateContentStatus(contentId, status, user);

      logger.info('Content status updated successfully', { 
        contentId,
        status,
        userId: user.userId
      });

      return res.status(200).json({
        success: true,
        message: 'Content status updated successfully',
        data: content,
      });
    } catch (error) {
      logger.error('Error updating content status', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        contentId: req.params.contentId,
        userId: req.user?.userId
      });

      if ((error as Error).message === 'Content not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message,
        });
      }

      return next(error);
    }
  }

  /**
   * Get all categories
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async getAllCategories(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      logger.info('Fetching all categories');

      const categories = await contentService.getAllCategories();

      logger.info('Categories fetched successfully', { count: categories.length });

      return res.status(200).json({
        success: true,
        message: 'Categories fetched successfully',
        data: categories,
      });
    } catch (error) {
      logger.error('Error fetching categories', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      return next(error);
    }
  }

  /**
   * Create category
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async createCategory(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const categoryData = req.body;
      const { user } = req;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Validate required fields
      if (!categoryData.name) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required',
        });
      }

      logger.info('Creating new category', { 
        categoryName: categoryData.name,
        userId: user.userId
      });

      const category = await contentService.createCategory(categoryData);

      logger.info('Category created successfully', { 
        categoryId: category._id,
        categoryName: category.name,
        userId: user.userId
      });

      return res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category,
      });
    } catch (error) {
      logger.error('Error creating category', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.userId
      });
      return next(error);
    }
  }
}

// Export controller instance
export const { 
  createContent, 
  getAllContent, 
  getContentById, 
  getContentBySlug, 
  updateContent, 
  deleteContent, 
  updateContentStatus,
  getAllCategories,
  createCategory
} = new ContentController();
