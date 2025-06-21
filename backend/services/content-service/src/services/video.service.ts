import Video from '../models/Video';
import {
  VideoDocument,
  CreateVideoInput,
  UpdateVideoInput,
  VideoFilterOptions,
  VideoPaginationOptions
} from '../interfaces/video.interfaces';
import slugifyPkg from 'slugify';
import { redisUtils, videoCache } from '../utils/redis';
import esClient from '../../../../shared/utils/elasticsearch';

const slugify = (typeof slugifyPkg === 'function') ? slugifyPkg : (slugifyPkg as any).default;
const VIDEO_INDEX = 'videos';

const logger = {
  info: (...args: any[]) => console.info('[Video Service]', ...args),
  error: (...args: any[]) => console.error('[Video Service]', ...args),
  warn: (...args: any[]) => console.warn('[Video Service]', ...args),
  debug: (...args: any[]) => console.debug('[Video Service]', ...args),
};

class VideoService {
  async createVideo(videoData: CreateVideoInput): Promise<VideoDocument> {
    const slug = slugify(videoData.title, { lower: true, strict: true });
    const existingVideo = await Video.findOne({ slug });
    if (existingVideo) {
      const uniqueSuffix = Math.random().toString(36).substring(2, 7);
      videoData.slug = `${slug}-${uniqueSuffix}`;
    } else {
      videoData.slug = slug;
    }

    const newVideoData = {
      ...videoData,
      viewCount: 0,
      likeCount: 0,
      dislikeCount: 0,
      commentCount: 0,
      shareCount: 0,
      isPrivate: videoData.isPrivate ?? false,
      isDownloadable: videoData.isDownloadable ?? false,
      isEmbeddable: videoData.isEmbeddable ?? true,
      status: videoData.status || 'draft'
    };

    const video = new Video(newVideoData);
    const saved = await video.save();

    // Cache video
    await redisUtils.cacheVideo(saved._id.toString(), saved, 3600);
    if (saved.slug) await redisUtils.set(`video:slug:${saved.slug}`, saved, 3600);

    await esClient.indexDocument(VIDEO_INDEX, saved._id.toString(), {
      title: saved.title,
      description: saved.description,
      tags: saved.tags,
      category: saved.category,
      status: saved.status,
      createdAt: saved.createdAt
    });

    // Invalidate list and featured caches
    if (saved.status === 'published' && !saved.isPrivate) {
      const listKeys = await videoCache.getClient().keys('video:list:*');
      const featuredKeys = await videoCache.getClient().keys('video:featured:*');
      const relatedKeys = await videoCache.getClient().keys('video:related:*');
      if (listKeys.length > 0) await videoCache.getClient().del(...listKeys);
      if (featuredKeys.length > 0) await videoCache.getClient().del(...featuredKeys);
      if (relatedKeys.length > 0) await videoCache.getClient().del(...relatedKeys);
    }

    return saved;
  }

  async getVideos(filterOptions: VideoFilterOptions = {}, paginationOptions: VideoPaginationOptions = {}) {
    const page = paginationOptions.page || 1;
    const limit = paginationOptions.limit || 10;
    const skip = (page - 1) * limit;

    const cacheKey = `video:list:${JSON.stringify({ filterOptions, paginationOptions })}`;
    const cached = await redisUtils.get(cacheKey);
    if (cached) {
      logger.info('Served from Redis cache');
      return cached;
    }

    logger.info('Fetched from MongoDB');

    const filterQuery: any = {};
    if (filterOptions.category) filterQuery.category = filterOptions.category;
    if (filterOptions.tags?.length) filterQuery.tags = { $in: filterOptions.tags };
    if (filterOptions.status) filterQuery.status = filterOptions.status;
    if (filterOptions.author) filterQuery['author.id'] = filterOptions.author;
    if (filterOptions.isPrivate !== undefined) filterQuery.isPrivate = filterOptions.isPrivate;
    if (filterOptions.videoProvider) filterQuery.videoProvider = filterOptions.videoProvider;
    if (filterOptions.startDate || filterOptions.endDate) {
      filterQuery.createdAt = {};
      if (filterOptions.startDate) filterQuery.createdAt.$gte = filterOptions.startDate;
      if (filterOptions.endDate) filterQuery.createdAt.$lte = filterOptions.endDate;
    }
    if (filterOptions.search) {
      filterQuery.$or = [
        { title: { $regex: filterOptions.search, $options: 'i' } },
        { description: { $regex: filterOptions.search, $options: 'i' } },
        { tags: { $regex: filterOptions.search, $options: 'i' } }
      ];
    }

    const sortOptions: any = paginationOptions.sort
      ? { [paginationOptions.sort.field]: paginationOptions.sort.order === 'asc' ? 1 : -1 }
      : { createdAt: -1 };

    const videos = await Video.find(filterQuery).sort(sortOptions).skip(skip).limit(limit);
    const totalVideos = await Video.countDocuments(filterQuery);

    const result = {
      videos,
      totalVideos,
      totalPages: Math.ceil(totalVideos / limit),
      currentPage: page,
      videosPerPage: limit
    };

    await redisUtils.set(cacheKey, result, 1800); // Cache for 30 minutes
    return result;
  }

