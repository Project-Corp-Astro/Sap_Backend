import { ContentStatus } from '../interfaces/content.interfaces.js';
import { createServiceLogger } from '../utils/sharedLogger.js';
import Content from '../models/Content.js';
import Category from '../models/Category.js';
// Initialize logger
const logger = createServiceLogger('content-service');
/**
 * Content management service
 */
class ContentService {
    /**
     * Create new content
     * @param contentData - Content data
     * @param user - User creating the content
     * @returns Created content
     */
    async createContent(contentData, user) {
        logger.info('Creating new content', { userId: user.userId });
        try {
            // Assign author information
            contentData.author = {
                id: user.userId,
                name: user.email.split('@')[0], // Use email prefix as name if username not available
                email: user.email
            };
            // Set default status if not provided
            if (!contentData.status) {
                contentData.status = ContentStatus.DRAFT;
            }
            // Create content
            const content = new Content(contentData);
            const savedContent = await content.save();
            logger.info('Content created successfully', {
                contentId: savedContent._id,
                title: savedContent.title
            });
            return savedContent;
        }
        catch (error) {
            logger.error('Error creating content', {
                error: error.message,
                stack: error.stack,
                contentTitle: contentData.title,
                userId: user.userId
            });
            throw error;
        }
    }
    /**
     * Get all content with pagination and filtering
     * @param filters - Query filters
     * @param page - Page number
     * @param limit - Items per page
     * @param sortBy - Sort field
     * @param sortOrder - Sort order (asc/desc)
     * @returns Paginated content list
     */
    async getAllContent(filters = {}, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc') {
        try {
            // Count total documents
            const totalItems = await Content.countDocuments(filters);
            // Calculate skip for pagination
            const skip = (page - 1) * limit;
            // Sort direction
            const sort = {};
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
            // Get paginated content
            const items = await Content.find(filters)
                .sort(sort)
                .skip(skip)
                .limit(limit);
            return {
                items,
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                currentPage: page,
                itemsPerPage: limit
            };
        }
        catch (error) {
            logger.error('Error getting content', {
                error: error.message,
                stack: error.stack,
                filters
            });
            throw error;
        }
    }
    /**
     * Get content by ID
     * @param contentId - Content ID
     * @returns Content document
     */
    async getContentById(contentId) {
        try {
            const content = await Content.findById(contentId);
            if (!content) {
                throw new Error('Content not found');
            }
            return content;
        }
        catch (error) {
            logger.error('Error getting content by ID', {
                error: error.message,
                stack: error.stack,
                contentId
            });
            throw error;
        }
    }
    /**
     * Get content by slug
     * @param slug - Content slug
     * @returns Content document
     */
    async getContentBySlug(slug) {
        try {
            const content = await Content.findOne({ slug });
            if (!content) {
                throw new Error('Content not found');
            }
            return content;
        }
        catch (error) {
            logger.error('Error getting content by slug', {
                error: error.message,
                stack: error.stack,
                slug
            });
            throw error;
        }
    }
    /**
     * Update content
     * @param contentId - Content ID
     * @param updateData - Fields to update
     * @param user - User updating the content
     * @returns Updated content
     */
    async updateContent(contentId, updateData, user) {
        try {
            // Find content to update
            const content = await Content.findById(contentId);
            if (!content) {
                throw new Error('Content not found');
            }
            // Update fields
            Object.keys(updateData).forEach((key) => {
                content[key] = updateData[key];
            });
            // Save content
            await content.save();
            return content;
        }
        catch (error) {
            logger.error('Error updating content', {
                error: error.message,
                stack: error.stack,
                contentId,
                userId: user.userId
            });
            throw error;
        }
    }
    /**
     * Delete content
     * @param contentId - Content ID
     * @param user - User deleting the content
     * @returns Deleted content
     */
    async deleteContent(contentId, user) {
        try {
            const content = await Content.findByIdAndDelete(contentId);
            if (!content) {
                throw new Error('Content not found');
            }
            logger.info('Content deleted', {
                contentId,
                userId: user.userId
            });
            return content;
        }
        catch (error) {
            logger.error('Error deleting content', {
                error: error.message,
                stack: error.stack,
                contentId,
                userId: user.userId
            });
            throw error;
        }
    }
    /**
     * Update content status
     * @param contentId - Content ID
     * @param status - New status
     * @param user - User updating the status
     * @returns Updated content
     */
    async updateContentStatus(contentId, status, user) {
        try {
            // Validate status
            if (!Object.values(ContentStatus).includes(status)) {
                throw new Error('Invalid status');
            }
            // Find content
            const content = await Content.findById(contentId);
            if (!content) {
                throw new Error('Content not found');
            }
            // Update status
            content.status = status;
            // If status is published, set publishedAt date
            if (status === ContentStatus.PUBLISHED && !content.publishedAt) {
                content.publishedAt = new Date();
            }
            // Save content
            await content.save();
            return content;
        }
        catch (error) {
            logger.error('Error updating content status', {
                error: error.message,
                stack: error.stack,
                contentId,
                status,
                userId: user.userId
            });
            throw error;
        }
    }
    /**
     * Increment view count
     * @param contentId - Content ID
     * @returns New view count
     */
    async incrementViewCount(contentId) {
        try {
            const content = await Content.findByIdAndUpdate(contentId, { $inc: { viewCount: 1 } }, { new: true });
            if (!content) {
                throw new Error('Content not found');
            }
            return content.viewCount || 0;
        }
        catch (error) {
            logger.error('Error incrementing view count', {
                error: error.message,
                stack: error.stack,
                contentId
            });
            throw error;
        }
    }
    /**
     * Get all categories
     * @returns List of categories
     */
    async getAllCategories() {
        try {
            return await Category.find().sort({ name: 1 });
        }
        catch (error) {
            logger.error('Error getting categories', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    /**
     * Create category
     * @param categoryData - Category data
     * @returns Created category
     */
    async createCategory(categoryData) {
        try {
            // Create slug if not provided
            if (!categoryData.slug && categoryData.name) {
                categoryData.slug = categoryData.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
            }
            const category = new Category(categoryData);
            return await category.save();
        }
        catch (error) {
            logger.error('Error creating category', {
                error: error.message,
                stack: error.stack,
                categoryName: categoryData.name
            });
            throw error;
        }
    }
}
// Create and export service instance
const contentService = new ContentService();
// Export individual methods
export const { createContent, getAllContent, getContentById, getContentBySlug, updateContent, deleteContent, updateContentStatus, incrementViewCount, getAllCategories, createCategory } = contentService;
