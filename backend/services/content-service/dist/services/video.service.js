import Video from '../models/Video.js';
import { Error } from 'mongoose';
// Import slugify directly using ESM import with type assertion
import slugifyPkg from 'slugify';
// Handle both ESM and CommonJS module formats
const slugify = (typeof slugifyPkg === 'function') ? slugifyPkg : slugifyPkg.default;
/**
 * Video Service - Handles all video-related operations
 */
class VideoService {
    /**
     * Create a new video
     * @param videoData Video data to create
     * @returns Created video document
     */
    async createVideo(videoData) {
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
            return video;
        }
        catch (error) {
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
    async getVideos(filterOptions = {}, paginationOptions = {}) {
        try {
            // Default pagination values
            const page = paginationOptions.page || 1;
            const limit = paginationOptions.limit || 10;
            const skip = (page - 1) * limit;
            // Build filter query
            const filterQuery = {};
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
            const sortOptions = {};
            if (paginationOptions.sort) {
                sortOptions[paginationOptions.sort.field] = paginationOptions.sort.order === 'asc' ? 1 : -1;
            }
            else {
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
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Get a video by ID
     * @param id Video ID
     * @returns Video document or null if not found
     */
    async getVideoById(id) {
        try {
            const video = await Video.findById(id);
            return video;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Get a video by slug
     * @param slug Video slug
     * @returns Video document or null if not found
     */
    async getVideoBySlug(slug) {
        try {
            const video = await Video.findOne({ slug });
            return video;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Update a video
     * @param id Video ID
     * @param updateData Update data
     * @returns Updated video document
     */
    async updateVideo(id, updateData) {
        try {
            // Check if video exists
            const video = await Video.findById(id);
            if (!video) {
                return null;
            }
            // If title is being updated, update slug as well
            if (updateData.title) {
                const newSlug = slugify(updateData.title, { lower: true, strict: true });
                // Check if the new slug already exists for a different video
                const existingVideo = await Video.findOne({ slug: newSlug, _id: { $ne: id } });
                if (existingVideo) {
                    // Append a random string to make the slug unique
                    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
                    updateData.slug = `${newSlug}-${uniqueSuffix}`;
                }
                else {
                    updateData.slug = newSlug;
                }
            }
            // If status is being updated to published, set publishedAt if not already set
            if (updateData.status === 'published' && !video.publishedAt) {
                updateData.publishedAt = new Date();
            }
            // Update video
            const updatedVideo = await Video.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
            return updatedVideo;
        }
        catch (error) {
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
    async deleteVideo(id) {
        try {
            const video = await Video.findByIdAndDelete(id);
            return video;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Increment view count
     * @param id Video ID
     * @returns Updated video document or null if not found
     */
    async incrementViewCount(id) {
        try {
            const video = await Video.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { new: true });
            return video;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Update video engagement metrics (likes, dislikes, comments, shares)
     * @param id Video ID
     * @param metrics Metrics to update
     * @returns Updated video document or null if not found
     */
    async updateEngagementMetrics(id, metrics) {
        try {
            const updateData = {};
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
            const video = await Video.findByIdAndUpdate(id, { $set: updateData }, { new: true });
            return video;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Get featured videos
     * @param limit Number of videos to return
     * @returns Featured videos
     */
    async getFeaturedVideos(limit = 5) {
        try {
            const videos = await Video.find({
                status: 'published',
                isPrivate: false
            })
                .sort({ viewCount: -1, createdAt: -1 })
                .limit(limit);
            return videos;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Get related videos based on tags and category
     * @param videoId Current video ID
     * @param limit Number of videos to return
     * @returns Related videos
     */
    async getRelatedVideos(videoId, limit = 5) {
        try {
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
        }
        catch (error) {
            throw error;
        }
    }
}
export default new VideoService();
