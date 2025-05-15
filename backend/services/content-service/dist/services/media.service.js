// Create a simple logger that can be easily mocked in tests
const logger = {
    info: (...args) => console.info('[Media Service]', ...args),
    error: (...args) => console.error('[Media Service]', ...args),
    warn: (...args) => console.warn('[Media Service]', ...args),
    debug: (...args) => console.debug('[Media Service]', ...args),
};
import Media from '../models/Media.js';
import { ContentStatus } from '../interfaces/content.interfaces.js';
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
    async createMedia(mediaData) {
        try {
            // Check if media with same title already exists
            const existingMedia = await Media.findOne({ title: mediaData.title });
            if (existingMedia) {
                throw new Error('Media with this title already exists');
            }
            // Create new media
            const media = new Media(mediaData);
            await media.save();
            return media;
        }
        catch (error) {
            logger.error('Error creating media:', { error: error.message });
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
    async getAllMedia(filters = {}, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc') {
        try {
            const query = { ...filters };
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
            const sort = {};
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
        }
        catch (error) {
            logger.error('Error getting media:', { error: error.message });
            throw error;
        }
    }
    /**
     * Get media by ID
     * @param mediaId - Media ID
     * @returns Media document
     */
    async getMediaById(mediaId) {
        try {
            const media = await Media.findById(mediaId);
            if (!media) {
                throw new Error('Media not found');
            }
            return media;
        }
        catch (error) {
            logger.error('Error getting media by ID:', { error: error.message });
            throw error;
        }
    }
    /**
     * Get media by slug
     * @param slug - Media slug
     * @returns Media document
     */
    async getMediaBySlug(slug) {
        try {
            const media = await Media.findOne({ slug });
            if (!media) {
                throw new Error('Media not found');
            }
            return media;
        }
        catch (error) {
            logger.error('Error getting media by slug:', { error: error.message });
            throw error;
        }
    }
    /**
     * Update media
     * @param mediaId - Media ID
     * @param updateData - Update data
     * @returns Updated media
     */
    async updateMedia(mediaId, updateData) {
        try {
            const media = await Media.findById(mediaId);
            if (!media) {
                throw new Error('Media not found');
            }
            // Check if title is being updated and if it already exists
            if (updateData.title && updateData.title !== media.title) {
                const existingMedia = await Media.findOne({
                    title: updateData.title,
                    _id: { $ne: mediaId }
                });
                if (existingMedia) {
                    throw new Error('Media with this title already exists');
                }
            }
            // Update media
            const updatedMedia = await Media.findByIdAndUpdate(mediaId, updateData, { new: true, runValidators: true });
            if (!updatedMedia) {
                throw new Error('Media not found');
            }
            return updatedMedia;
        }
        catch (error) {
            logger.error('Error updating media:', { error: error.message });
            throw error;
        }
    }
    /**
     * Delete media
     * @param mediaId - Media ID
     * @returns Deleted media
     */
    async deleteMedia(mediaId) {
        try {
            const media = await Media.findByIdAndDelete(mediaId);
            if (!media) {
                throw new Error('Media not found');
            }
            return media;
        }
        catch (error) {
            logger.error('Error deleting media:', { error: error.message });
            throw error;
        }
    }
    /**
     * Update media status
     * @param mediaId - Media ID
     * @param status - New status
     * @returns Updated media
     */
    async updateMediaStatus(mediaId, status) {
        try {
            const media = await Media.findById(mediaId);
            if (!media) {
                throw new Error('Media not found');
            }
            media.status = status;
            await media.save();
            return media;
        }
        catch (error) {
            logger.error('Error updating media status:', { error: error.message });
            throw error;
        }
    }
    /**
     * Increment media view count
     * @param mediaId - Media ID
     * @returns Updated view count
     */
    async incrementViewCount(mediaId) {
        try {
            const media = await Media.findByIdAndUpdate(mediaId, { $inc: { viewCount: 1 } }, { new: true });
            if (!media) {
                throw new Error('Media not found');
            }
            return media.viewCount || 0;
        }
        catch (error) {
            logger.error('Error incrementing view count:', { error: error.message });
            throw error;
        }
    }
    /**
     * Increment media download count
     * @param mediaId - Media ID
     * @returns Updated download count
     */
    async incrementDownloadCount(mediaId) {
        try {
            const media = await Media.findByIdAndUpdate(mediaId, { $inc: { downloadCount: 1 } }, { new: true });
            if (!media) {
                throw new Error('Media not found');
            }
            return media.downloadCount || 0;
        }
        catch (error) {
            logger.error('Error incrementing download count:', { error: error.message });
            throw error;
        }
    }
    /**
     * Get media by type
     * @param type - Media type
     * @param limit - Number of items to return
     * @returns List of media
     */
    async getMediaByType(type, limit = 10) {
        try {
            const media = await Media.find({
                type,
                status: ContentStatus.PUBLISHED
            })
                .sort({ publishedAt: -1 })
                .limit(limit);
            return media;
        }
        catch (error) {
            logger.error('Error getting media by type:', { error: error.message });
            throw error;
        }
    }
}
export default new MediaService();
