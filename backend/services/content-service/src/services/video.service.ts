// video.service.ts with Redis and Elasticsearch integrated

import Video from '../models/Video';
import {
  VideoDocument,
  CreateVideoInput,
  UpdateVideoInput,
  VideoFilterOptions,
  VideoPaginationOptions
} from '../interfaces/video.interfaces';
import { Error } from 'mongoose';
import slugifyPkg from 'slugify';
import { videoCache } from '../utils/redis';
import esClient from '../../../../shared/utils/elasticsearch';

const slugify = (typeof slugifyPkg === 'function') ? slugifyPkg : (slugifyPkg as any).default;
const VIDEO_INDEX = 'videos';

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
    await video.save();

    await esClient.indexDocument(VIDEO_INDEX, video._id.toString(), {
      title: video.title,
      description: video.description,
      tags: video.tags,
      category: video.category,
      status: video.status,
      createdAt: video.createdAt
    });

    if (video.status === 'published' && !video.isPrivate) {
      await videoCache.del(`featured:limit:5`);
    }

    return video;
  }

  async getVideos(filterOptions: VideoFilterOptions = {}, paginationOptions: VideoPaginationOptions = {}) {
    const page = paginationOptions.page || 1;
    const limit = paginationOptions.limit || 10;
    const skip = (page - 1) * limit;

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

    return {
      videos,
      totalVideos,
      totalPages: Math.ceil(totalVideos / limit),
      currentPage: page,
      videosPerPage: limit
    };
  }

  async getVideoById(id: string): Promise<VideoDocument | null> {
    const key = `id:${id}`;
    const cached = await videoCache.get(key);
    if (cached) {
      console.log('✅ Served from Redis cache');
      return JSON.parse(cached);
    }
    
    console.log('🗄️ Fetched from MongoDB');

    const video = await Video.findById(id);
    if (video) await videoCache.set(key, JSON.stringify(video), { ttl: 600 });
    return video;
  }

  async getVideoBySlug(slug: string): Promise<VideoDocument | null> {
    const key = `slug:${slug}`;
    const cached = await videoCache.get(key);
    if (cached) return JSON.parse(cached);

    const video = await Video.findOne({ slug });
    if (video) await videoCache.set(key, JSON.stringify(video), { ttl: 600 });
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

    await videoCache.del(`id:${id}`);
    if (video.slug) await videoCache.del(`slug:${video.slug}`);
    if (updatedVideo.slug && updatedVideo.slug !== video.slug) {
      await videoCache.del(`slug:${updatedVideo.slug}`);
    }

    await esClient.indexDocument(VIDEO_INDEX, updatedVideo._id.toString(), {
      title: updatedVideo.title,
      description: updatedVideo.description,
      tags: updatedVideo.tags,
      category: updatedVideo.category,
      status: updatedVideo.status,
      createdAt: updatedVideo.createdAt
    });

    return updatedVideo;
  }

  async deleteVideo(id: string): Promise<VideoDocument | null> {
    const video = await Video.findById(id);
    if (!video) return null;

    await Video.findByIdAndDelete(id);
    await videoCache.del(`id:${id}`);
    if (video.slug) await videoCache.del(`slug:${video.slug}`);
    await esClient.deleteDocument(VIDEO_INDEX, id);

    return video;
  }

  async incrementViewCount(id: string): Promise<VideoDocument | null> {
    const video = await Video.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { new: true });
    if (!video) return null;
    await videoCache.set(`id:${id}`, JSON.stringify(video), { ttl: 600 });
    if (video.slug) await videoCache.set(`slug:${video.slug}`, JSON.stringify(video), { ttl: 600 });
    return video;
  }

  async updateEngagementMetrics(id: string, metrics: Partial<Pick<VideoDocument, 'likeCount' | 'dislikeCount' | 'commentCount' | 'shareCount'>>): Promise<VideoDocument | null> {
    const update: any = {};
    if (metrics.likeCount !== undefined) update.likeCount = metrics.likeCount;
    if (metrics.dislikeCount !== undefined) update.dislikeCount = metrics.dislikeCount;
    if (metrics.commentCount !== undefined) update.commentCount = metrics.commentCount;
    if (metrics.shareCount !== undefined) update.shareCount = metrics.shareCount;

    const video = await Video.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!video) return null;

    await videoCache.set(`id:${id}`, JSON.stringify(video), { ttl: 600 });
    if (video.slug) await videoCache.set(`slug:${video.slug}`, JSON.stringify(video), { ttl: 600 });
    return video;
  }

  async getFeaturedVideos(limit: number = 5): Promise<VideoDocument[]> {
    const key = `featured:limit:${limit}`;
    const cached = await videoCache.get(key);
    if (cached) return JSON.parse(cached);

    const videos = await Video.find({ status: 'published', isPrivate: false })
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(limit);

    await videoCache.set(key, JSON.stringify(videos), { ttl: 300 });
    return videos;
  }

  async getRelatedVideos(videoId: string, limit: number = 5): Promise<VideoDocument[]> {
    const key = `related:${videoId}:limit:${limit}`;
    const cached = await videoCache.get(key);
    if (cached) return JSON.parse(cached);

    const video = await Video.findById(videoId);
    if (!video) return [];

    const related = await Video.find({
      _id: { $ne: videoId },
      status: 'published',
      isPrivate: false,
      $or: [{ category: video.category }, { tags: { $in: video.tags } }]
    }).sort({ viewCount: -1, createdAt: -1 }).limit(limit);

    await videoCache.set(key, JSON.stringify(related), { ttl: 600 });
    return related;
  }
}

export default new VideoService();