  async getVideoById(id: string): Promise<VideoDocument | null> {
    const cached = await redisUtils.getCachedVideo(id);
    if (cached) {
      logger.info('Served from Redis cache');
      return cached;
    }

    logger.info('Fetched from MongoDB');

    const video = await Video.findById(id);
    if (video) await redisUtils.cacheVideo(id, video, 3600);
    return video;
  }

  async getVideoBySlug(slug: string): Promise<VideoDocument | null> {
    const cacheKey = `video:slug:${slug}`;
    const cached = await redisUtils.get(cacheKey);
    if (cached) {
      logger.info('Served from Redis cache');
      return cached;
    }

    logger.info('Fetched from MongoDB');

    const video = await Video.findOne({ slug });
    if (video) {
      await redisUtils.set(cacheKey, video, 3600);
      await redisUtils.cacheVideo(video._id.toString(), video, 3600);
    }
    return video;
  }

  async updateVideo(id: string, updateData: UpdateVideoInput): Promise<VideoDocument | null> {
    const video = await Video.findById(id);
    if (!video) return null;

    if (updateData.title && updateData.title !== video.title) {
      const newSlug = slugify(updateData.title, { lower: true, strict: true });
      const existing = await Video.findOne({ slug: newSlug, _id: { $ne: id } });
      updateData.slug = existing ? `${newSlug}-${Math.random().toString(36).substring(2, 7)}` : newSlug;
    }

    if (updateData.status === 'published' && !video.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const updatedVideo = await Video.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    if (!updatedVideo) return null;

    // Update caches
    await redisUtils.cacheVideo(id, updatedVideo, 3600);
    if (updatedVideo.slug) await redisUtils.set(`video:slug:${updatedVideo.slug}`, updatedVideo, 3600);
    // Clear old slug cache if changed
    if (video.slug && video.slug !== updatedVideo.slug) {
      await redisUtils.del(`video:slug:${video.slug}`);
    }

    await esClient.indexDocument(VIDEO_INDEX, updatedVideo._id.toString(), {
      title: updatedVideo.title,
      description: updatedVideo.description,
      tags: updatedVideo.tags,
      category: updatedVideo.category,
      status: updatedVideo.status,
      createdAt: updatedVideo.createdAt
    });

    // Invalidate list, featured, and related caches
    if (updatedVideo.status === 'published' && !updatedVideo.isPrivate) {
      const listKeys = await videoCache.getClient().keys('video:list:*');
      const featuredKeys = await videoCache.getClient().keys('video:featured:*');
      const relatedKeys = await videoCache.getClient().keys('video:related:*');
      if (listKeys.length > 0) await videoCache.getClient().del(...listKeys);
      if (featuredKeys.length > 0) await videoCache.getClient().del(...featuredKeys);
      if (relatedKeys.length > 0) await videoCache.getClient().del(...relatedKeys);
    }

    return updatedVideo;
  }

  async deleteVideo(id: string): Promise<VideoDocument | null> {
    const video = await Video.findById(id);
    if (!video) return null;

    await Video.findByIdAndDelete(id);

    // Delete from caches
    await redisUtils.del(`video:id:${id}`);
    if (video.slug) await redisUtils.del(`video:slug:${video.slug}`);

    await esClient.deleteDocument(VIDEO_INDEX, id);

    // Invalidate list, featured, and related caches
    if (video.status === 'published' && !video.isPrivate) {
      const listKeys = await videoCache.getClient().keys('video:list:*');
      const featuredKeys = await videoCache.getClient().keys('video:featured:*');
      const relatedKeys = await videoCache.getClient().keys('video:related:*');
      if (listKeys.length > 0) await videoCache.getClient().del(...listKeys);
      if (featuredKeys.length > 0) await videoCache.getClient().del(...featuredKeys);
      if (relatedKeys.length > 0) await videoCache.getClient().del(...relatedKeys);
    }

    return video;
  }

  async incrementViewCount(id: string): Promise<VideoDocument | null> {
    const video = await Video.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { new: true });
    if (!video) return null;

    // Update caches
    await redisUtils.cacheVideo(id, video, 3600);
    if (video.slug) await redisUtils.set(`video:slug:${video.slug}`, video, 3600);

    // Invalidate featured and related caches
    if (video.status === 'published' && !video.isPrivate) {
      const featuredKeys = await videoCache.getClient().keys('video:featured:*');
      const relatedKeys = await videoCache.getClient().keys('video:related:*');
      if (featuredKeys.length > 0) await videoCache.getClient().del(...featuredKeys);
      if (relatedKeys.length > 0) await videoCache.getClient().del(...relatedKeys);
    }

    return video;
  }

