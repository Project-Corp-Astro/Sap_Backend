import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import mediaService from '../services/media.service.js';
import { ContentStatus } from '../interfaces/content.interfaces.js';
import { MediaType } from '../interfaces/media.interfaces.js';
import { ValidationError } from '../utils/errorTypes.js';

// Initialize logger
const logger = {
  info: (...args: any[]) => console.info('[Media Controller]', ...args),
  error: (...args: any[]) => console.error('[Media Controller]', ...args),
  warn: (...args: any[]) => console.warn('[Media Controller]', ...args),
  debug: (...args: any[]) => console.debug('[Media Controller]', ...args),
};

// Extend the Express Request interface to include user with name
declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      role: string;
      name?: string;
    }
  }
}

/**
 * Media controller
 */
class MediaController {
  /**
   * Create a new media item
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async createMedia(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation error', errors.array());
      }
      
      const mediaData = req.body;
      
      // Add author information from authenticated user
      if (req.user) {
        mediaData.author = {
          id: req.user.userId,
          // Use type assertion to handle optional name property
          name: (req.user as any).name || req.user.email.split('@')[0] || 'Unknown',
          email: req.user.email
        };
      }
      
      const media = await mediaService.createMedia(mediaData);
      
      return res.status(201).json({
        success: true,
        message: 'Media created successfully',
        data: media
      });
    } catch (error) {
      // Log error and pass to error handler middleware
      logger.error('Error creating media:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  /**
   * Get all media with pagination and filtering
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async getAllMedia(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        type,
        category,
        tags,
        status,
        author,
        createdAfter,
        createdBefore
      } = req.query;
      
      // Build filters
      const filters: Record<string, any> = {};
      if (search) filters.search = search;
      if (type) filters.type = type;
      if (category) filters.category = category;
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];
      if (status) filters.status = status;
      if (author) filters.author = author;
      if (createdAfter) filters.createdAfter = createdAfter;
      if (createdBefore) filters.createdBefore = createdBefore;
      
      const result = await mediaService.getAllMedia(
        filters,
        parseInt(page as string),
        parseInt(limit as string),
        sortBy as string,
        sortOrder as string
      );
      
      return res.status(200).json({
        success: true,
        message: 'Media retrieved successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error getting all media:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  /**
   * Get media by ID
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async getMediaById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { mediaId } = req.params;
      
      const media = await mediaService.getMediaById(mediaId);
      
      // Increment view count for published media
      if (media.status === ContentStatus.PUBLISHED) {
        await mediaService.incrementViewCount(mediaId);
      }
      
      return res.status(200).json({
        success: true,
        message: 'Media retrieved successfully',
        data: media
      });
    } catch (error) {
      // Log error and pass to error handler middleware
      logger.error('Error in media operation:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  /**
   * Get media by slug
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async getMediaBySlug(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { slug } = req.params;
      
      const media = await mediaService.getMediaBySlug(slug);
      
      // Increment view count for published media
      if (media.status === ContentStatus.PUBLISHED) {
        await mediaService.incrementViewCount(media._id);
      }
      
      return res.status(200).json({
        success: true,
        message: 'Media retrieved successfully',
        data: media
      });
    } catch (error) {
      // Log error and pass to error handler middleware
      logger.error('Error in media operation:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  /**
   * Update media
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async updateMedia(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation error', errors.array());
      }
      
      const { mediaId } = req.params;
      const updateData = req.body;
      
      // Add author information
      const author = {
        userId: req.user.userId,
        email: req.user.email,
        // Use email username as fallback for name
        name: (req.user as any).name || req.user.email.split('@')[0] || 'Unknown',
      };
      
      const media = await mediaService.updateMedia(mediaId, updateData);
      
      return res.status(200).json({
        success: true,
        message: 'Media updated successfully',
        data: media
      });
    } catch (error) {
      // Log error and pass to error handler middleware
      logger.error('Error updating media:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  /**
   * Delete media
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async deleteMedia(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { mediaId } = req.params;
      
      await mediaService.deleteMedia(mediaId);
      
      return res.status(200).json({
        success: true,
        message: 'Media deleted successfully'
      });
    } catch (error) {
      // Log error and pass to error handler middleware
      logger.error('Error deleting media:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  /**
   * Update media status
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async updateMediaStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { mediaId } = req.params;
      const { status } = req.body;
      
      if (!Object.values(ContentStatus).includes(status as ContentStatus)) {
        throw new ValidationError('Invalid status value');
      }
      
      const media = await mediaService.updateMediaStatus(mediaId, status as ContentStatus);
      
      return res.status(200).json({
        success: true,
        message: 'Media status updated successfully',
        data: media
      });
    } catch (error) {
      // Log error and pass to error handler middleware
      logger.error('Error updating media status:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  /**
   * Track media download
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async trackDownload(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { mediaId } = req.params;
      
      const downloadCount = await mediaService.incrementDownloadCount(mediaId);
      
      return res.status(200).json({
        success: true,
        message: 'Download tracked successfully',
        data: { downloadCount }
      });
    } catch (error) {
      // Log error and pass to error handler middleware
      logger.error('Error tracking download:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  /**
   * Get media by type
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  async getMediaByType(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { type } = req.params;
      const { limit = 10 } = req.query;
      
      if (!Object.values(MediaType).includes(type as MediaType)) {
        throw new ValidationError('Invalid media type');
      }
      
      const media = await mediaService.getMediaByType(
        type as MediaType,
        parseInt(limit as string)
      );
      
      return res.status(200).json({
        success: true,
        message: 'Media retrieved successfully',
        data: media
      });
    } catch (error) {
      // Log error and pass to error handler middleware
      logger.error('Error getting media by type:', { error: (error as Error).message });
      return next(error);
    }
  }
}

export default new MediaController();
