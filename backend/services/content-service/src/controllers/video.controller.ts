// video.controller.ts - Fully integrated with video.service using Redis and Elasticsearch

import { Request, Response, NextFunction } from 'express';
import videoService from '../services/video.service';
import {
  CreateVideoInput,
  UpdateVideoInput,
  VideoFilterOptions,
  VideoPaginationOptions
} from '../interfaces/video.interfaces';

class VideoController {
  async createVideo(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const videoData: CreateVideoInput = req.body;

      if (!videoData.title || !videoData.description || !videoData.url) {
        return res.status(400).json({ success: false, message: 'Title, description, and URL are required', error: 'ValidationError' });
      }

      const user = req.user as { firstName: string; userId: string; email: string; role: string };
      videoData.author = {
        id: user.userId,
        name: 'goutham',
        email: user.email
      };

      const video = await videoService.createVideo(videoData);
      return res.status(201).json({ success: true, message: 'Video created', data: video });
    } catch (error) {
      console.error('Error creating video:', error);
      if (error instanceof Error && error.message.includes('Validation Error')) {
        return res.status(400).json({ success: false, message: error.message, error: 'ValidationError' });
      }
      next(error);
    }
  }

  async getVideos(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const filterOptions: VideoFilterOptions = {};
      const paginationOptions: VideoPaginationOptions = {};

      if (req.query.category) filterOptions.category = req.query.category as string;
      if (req.query.tags) filterOptions.tags = (req.query.tags as string).split(',');
      if (req.query.status) filterOptions.status = req.query.status as any;
      if (req.query.author) filterOptions.author = req.query.author as string;
      if (req.query.isPrivate !== undefined) filterOptions.isPrivate = req.query.isPrivate === 'true';
      if (req.query.videoProvider) filterOptions.videoProvider = req.query.videoProvider as any;
      if (req.query.startDate) filterOptions.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filterOptions.endDate = new Date(req.query.endDate as string);
      if (req.query.search) filterOptions.search = req.query.search as string;

      if (req.query.page) paginationOptions.page = parseInt(req.query.page as string, 10);
      if (req.query.limit) paginationOptions.limit = parseInt(req.query.limit as string, 10);
      if (req.query.sortField && req.query.sortOrder) {
        paginationOptions.sort = {
          field: req.query.sortField as string,
          order: req.query.sortOrder as 'asc' | 'desc'
        };
      }

      const result = await videoService.getVideos(filterOptions, paginationOptions);
      return res.status(200).json({ success: true, message: 'Videos retrieved', ...result });
    } catch (error) {
      console.error('Error getting videos:', error);
      next(error);
    }
  }

  async getVideoById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const video = await videoService.getVideoById(req.params.id);
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
      return res.status(200).json({ success: true, message: 'Video retrieved', data: video });
    } catch (error) {
      next(error);
    }
  }

  async getVideoBySlug(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const video = await videoService.getVideoBySlug(req.params.slug);
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
      return res.status(200).json({ success: true, message: 'Video retrieved', data: video });
    } catch (error) {
      next(error);
    }
  }

  async updateVideo(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const video = await videoService.updateVideo(req.params.id, req.body);
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
      return res.status(200).json({ success: true, message: 'Video updated', data: video });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation Error')) {
        return res.status(400).json({ success: false, message: error.message, error: 'ValidationError' });
      }
      next(error);
    }
  }

  async deleteVideo(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const video = await videoService.deleteVideo(req.params.id);
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
      return res.status(200).json({ success: true, message: 'Video deleted', data: { id: req.params.id } });
    } catch (error) {
      next(error);
    }
  }

  async incrementViewCount(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const video = await videoService.incrementViewCount(req.params.id);
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
      return res.status(200).json({ success: true, message: 'View count updated', data: { id: req.params.id, viewCount: video.viewCount } });
    } catch (error) {
      next(error);
    }
  }

  async updateEngagementMetrics(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const video = await videoService.updateEngagementMetrics(req.params.id, req.body);
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
      return res.status(200).json({
        success: true,
        message: 'Engagement updated',
        data: {
          id: req.params.id,
          likeCount: video.likeCount,
          dislikeCount: video.dislikeCount,
          commentCount: video.commentCount,
          shareCount: video.shareCount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getFeaturedVideos(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
      const videos = await videoService.getFeaturedVideos(limit);
      return res.status(200).json({ success: true, message: 'Featured videos', data: videos });
    } catch (error) {
      next(error);
    }
  }

  async getRelatedVideos(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
      const videos = await videoService.getRelatedVideos(req.params.id, limit);
      return res.status(200).json({ success: true, message: 'Related videos', data: videos });
    } catch (error) {
      next(error);
    }
  }
}

export default new VideoController();
