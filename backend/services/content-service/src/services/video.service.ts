import Video from '../models/Video.js';
import { 
  VideoDocument, 
  CreateVideoInput, 
  UpdateVideoInput, 
  VideoFilterOptions, 
  VideoPaginationOptions 
} from '../interfaces/video.interfaces.js';
import { Error } from 'mongoose';
import { cacheService } from '../utils/cache.js';
// Import slugify directly using ESM import with type assertion
import slugifyPkg from 'slugify';
// Handle both ESM and CommonJS module formats
const slugify = (typeof slugifyPkg === 'function') ? slugifyPkg : (slugifyPkg as any).default;

/**
 * Video Service - Handles all video-related operations
 */
class VideoService {
  /**
   * Create a new video
   * @param videoData Video data to create
   * @returns Created video document
   */
  async createVideo(videoData: CreateVideoInput): Promise<VideoDocument> {
    try {
      // Generate slug from title
      const slug = slugify(videoData.title, { lower: true, strict: true });
      
      // Check if slug already exists
      const existingVideo = await Video.findOne({ slug });
      if (existingVideo) {
        // Append a random string to make the slug unique
        const uniqueSuffix = Math.random().toString(36).substring(2, 7);
        videoData = { ...videoData, slug: `${slug}-${uniqueSuffix}` };
      }
      
      // Set default values
      const newVideoData = {
        ...videoData,
        viewCount: 0,
        likeCount: 0,
        dislikeCount: 0,
        commentCount: 0,
        shareCount: 0,
        isPrivate: videoData.isPrivate !== undefined ? videoData.isPrivate : false,
        isDownloadable: videoData.isDownloadable !== undefined ? videoData.isDownloadable : false,
        isEmbeddable: videoData.isEmbeddable !== undefined ? videoData.isEmbeddable : true,
        status: videoData.status || 'draft'
      };
      
      // Create new video
      const video = new Video(newVideoData);
      await video.save();
      
      // Invalidate featured videos cache if this is a published video
      if (video.status === 'published' && !video.isPrivate) {
        cacheService.delete(`video:featured:limit:5`);
      }
      
      return video;
    } catch (error) {
      if (error instanceof Error.ValidationError) {
        throw new Error(`Validation Error: ${error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Get all videos with filtering and pagination
   * @param filterOptions Filter options
   * @param paginationOptions Pagination options
   * @returns Videos and pagination metadata
   */
  async getVideos(
    filterOptions: VideoFilterOptions = {},
    paginationOptions: VideoPaginationOptions = {}
  ): Promise<{
    videos: VideoDocument[];
    totalVideos: number;
    totalPages: number;
    currentPage: number;
    videosPerPage: number;
  }> {
    try {
      // Default pagination values
      const page = paginationOptions.page || 1;
      const limit = paginationOptions.limit || 10;
      const skip = (page - 1) * limit;
      
      // Build filter query
      const filterQuery: any = {};
      
      if (filterOptions.category) {
        filterQuery.category = filterOptions.category;
      }
      
      if (filterOptions.tags && filterOptions.tags.length > 0) {
        filterQuery.tags = { $in: filterOptions.tags };
      }
      
      if (filterOptions.status) {
        filterQuery.status = filterOptions.status;
      }
      
      if (filterOptions.author) {
        filterQuery['author.id'] = filterOptions.author;
      }
      
      if (filterOptions.isPrivate !== undefined) {
        filterQuery.isPrivate = filterOptions.isPrivate;
      }
      
      if (filterOptions.videoProvider) {
        filterQuery.videoProvider = filterOptions.videoProvider;
      }
      
      if (filterOptions.startDate || filterOptions.endDate) {
        filterQuery.createdAt = {};
        
        if (filterOptions.startDate) {
          filterQuery.createdAt.$gte = filterOptions.startDate;
        }
        
        if (filterOptions.endDate) {
          filterQuery.createdAt.$lte = filterOptions.endDate;
        }
      }
      
      if (filterOptions.search) {
        filterQuery.$or = [
          { title: { $regex: filterOptions.search, $options: 'i' } },
          { description: { $regex: filterOptions.search, $options: 'i' } },
          { tags: { $regex: filterOptions.search, $options: 'i' } }
        ];
      }
      
      // Build sort options
      const sortOptions: any = {};
      
      if (paginationOptions.sort) {
        sortOptions[paginationOptions.sort.field] = paginationOptions.sort.order === 'asc' ? 1 : -1;
      } else {
        // Default sort by createdAt in descending order
        sortOptions.createdAt = -1;
      }
      
      // Execute query with pagination
      const videos = await Video.find(filterQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);
      
      // Get total count for pagination
      const totalVideos = await Video.countDocuments(filterQuery);
      const totalPages = Math.ceil(totalVideos / limit);
      
      return {
        videos,
        totalVideos,
        totalPages,
        currentPage: page,
        videosPerPage: limit
      };
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get a video by ID
   * @param id Video ID
   * @returns Video document or null if not found
   */
  async getVideoById(id: string): Promise<VideoDocument | null> {
    try {
      // Try to get from cache first
      const cacheKey = `video:id:${id}`;
      
      return await cacheService.getOrSet<VideoDocument | null>(
        cacheKey,
        async () => {
          const video = await Video.findById(id);
          return video;
        },
        // Cache for 10 minutes
        10 * 60 * 1000
      );
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get a video by slug
   * @param slug Video slug
   * @returns Video document or null if not found
   */
  async getVideoBySlug(slug: string): Promise<VideoDocument | null> {
    try {
      // Try to get from cache first
      const cacheKey = `video:slug:${slug}`;
      
      return await cacheService.getOrSet<VideoDocument | null>(
        cacheKey,
        async () => {
          const video = await Video.findOne({ slug });
          return video;
        },
        // Cache for 10 minutes
        10 * 60 * 1000
      );
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Update a video
   * @param id Video ID
   * @param updateData Update data
   * @returns Updated video document
   */
  async updateVideo(id: string, updateData: UpdateVideoInput): Promise<VideoDocument | null> {
    try {
      const video = await Video.findById(id);
      
      if (!video) {
        return null;
      }
      
      // If title is being updated, generate new slug
      if (updateData.title && updateData.title !== video.title) {
        const newSlug = slugify(updateData.title, { lower: true, strict: true });
        
        // Check if new slug already exists
        const existingVideo = await Video.findOne({ 
          slug: newSlug,
          _id: { $ne: id }
        });
        
        if (existingVideo) {
          // Append a random string to make the slug unique
          const uniqueSuffix = Math.random().toString(36).substring(2, 7);
          updateData.slug = `${newSlug}-${uniqueSuffix}`;
        } else {
          updateData.slug = newSlug;
        }
      }
      
      // If status is being updated to published, set publishedAt if not already set
      if (updateData.status === 'published' && !video.publishedAt) {
        updateData.publishedAt = new Date();
      }
      
      // Update video
      const updatedVideo = await Video.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (updatedVideo) {
        // Invalidate cache entries for this video
        cacheService.delete(`video:id:${id}`);
        
        // Invalidate slug cache entries
        if (video.slug) {
          cacheService.delete(`video:slug:${video.slug}`);
        }
        if (updatedVideo.slug && updatedVideo.slug !== video.slug) {
          cacheService.delete(`video:slug:${updatedVideo.slug}`);
        }
        
        // Invalidate featured videos cache if status changed to/from published
        // or if privacy setting changed
        if (updateData.status === 'published' || updateData.isPrivate !== undefined) {
          cacheService.delete(`video:featured:limit:5`);
        }
        
        // Invalidate related videos cache
        if (updateData.category || updateData.tags) {
          // We don't know which videos might have this as related, so clear all related caches
          const cacheKeys = cacheService.keys().filter(key => key.startsWith('video:related:'));
          cacheKeys.forEach(key => cacheService.delete(key));
        }
      }
      
      return updatedVideo;
    } catch (error) {
      if (error instanceof Error.ValidationError) {
        throw new Error(`Validation Error: ${error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Delete a video
   * @param id Video ID
   * @returns Deleted video document or null if not found
   */
  async deleteVideo(id: string): Promise<VideoDocument | null> {
    try {
      // Get video before deletion to access its properties for cache invalidation
      const video = await Video.findById(id);
      
      if (!video) {
        return null;
      }
      
      // Delete the video
      await Video.findByIdAndDelete(id);
      
      // Invalidate cache entries for this video
      cacheService.delete(`video:id:${id}`);
      if (video.slug) {
        cacheService.delete(`video:slug:${video.slug}`);
      }
      
      // Invalidate featured videos cache if this was a published video
      if (video.status === 'published' && !video.isPrivate) {
        cacheService.delete(`video:featured:limit:5`);
      }
      
      // Invalidate related videos cache
      // We don't know which videos might have this as related, so clear all related caches
      const cacheKeys = cacheService.keys().filter(key => key.startsWith('video:related:'));
      cacheKeys.forEach(key => cacheService.delete(key));
      
      return video;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Increment view count
   * @param id Video ID
   * @returns Updated video document or null if not found
   */
  async incrementViewCount(id: string): Promise<VideoDocument | null> {
    try {
      const video = await Video.findByIdAndUpdate(
        id,
        { $inc: { viewCount: 1 } },
        { new: true }
      );
      
      if (video) {
        // Update the cached version if it exists
        const cachedVideo = cacheService.get<VideoDocument>(`video:id:${id}`);
        if (cachedVideo) {
          cachedVideo.viewCount = video.viewCount;
          cacheService.set(`video:id:${id}`, cachedVideo);
        }
        
        // Also update slug cache if it exists
        if (video.slug) {
          const cachedBySlug = cacheService.get<VideoDocument>(`video:slug:${video.slug}`);
          if (cachedBySlug) {
            cachedBySlug.viewCount = video.viewCount;
            cacheService.set(`video:slug:${video.slug}`, cachedBySlug);
          }
        }
        
        // If this is a featured video, we might need to update the featured videos cache
        // But since the order might change, it's safer to just invalidate it
        if (video.status === 'published' && !video.isPrivate) {
          cacheService.delete(`video:featured:limit:5`);
        }
      }
      
      return video;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Update video engagement metrics (likes, dislikes, comments, shares)
   * @param id Video ID
   * @param metrics Metrics to update
   * @returns Updated video document or null if not found
   */
  async updateEngagementMetrics(
    id: string,
    metrics: {
      likeCount?: number;
      dislikeCount?: number;
      commentCount?: number;
      shareCount?: number;
    }
  ): Promise<VideoDocument | null> {
    try {
      const updateData: any = {};
      
      if (metrics.likeCount !== undefined) {
        updateData.likeCount = metrics.likeCount;
      }
      
      if (metrics.dislikeCount !== undefined) {
        updateData.dislikeCount = metrics.dislikeCount;
      }
      
      if (metrics.commentCount !== undefined) {
        updateData.commentCount = metrics.commentCount;
      }
      
      if (metrics.shareCount !== undefined) {
        updateData.shareCount = metrics.shareCount;
      }
      
      const video = await Video.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      );
      
      if (video) {
        // Update the cached version if it exists
        const cachedVideo = cacheService.get<VideoDocument>(`video:id:${id}`);
        if (cachedVideo) {
          // Update all engagement metrics that were changed
          if (metrics.likeCount !== undefined) {
            cachedVideo.likeCount = metrics.likeCount;
          }
          if (metrics.dislikeCount !== undefined) {
            cachedVideo.dislikeCount = metrics.dislikeCount;
          }
          if (metrics.commentCount !== undefined) {
            cachedVideo.commentCount = metrics.commentCount;
          }
          if (metrics.shareCount !== undefined) {
            cachedVideo.shareCount = metrics.shareCount;
          }
          
          cacheService.set(`video:id:${id}`, cachedVideo);
        }
        
        // Also update slug cache if it exists
        if (video.slug) {
          const cachedBySlug = cacheService.get<VideoDocument>(`video:slug:${video.slug}`);
          if (cachedBySlug) {
            // Update all engagement metrics that were changed
            if (metrics.likeCount !== undefined) {
              cachedBySlug.likeCount = metrics.likeCount;
            }
            if (metrics.dislikeCount !== undefined) {
              cachedBySlug.dislikeCount = metrics.dislikeCount;
            }
            if (metrics.commentCount !== undefined) {
              cachedBySlug.commentCount = metrics.commentCount;
            }
            if (metrics.shareCount !== undefined) {
              cachedBySlug.shareCount = metrics.shareCount;
            }
            
            cacheService.set(`video:slug:${video.slug}`, cachedBySlug);
          }
        }
      }
      
      return video;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get featured videos
   * @param limit Number of videos to return
   * @returns Featured videos
   */
  async getFeaturedVideos(limit: number = 5): Promise<VideoDocument[]> {
    try {
      // Try to get from cache first
      const cacheKey = `video:featured:limit:${limit}`;
      
      return await cacheService.getOrSet<VideoDocument[]>(
        cacheKey,
        async () => {
          const videos = await Video.find({ 
            status: 'published',
            isPrivate: false
          })
            .sort({ viewCount: -1, createdAt: -1 })
            .limit(limit);
          
          return videos;
        },
        // Cache for 5 minutes since featured videos may change frequently
        5 * 60 * 1000
      );
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get related videos based on tags and category
   * @param videoId Current video ID
   * @param limit Number of videos to return
   * @returns Related videos
   */
  async getRelatedVideos(videoId: string, limit: number = 5): Promise<VideoDocument[]> {
    try {
      // Try to get from cache first
      const cacheKey = `video:related:${videoId}:limit:${limit}`;
      
      return await cacheService.getOrSet<VideoDocument[]>(
        cacheKey,
        async () => {
          const video = await Video.findById(videoId);
          if (!video) {
            return [];
          }
          
          const relatedVideos = await Video.find({
            _id: { $ne: videoId },
            status: 'published',
            isPrivate: false,
            $or: [
              { category: video.category },
              { tags: { $in: video.tags } }
            ]
          })
            .sort({ viewCount: -1, createdAt: -1 })
            .limit(limit);
          
          return relatedVideos;
        },
        // Cache for 10 minutes
        10 * 60 * 1000
      );
    } catch (error) {
      throw error;
    }
  }
}

export default new VideoService();
