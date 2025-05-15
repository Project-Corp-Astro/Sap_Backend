import { validationResult } from 'express-validator';
import mediaService from '../services/media.service.js';
import { ContentStatus } from '../interfaces/content.interfaces.js';
import { MediaType } from '../interfaces/media.interfaces.js';
// Initialize logger
const logger = {
    info: (...args) => console.info('[Media Controller]', ...args),
    error: (...args) => console.error('[Media Controller]', ...args),
    warn: (...args) => console.warn('[Media Controller]', ...args),
    debug: (...args) => console.debug('[Media Controller]', ...args),
};
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
    async createMedia(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: errors.array()
                });
            }
            const mediaData = req.body;
            // Add author information from authenticated user
            if (req.user) {
                mediaData.author = {
                    id: req.user.userId,
                    // Use type assertion to handle optional name property
                    name: req.user.name || req.user.email.split('@')[0] || 'Unknown',
                    email: req.user.email
                };
            }
            const media = await mediaService.createMedia(mediaData);
            return res.status(201).json({
                success: true,
                message: 'Media created successfully',
                data: media
            });
        }
        catch (error) {
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }
            logger.error('Error creating media:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Get all media with pagination and filtering
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async getAllMedia(req, res, next) {
        try {
            const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search, type, category, tags, status, author, createdAfter, createdBefore } = req.query;
            // Build filters
            const filters = {};
            if (search)
                filters.search = search;
            if (type)
                filters.type = type;
            if (category)
                filters.category = category;
            if (tags)
                filters.tags = Array.isArray(tags) ? tags : [tags];
            if (status)
                filters.status = status;
            if (author)
                filters.author = author;
            if (createdAfter)
                filters.createdAfter = createdAfter;
            if (createdBefore)
                filters.createdBefore = createdBefore;
            const result = await mediaService.getAllMedia(filters, parseInt(page), parseInt(limit), sortBy, sortOrder);
            return res.status(200).json({
                success: true,
                message: 'Media retrieved successfully',
                data: result
            });
        }
        catch (error) {
            logger.error('Error getting all media:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Get media by ID
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async getMediaById(req, res, next) {
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
        }
        catch (error) {
            if (error.message === 'Media not found') {
                return res.status(404).json({
                    success: false,
                    message: 'Media not found'
                });
            }
            logger.error('Error getting media by ID:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Get media by slug
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async getMediaBySlug(req, res, next) {
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
        }
        catch (error) {
            if (error.message === 'Media not found') {
                return res.status(404).json({
                    success: false,
                    message: 'Media not found'
                });
            }
            logger.error('Error getting media by slug:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Update media
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async updateMedia(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: errors.array()
                });
            }
            const { mediaId } = req.params;
            const updateData = req.body;
            // Add author information
            const author = {
                userId: req.user.userId,
                email: req.user.email,
                // Use email username as fallback for name
                name: req.user.name || req.user.email.split('@')[0] || 'Unknown',
            };
            const media = await mediaService.updateMedia(mediaId, updateData);
            return res.status(200).json({
                success: true,
                message: 'Media updated successfully',
                data: media
            });
        }
        catch (error) {
            if (error.message === 'Media not found') {
                return res.status(404).json({
                    success: false,
                    message: 'Media not found'
                });
            }
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }
            logger.error('Error updating media:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Delete media
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async deleteMedia(req, res, next) {
        try {
            const { mediaId } = req.params;
            await mediaService.deleteMedia(mediaId);
            return res.status(200).json({
                success: true,
                message: 'Media deleted successfully'
            });
        }
        catch (error) {
            if (error.message === 'Media not found') {
                return res.status(404).json({
                    success: false,
                    message: 'Media not found'
                });
            }
            logger.error('Error deleting media:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Update media status
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async updateMediaStatus(req, res, next) {
        try {
            const { mediaId } = req.params;
            const { status } = req.body;
            if (!Object.values(ContentStatus).includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status value'
                });
            }
            const media = await mediaService.updateMediaStatus(mediaId, status);
            return res.status(200).json({
                success: true,
                message: 'Media status updated successfully',
                data: media
            });
        }
        catch (error) {
            if (error.message === 'Media not found') {
                return res.status(404).json({
                    success: false,
                    message: 'Media not found'
                });
            }
            logger.error('Error updating media status:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Track media download
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async trackDownload(req, res, next) {
        try {
            const { mediaId } = req.params;
            const downloadCount = await mediaService.incrementDownloadCount(mediaId);
            return res.status(200).json({
                success: true,
                message: 'Download tracked successfully',
                data: { downloadCount }
            });
        }
        catch (error) {
            if (error.message === 'Media not found') {
                return res.status(404).json({
                    success: false,
                    message: 'Media not found'
                });
            }
            logger.error('Error tracking download:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Get media by type
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async getMediaByType(req, res, next) {
        try {
            const { type } = req.params;
            const { limit = 10 } = req.query;
            if (!Object.values(MediaType).includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid media type'
                });
            }
            const media = await mediaService.getMediaByType(type, parseInt(limit));
            return res.status(200).json({
                success: true,
                message: 'Media retrieved successfully',
                data: media
            });
        }
        catch (error) {
            logger.error('Error getting media by type:', { error: error.message });
            return next(error);
        }
    }
}
export default new MediaController();
