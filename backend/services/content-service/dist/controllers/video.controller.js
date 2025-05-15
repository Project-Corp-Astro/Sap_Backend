import videoService from '../services/video.service.js';
/**
 * Video Controller - Handles HTTP requests for video operations
 */
class VideoController {
    /**
     * Create a new video
     * @route POST /api/videos
     */
    async createVideo(req, res, next) {
        try {
            const videoData = req.body;
            // Validate required fields
            if (!videoData.title || !videoData.description || !videoData.url) {
                return res.status(400).json({
                    success: false,
                    message: 'Title, description, and URL are required fields',
                    error: 'ValidationError'
                });
            }
            // Create video
            const video = await videoService.createVideo(videoData);
            return res.status(201).json({
                success: true,
                message: 'Video created successfully',
                data: video
            });
        }
        catch (error) {
            console.error('Error creating video:', error);
            if (error instanceof Error && error.message.includes('Validation Error')) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                    error: 'ValidationError'
                });
            }
            next(error);
        }
    }
    /**
     * Get all videos with filtering and pagination
     * @route GET /api/videos
     */
    async getVideos(req, res, next) {
        try {
            // Extract filter options from query params
            const filterOptions = {};
            if (req.query.category) {
                filterOptions.category = req.query.category;
            }
            if (req.query.tags) {
                filterOptions.tags = req.query.tags.split(',');
            }
            if (req.query.status) {
                filterOptions.status = req.query.status;
            }
            if (req.query.author) {
                filterOptions.author = req.query.author;
            }
            if (req.query.isPrivate !== undefined) {
                filterOptions.isPrivate = req.query.isPrivate === 'true';
            }
            if (req.query.videoProvider) {
                filterOptions.videoProvider = req.query.videoProvider;
            }
            if (req.query.startDate) {
                filterOptions.startDate = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                filterOptions.endDate = new Date(req.query.endDate);
            }
            if (req.query.search) {
                filterOptions.search = req.query.search;
            }
            // Extract pagination options from query params
            const paginationOptions = {};
            if (req.query.page) {
                paginationOptions.page = parseInt(req.query.page, 10);
            }
            if (req.query.limit) {
                paginationOptions.limit = parseInt(req.query.limit, 10);
            }
            if (req.query.sortField && req.query.sortOrder) {
                paginationOptions.sort = {
                    field: req.query.sortField,
                    order: req.query.sortOrder
                };
            }
            // Get videos
            const result = await videoService.getVideos(filterOptions, paginationOptions);
            return res.status(200).json({
                success: true,
                message: 'Videos retrieved successfully',
                data: result.videos,
                totalVideos: result.totalVideos,
                totalPages: result.totalPages,
                currentPage: result.currentPage,
                videosPerPage: result.videosPerPage
            });
        }
        catch (error) {
            console.error('Error getting videos:', error);
            next(error);
        }
    }
    /**
     * Get a video by ID
     * @route GET /api/videos/:id
     */
    async getVideoById(req, res, next) {
        try {
            const { id } = req.params;
            const video = await videoService.getVideoById(id);
            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found',
                    error: 'NotFoundError'
                });
            }
            return res.status(200).json({
                success: true,
                message: 'Video retrieved successfully',
                data: video
            });
        }
        catch (error) {
            console.error('Error getting video by ID:', error);
            next(error);
        }
    }
    /**
     * Get a video by slug
     * @route GET /api/videos/slug/:slug
     */
    async getVideoBySlug(req, res, next) {
        try {
            const { slug } = req.params;
            const video = await videoService.getVideoBySlug(slug);
            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found',
                    error: 'NotFoundError'
                });
            }
            return res.status(200).json({
                success: true,
                message: 'Video retrieved successfully',
                data: video
            });
        }
        catch (error) {
            console.error('Error getting video by slug:', error);
            next(error);
        }
    }
    /**
     * Update a video
     * @route PUT /api/videos/:id
     */
    async updateVideo(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const video = await videoService.updateVideo(id, updateData);
            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found',
                    error: 'NotFoundError'
                });
            }
            return res.status(200).json({
                success: true,
                message: 'Video updated successfully',
                data: video
            });
        }
        catch (error) {
            console.error('Error updating video:', error);
            if (error instanceof Error && error.message.includes('Validation Error')) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                    error: 'ValidationError'
                });
            }
            next(error);
        }
    }
    /**
     * Delete a video
     * @route DELETE /api/videos/:id
     */
    async deleteVideo(req, res, next) {
        try {
            const { id } = req.params;
            const video = await videoService.deleteVideo(id);
            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found',
                    error: 'NotFoundError'
                });
            }
            return res.status(200).json({
                success: true,
                message: 'Video deleted successfully',
                data: { id }
            });
        }
        catch (error) {
            console.error('Error deleting video:', error);
            next(error);
        }
    }
    /**
     * Increment view count
     * @route POST /api/videos/:id/view
     */
    async incrementViewCount(req, res, next) {
        try {
            const { id } = req.params;
            const video = await videoService.incrementViewCount(id);
            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found',
                    error: 'NotFoundError'
                });
            }
            return res.status(200).json({
                success: true,
                message: 'View count incremented successfully',
                data: { id, viewCount: video.viewCount }
            });
        }
        catch (error) {
            console.error('Error incrementing view count:', error);
            next(error);
        }
    }
    /**
     * Update engagement metrics
     * @route PUT /api/videos/:id/engagement
     */
    async updateEngagementMetrics(req, res, next) {
        try {
            const { id } = req.params;
            const metrics = req.body;
            const video = await videoService.updateEngagementMetrics(id, metrics);
            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found',
                    error: 'NotFoundError'
                });
            }
            return res.status(200).json({
                success: true,
                message: 'Engagement metrics updated successfully',
                data: {
                    id,
                    likeCount: video.likeCount,
                    dislikeCount: video.dislikeCount,
                    commentCount: video.commentCount,
                    shareCount: video.shareCount
                }
            });
        }
        catch (error) {
            console.error('Error updating engagement metrics:', error);
            next(error);
        }
    }
    /**
     * Get featured videos
     * @route GET /api/videos/featured
     */
    async getFeaturedVideos(req, res, next) {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
            const videos = await videoService.getFeaturedVideos(limit);
            return res.status(200).json({
                success: true,
                message: 'Featured videos retrieved successfully',
                data: videos
            });
        }
        catch (error) {
            console.error('Error getting featured videos:', error);
            next(error);
        }
    }
    /**
     * Get related videos
     * @route GET /api/videos/:id/related
     */
    async getRelatedVideos(req, res, next) {
        try {
            const { id } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
            const videos = await videoService.getRelatedVideos(id, limit);
            return res.status(200).json({
                success: true,
                message: 'Related videos retrieved successfully',
                data: videos
            });
        }
        catch (error) {
            console.error('Error getting related videos:', error);
            next(error);
        }
    }
}
export default new VideoController();
