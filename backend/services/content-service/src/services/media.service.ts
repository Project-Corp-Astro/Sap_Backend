// Create a simple logger that can be easily mocked in tests
const logger = {
  info: (...args: any[]) => console.info('[Media Service]', ...args),
  error: (...args: any[]) => console.error('[Media Service]', ...args),
  warn: (...args: any[]) => console.warn('[Media Service]', ...args),
  debug: (...args: any[]) => console.debug('[Media Service]', ...args),
};
import Media from '../models/Media';
import { MediaDocument, MediaFilter, MediaPaginationResult, MediaType } from '../interfaces/media.interfaces';
import { ContentStatus } from '../interfaces/content.interfaces';
import { cacheService } from '../utils/cache';
import { NotFoundError, ConflictError, handleMongoError } from '../utils/errorTypes';

// Logger already initialized at the top of the file

/**
 * Media service
 */
class MediaService {
  /**
   * Create a new media item
   * @param mediaData - Media data
   * @returns Newly created media
   */
  async createMedia(mediaData: Partial<MediaDocument>): Promise<MediaDocument> {
    try {
      // Check if media with same title already exists
      const existingMedia = await Media.findOne({ title: mediaData.title });
      
      if (existingMedia) {
        throw new ConflictError('Media with this title already exists');
      }
      
      // Create new media
      const media = new Media(mediaData);
      await media.save();
      
      // Invalidate relevant cache entries for media lists
      if (media.type) {
        cacheService.delete(`media:type:${media.type}:limit:10`);
      }
      
      return media;
    } catch (error) {
      logger.error('Error creating media:', { error: (error as Error).message });
      
      // Convert MongoDB errors to our custom errors
      if (!(error instanceof ConflictError)) {
        throw handleMongoError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Get all media with pagination and filtering
   * @param filters - Query filters
   * @param page - Page number
   * @param limit - Items per page
   * @param sortBy - Sort field
   * @param sortOrder - Sort order (asc/desc)
   * @returns Paginated media list
   */
  async getAllMedia(
    filters: MediaFilter = {}, 
    page: number = 1, 
    limit: number = 10, 
    sortBy: string = 'createdAt', 
    sortOrder: string = 'desc'
  ): Promise<MediaPaginationResult> {
    try {
      const query: Record<string, any> = { ...filters };
      
      // Build search query if search param is provided
      if (query.search) {
        const searchRegex = new RegExp(query.search, 'i');
        query.$or = [
          { title: searchRegex },
          { description: searchRegex },
          { tags: searchRegex }
        ];
        delete query.search;
      }
      
      // Handle tags filter
      if (query.tags && Array.isArray(query.tags)) {
        query.tags = { $in: query.tags };
      }
      
      // Handle author filter
      if (query.author) {
        query['author.id'] = query.author;
        delete query.author;
      }
      
      // Handle date range filters
      if (query.createdAfter || query.createdBefore) {
        query.createdAt = {};
        
        if (query.createdAfter) {
          query.createdAt.$gte = new Date(query.createdAfter);
          delete query.createdAfter;
        }
        
        if (query.createdBefore) {
          query.createdAt.$lte = new Date(query.createdBefore);
          delete query.createdBefore;
        }
      }
      
      // Count total documents
      const totalMedia = await Media.countDocuments(query);
      
      // Calculate skip for pagination
      const skip = (page - 1) * limit;
      
      // Sort direction
      const sort: Record<string, 1 | -1> = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Get paginated media
      const media = await Media.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      return {
        media,
        totalMedia,
        totalPages: Math.ceil(totalMedia / limit),
        currentPage: page,
        mediaPerPage: limit
      };
    } catch (error) {
      logger.error('Error getting media:', { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * Get media by ID
   * @param mediaId - Media ID
   * @returns Media document
   */
  async getMediaById(mediaId: string): Promise<MediaDocument> {
    try {
      // Try to get from cache first
      const cacheKey = `media:id:${mediaId}`;
      
      return await cacheService.getOrSet<MediaDocument>(
        cacheKey,
        async () => {
          const media = await Media.findById(mediaId);
          
          if (!media) {
            throw new NotFoundError('Media', mediaId);
          }
          
          return media;
        },
        // Cache for 10 minutes
        10 * 60 * 1000
      );
    } catch (error) {
      logger.error('Error getting media by ID:', { error: (error as Error).message });
      
      // Convert MongoDB errors to our custom errors
      if (!(error instanceof NotFoundError)) {
        throw handleMongoError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Get media by slug
   * @param slug - Media slug
   * @returns Media document
   */
  async getMediaBySlug(slug: string): Promise<MediaDocument> {
    try {
      // Try to get from cache first
      const cacheKey = `media:slug:${slug}`;
      
      return await cacheService.getOrSet<MediaDocument>(
        cacheKey,
        async () => {
          const media = await Media.findOne({ slug });
          
          if (!media) {
            throw new NotFoundError('Media with slug', slug);
          }
          
          return media;
        },
        // Cache for 10 minutes
        10 * 60 * 1000
      );
    } catch (error) {
      logger.error('Error getting media by slug:', { error: (error as Error).message });
      
      // Pass through our custom errors
      if (!(error instanceof NotFoundError)) {
        throw handleMongoError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Update media
   * @param mediaId - Media ID
   * @param updateData - Update data
   * @returns Updated media
   */
  async updateMedia(mediaId: string, updateData: Partial<MediaDocument>): Promise<MediaDocument> {
    try {
      const media = await Media.findById(mediaId);
      
      if (!media) {
        throw new NotFoundError('Media', mediaId);
      }
      
      // Check if title is being updated and if it already exists
      if (updateData.title && updateData.title !== media.title) {
        const existingMedia = await Media.findOne({ 
          title: updateData.title,
          _id: { $ne: mediaId }
        });
        
        if (existingMedia) {
          throw new ConflictError(`Media with title '${updateData.title}' already exists`);
        }
      }
      
      // Update media
      const updatedMedia = await Media.findByIdAndUpdate(
        mediaId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedMedia) {
        throw new NotFoundError('Media', mediaId);
      }
      
      // Invalidate cache entries for this media
      cacheService.delete(`media:id:${mediaId}`);
      if (media.slug) {
        cacheService.delete(`media:slug:${media.slug}`);
      }
      if (updatedMedia.slug && updatedMedia.slug !== media.slug) {
        cacheService.delete(`media:slug:${updatedMedia.slug}`);
      }
      
      // Invalidate type-based cache if type changed
      if (media.type) {
        cacheService.delete(`media:type:${media.type}:limit:10`);
      }
      if (updateData.type && updateData.type !== media.type) {
        cacheService.delete(`media:type:${updateData.type}:limit:10`);
      }
      
      return updatedMedia;
    } catch (error) {
      logger.error('Error updating media:', { error: (error as Error).message });
      
      // Pass through our custom errors
      if (!(error instanceof NotFoundError) && !(error instanceof ConflictError)) {
        throw handleMongoError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Delete media
   * @param mediaId - Media ID
   * @returns Deleted media
   */
  async deleteMedia(mediaId: string): Promise<MediaDocument> {
    try {
      // Get media before deletion to access its properties for cache invalidation
      const media = await Media.findById(mediaId);
      
      if (!media) {
        throw new NotFoundError('Media', mediaId);
      }
      
      // Delete the media
      await Media.findByIdAndDelete(mediaId);
      
      // Invalidate cache entries for this media
      cacheService.delete(`media:id:${mediaId}`);
      if (media.slug) {
        cacheService.delete(`media:slug:${media.slug}`);
      }
      
      // Invalidate type-based cache
      if (media.type) {
        cacheService.delete(`media:type:${media.type}:limit:10`);
      }
      
      return media;
    } catch (error) {
      logger.error('Error deleting media:', { error: (error as Error).message });
      
      // Pass through our custom errors
      if (!(error instanceof NotFoundError)) {
        throw handleMongoError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Update media status
   * @param mediaId - Media ID
   * @param status - New status
   * @returns Updated media
   */
  async updateMediaStatus(mediaId: string, status: ContentStatus): Promise<MediaDocument> {
    try {
      const media = await Media.findById(mediaId);
      
      if (!media) {
        throw new NotFoundError('Media', mediaId);
      }
      
      const oldStatus = media.status;
      media.status = status;
      await media.save();
      
      // Invalidate cache entries for this media
      cacheService.delete(`media:id:${mediaId}`);
      if (media.slug) {
        cacheService.delete(`media:slug:${media.slug}`);
      }
      
      // Invalidate type-based cache if status changed to/from published
      if ((oldStatus === ContentStatus.PUBLISHED || status === ContentStatus.PUBLISHED) && media.type) {
        cacheService.delete(`media:type:${media.type}:limit:10`);
      }
      
      return media;
    } catch (error) {
      logger.error('Error updating media status:', { error: (error as Error).message });
      
      // Pass through our custom errors
      if (!(error instanceof NotFoundError)) {
        throw handleMongoError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Increment media view count
   * @param mediaId - Media ID
   * @returns Updated view count
   */
  async incrementViewCount(mediaId: string): Promise<number> {
    try {
      const media = await Media.findByIdAndUpdate(
        mediaId,
        { $inc: { viewCount: 1 } },
        { new: true }
      );
      
      if (!media) {
        throw new Error('Media not found');
      }
      
      // Update the cached version if it exists
      const cachedMedia = cacheService.get<MediaDocument>(`media:id:${mediaId}`);
      if (cachedMedia) {
        cachedMedia.viewCount = media.viewCount;
        cacheService.set(`media:id:${mediaId}`, cachedMedia);
      }
      
      // Also update slug cache if it exists
      if (media.slug) {
        const cachedBySlug = cacheService.get<MediaDocument>(`media:slug:${media.slug}`);
        if (cachedBySlug) {
          cachedBySlug.viewCount = media.viewCount;
          cacheService.set(`media:slug:${media.slug}`, cachedBySlug);
        }
      }
      
      return media.viewCount || 0;
    } catch (error) {
      logger.error('Error incrementing view count:', { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * Increment media download count
   * @param mediaId - Media ID
   * @returns Updated download count
   */
  async incrementDownloadCount(mediaId: string): Promise<number> {
    try {
      const media = await Media.findByIdAndUpdate(
        mediaId,
        { $inc: { downloadCount: 1 } },
        { new: true }
      );
      
      if (!media) {
        throw new Error('Media not found');
      }
      
      // Update the cached version if it exists
      const cachedMedia = cacheService.get<MediaDocument>(`media:id:${mediaId}`);
      if (cachedMedia) {
        cachedMedia.downloadCount = media.downloadCount;
        cacheService.set(`media:id:${mediaId}`, cachedMedia);
      }
      
      // Also update slug cache if it exists
      if (media.slug) {
        const cachedBySlug = cacheService.get<MediaDocument>(`media:slug:${media.slug}`);
        if (cachedBySlug) {
          cachedBySlug.downloadCount = media.downloadCount;
          cacheService.set(`media:slug:${media.slug}`, cachedBySlug);
        }
      }
      
      return media.downloadCount || 0;
    } catch (error) {
      logger.error('Error incrementing download count:', { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * Get media by type
   * @param type - Media type
   * @param limit - Number of items to return
   * @returns List of media
   */
  async getMediaByType(type: MediaType, limit: number = 10): Promise<MediaDocument[]> {
    try {
      // Try to get from cache first
      const cacheKey = `media:type:${type}:limit:${limit}`;
      
      return await cacheService.getOrSet<MediaDocument[]>(
        cacheKey,
        async () => {
          const media = await Media.find({ 
            type,
            status: ContentStatus.PUBLISHED
          })
            .sort({ publishedAt: -1 })
            .limit(limit);
          
          return media;
        },
        // Cache for 5 minutes
        5 * 60 * 1000
      );
    } catch (error) {
      logger.error('Error getting media by type:', { error: (error as Error).message });
      throw error;
    }
  }
}

export default new MediaService();
