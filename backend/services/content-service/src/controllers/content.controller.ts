// content.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as contentService from '../services/content.service';
import { createServiceLogger } from '../utils/sharedLogger';
import { ContentStatus, ContentType } from '@corp-astro/shared-types';
import { RequestUser } from '../interfaces/shared-types';

const logger = createServiceLogger('content-controller');

class ContentController {
  async createContent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const contentData = req.body;
      const user = req.user as RequestUser;

      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const requiredFields = ['title', 'description', 'body', 'category'];
      const missingFields = requiredFields.filter(field => !contentData[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Required fields missing', 
          missingFields 
        });
      }

      const content = await contentService.createContent(contentData, user);
      return res.status(201).json({ 
        success: true, 
        message: 'Content created successfully', 
        data: content 
      });
    } catch (error) {
      logger.error('Error in createContent', { error: (error as Error).message });
      return next(error);
    }
  }

  async getAllContent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { page = '1', limit = '10', sortBy = 'createdAt', sortOrder = 'desc', search, category, tag, status, author } = req.query;
      const filters: any = {};
      if (category) filters.category = category;
      if (tag) filters.tags = tag;
      if (status) filters.status = status;
      if (author) filters['author.id'] = author;

      const result = await contentService.getAllContent(
        filters,
        parseInt(page as string),
        parseInt(limit as string),
        sortBy as string,
        sortOrder as string
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Error in getAllContent', { error: (error as Error).message });
      return next(error);
    }
  }

  async getContentById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { contentId } = req.params;
      const content = await contentService.getContentById(contentId);
      return res.status(200).json({ success: true, data: content });
    } catch (error) {
      logger.error('Error in getContentById', { error: (error as Error).message });
      return next(error);
    }
  }

  async getContentBySlug(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { slug } = req.params;
      const content = await contentService.getContentBySlug(slug);
      return res.status(200).json({ success: true, data: content });
    } catch (error) {
      logger.error('Error in getContentBySlug', { error: (error as Error).message });
      return next(error);
    }
  }

  async updateContent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { contentId } = req.params;
      const user = req.user as RequestUser;
      const updateData = req.body;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const updated = await contentService.updateContent(contentId, updateData, user);
      return res.status(200).json({ 
        success: true, 
        message: 'Content updated successfully', 
        data: updated 
      });
    } catch (error) {
      logger.error('Error in updateContent', { error: (error as Error).message });
      return next(error);
    }
  }

  async deleteContent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { contentId } = req.params;
      const user = req.user as RequestUser;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      await contentService.deleteContent(contentId, user);
      return res.status(200).json({ 
        success: true, 
        message: 'Content deleted successfully' 
      });
    } catch (error) {
      logger.error('Error in deleteContent', { error: (error as Error).message });
      return next(error);
    }
  }

  async updateContentStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { contentId } = req.params;
      const { status } = req.body;
      const { user } = req;
      const updated = await contentService.updateContentStatus(contentId, status, user);
      return res.status(200).json({ success: true, message: 'Status updated', data: updated });
    } catch (error) {
      logger.error('Error in updateContentStatus', { error: (error as Error).message });
      return next(error);
    }
  }

  async incrementViewCount(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { contentId } = req.params;
      const viewCount = await contentService.incrementViewCount(contentId);
      return res.status(200).json({ success: true, viewCount });
    } catch (error) {
      logger.error('Error in incrementViewCount', { error: (error as Error).message });
      return next(error);
    }
  }

  async getAllCategories(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const categories = await contentService.getAllCategories();
      return res.status(200).json({ success: true, data: categories });
    } catch (error) {
      logger.error('Error in getAllCategories', { error: (error as Error).message });
      return next(error);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { user } = req;
      const categoryData = req.body;
      const category = await contentService.createCategory(categoryData);
      return res.status(201).json({ success: true, data: category });
    } catch (error) {
      logger.error('Error in createCategory', { error: (error as Error).message });
      return next(error);
    }
  }

  async getArticles(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const result = await contentService.getAllContent({
        contentType: ContentType.ARTICLE,
        status: ContentStatus.PUBLISHED
      }, 1, 10);
      return res.status(200).json({ success: true, data: result.items });
    } catch (error) {
      logger.error('Error in getArticles', { error: (error as Error).message });
      return next(error);
    }
  }

  async searchContent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const query = req.query.q as string;
      if (!query) return res.status(400).json({ success: false, message: 'Search query is required' });
      const results = await contentService.searchContent(query);
      return res.status(200).json({ success: true, data: results });
    } catch (error) {
      logger.error('Error in searchContent', { error: (error as Error).message });
      return next(error);
    }
  }
}

export const {
  createContent,
  getAllContent,
  getContentById,
  getContentBySlug,
  updateContent,
  deleteContent,
  updateContentStatus,
  incrementViewCount,
  getAllCategories,
  createCategory,
  getArticles,
  searchContent
} = new ContentController();