  async updateEngagementMetrics(
    id: string,
    metrics: Partial<Pick<VideoDocument, 'likeCount' | 'dislikeCount' | 'commentCount' | 'shareCount'>>
  ): Promise<VideoDocument | null> {
    const update: any = {};
    if (metrics.likeCount !== undefined) update.likeCount = metrics.likeCount;
    if (metrics.dislikeCount !== undefined) update.dislikeCount = metrics.dislikeCount;
    if (metrics.commentCount !== undefined) update.commentCount = metrics.commentCount;
    if (metrics.shareCount !== undefined) update.shareCount = metrics.shareCount;

    const video = await Video.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!video) return null;

    // Update caches
    await redisUtils.cacheVideo(id, video, 3600);
    if (video.slug) await redisUtils.set(`video:slug:${video.slug}`, video, 3600);

    // Invalidate featured and related caches
    if (video.status === 'published' && !video.isPrivate) {
      const featuredKeys = await videoCache.getClient().keys('video:featured:*');
      const relatedKeys = await videoCache.getClient().keys('video:related:*');
      if (featuredKeys.length > 0) await videoCache.getClient().del(...featuredKeys);
      if (relatedKeys.length > 0) await videoCache.getClient().del(...relatedKeys);
    }

    return video;
  }

  async getFeaturedVideos(limit: number = 5): Promise<VideoDocument[]> {
    const cacheKey = `video:featured:limit:${limit}`;
    const cached = await redisUtils.get(cacheKey);
    if (cached) {
      logger.info('Served from Redis cache');
      return cached;
    }

    logger.info('Fetched from MongoDB');

    const videos = await Video.find({ status: 'published', isPrivate: false })
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(limit);

    await redisUtils.set(cacheKey, videos, 300); // Cache for 5 minutes
    return videos;
  }

  async getRelatedVideos(videoId: string, limit: number = 5): Promise<VideoDocument[]> {
    const cacheKey = `video:related:${videoId}:limit:${limit}`;
    const cached = await redisUtils.get(cacheKey);
    if (cached) {
      logger.info('Served from Redis cache');
      return cached;
    }

    logger.info('Fetched from MongoDB');

    const video = await Video.findById(videoId);
    if (!video) return [];

    const related = await Video.find({
      _id: { $ne: videoId },
      status: 'published',
      isPrivate: false,
      $or: [{ category: video.category }, { tags: { $in: video.tags } }]
    }).sort({ viewCount: -1, createdAt: -1 }).limit(limit);

    await redisUtils.set(cacheKey, related, 600); // Cache for 10 minutes
    return related;
  }
}

export default new VideoService();