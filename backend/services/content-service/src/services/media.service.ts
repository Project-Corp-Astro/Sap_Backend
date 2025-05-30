// media.service.ts

import redisClient from '../../../../shared/utils/redis';
import esClient from '../../../../shared/utils/elasticsearch';
import Media from '../models/Media';
import { MediaDocument, MediaFilter, MediaPaginationResult, MediaType } from '../interfaces/media.interfaces';
import { ContentStatus } from '../interfaces/content.interfaces';
import { cacheService } from '../utils/cache';
import { NotFoundError, ConflictError, handleMongoError } from '../utils/errorTypes';

const logger = {
  info: (...args: any[]) => console.info('[Media Service]', ...args),
  error: (...args: any[]) => console.error('[Media Service]', ...args),
  warn: (...args: any[]) => console.warn('[Media Service]', ...args),
  debug: (...args: any[]) => console.debug('[Media Service]', ...args),
};

class MediaService {
  async createMedia(mediaData: Partial<MediaDocument>): Promise<MediaDocument> {
    const existingMedia = await Media.findOne({ title: mediaData.title });
    if (existingMedia) throw new ConflictError('Media with this title already exists');

    const media = new Media(mediaData);
    const saved = await media.save();

    const cacheKey = `media:id:${media._id}`;
    await redisClient.set(cacheKey, saved, 3600);

    await esClient.indexDocument('media', saved._id.toString(), {
      title: saved.title,
      description: saved.description,
      tags: saved.tags,
      category: saved.category,
      author: saved.author,
      status: saved.status,
      slug: saved.slug,
      type: saved.type,
    });

    return saved;
  }

  async getAllMedia(
    filters: MediaFilter = {},
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  ): Promise<MediaPaginationResult> {
    const query: any = { ...filters };

    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      query.$or = [
        { title: regex },
        { description: regex },
        { tags: regex },
      ];
      delete query.search;
    }

    if (query.tags && Array.isArray(query.tags)) query.tags = { $in: query.tags };
    if (query.author) {
      query['author.id'] = query.author;
      delete query.author;
    }

    if (query.createdAfter || query.createdBefore) {
      query.createdAt = {};
      if (query.createdAfter) query.createdAt.$gte = new Date(query.createdAfter);
      if (query.createdBefore) query.createdAt.$lte = new Date(query.createdBefore);
    }

    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [media, totalMedia] = await Promise.all([
      Media.find(query).sort(sort).skip(skip).limit(limit),
      Media.countDocuments(query),
    ]);

    return {
      media,
      totalMedia,
      totalPages: Math.ceil(totalMedia / limit),
      currentPage: page,
      mediaPerPage: limit,
    };
  }

  async getMediaById(mediaId: string): Promise<MediaDocument> {
    const cacheKey = `media:id:${mediaId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log('✅ Served from Redis cache');
      return cached;
    } 
    console.log('🗄️ Fetched from MongoDB');
    const media = await Media.findById(mediaId);
    if (!media) throw new NotFoundError('Media', mediaId);

    await redisClient.set(cacheKey, media, 600);
    return media;
  }

  async getMediaBySlug(slug: string): Promise<MediaDocument> {
    const cacheKey = `media:slug:${slug}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return cached;

    const media = await Media.findOne({ slug });
    if (!media) throw new NotFoundError('Media with slug', slug);

    await redisClient.set(cacheKey, media, 600);
    return media;
  }

  async updateMedia(mediaId: string, updateData: Partial<MediaDocument>): Promise<MediaDocument> {
    const media = await Media.findById(mediaId);
    if (!media) throw new NotFoundError('Media', mediaId);

    if (updateData.title && updateData.title !== media.title) {
      const exists = await Media.findOne({ title: updateData.title, _id: { $ne: mediaId } });
      if (exists) throw new ConflictError(`Media with title '${updateData.title}' already exists`);
    }

    Object.assign(media, updateData);
    const updated = await media.save();

    await redisClient.set(`media:id:${mediaId}`, updated, 600);
    if (updated.slug) await redisClient.set(`media:slug:${updated.slug}`, updated, 600);

    await esClient.indexDocument('media', mediaId, updated);

    return updated;
  }

  async deleteMedia(mediaId: string): Promise<MediaDocument> {
    const media = await Media.findByIdAndDelete(mediaId);
    if (!media) throw new NotFoundError('Media', mediaId);

    await redisClient.del(`media:id:${mediaId}`);
    if (media.slug) await redisClient.del(`media:slug:${media.slug}`);

    await esClient.deleteDocument('media', mediaId);
    return media;
  }

  async updateMediaStatus(mediaId: string, status: ContentStatus): Promise<MediaDocument> {
    const media = await Media.findById(mediaId);
    if (!media) throw new NotFoundError('Media', mediaId);

    media.status = status;
    const updated = await media.save();

    await redisClient.set(`media:id:${mediaId}`, updated, 600);
    await esClient.indexDocument('media', mediaId, updated);

    return updated;
  }

  async incrementViewCount(mediaId: string): Promise<number> {
    const media = await Media.findByIdAndUpdate(
      mediaId,
      { $inc: { viewCount: 1 } },
      { new: true }
    );
    if (!media) throw new Error('Media not found');

    await redisClient.set(`media:id:${mediaId}`, media, 600);
    return media.viewCount || 0;
  }

  async incrementDownloadCount(mediaId: string): Promise<number> {
    const media = await Media.findByIdAndUpdate(
      mediaId,
      { $inc: { downloadCount: 1 } },
      { new: true }
    );
    if (!media) throw new Error('Media not found');

    await redisClient.set(`media:id:${mediaId}`, media, 600);
    return media.downloadCount || 0;
  }

  async getMediaByType(type: MediaType, limit: number = 10): Promise<MediaDocument[]> {
    const cacheKey = `media:type:${type}:limit:${limit}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return cached;

    const media = await Media.find({ type, status: ContentStatus.PUBLISHED })
      .sort({ publishedAt: -1 })
      .limit(limit);

    await redisClient.set(cacheKey, media, 300);
    return media;
  }

  async searchMedia(query: string): Promise<MediaDocument[]> {
    const esQuery = {
      query: {
        multi_match: {
          query,
          fields: ['title^3', 'description', 'tags', 'author.name', 'category']
        }
      }
    };

    const result = await esClient.search('media', esQuery);
    return result.hits.map((hit: any) => hit._source);
  }
}

export default new MediaService();
