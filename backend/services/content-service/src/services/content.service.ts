// content.service.ts

import redisClient from '../../../../shared/utils/redis';
import esClient from '../../../../shared/utils/elasticsearch';
import Content from '../models/Content';
import Category from '../models/Category';
import { ContentStatus } from '@corp-astro/shared-types';
import { RequestUser, ExtendedContent, ContentDocument, CategoryDocument } from '../interfaces/shared-types';

export const createContent = async (
  contentData: Partial<ExtendedContent>,
  user: RequestUser
): Promise<ContentDocument> => {
  contentData.author = {
    id: user.userId,
    name: user.email.split('@')[0],
    email: user.email
  };

  contentData.status = contentData.status || ContentStatus.DRAFT;

  if (!contentData.slug && contentData.title) {
    contentData.slug = contentData.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  const content = new Content(contentData);
  const saved = await content.save();

  await redisClient.set(`content:${saved._id}`, saved, 3600);

  await esClient.indexDocument('content', saved._id.toString(), {
    title: saved.title,
    body: saved.body,
    category: saved.category,
    tags: saved.tags,
    author: saved.author,
    status: saved.status,
    slug: saved.slug
  });

  return saved;
};

export const getAllContent = async (filters = {}, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc') => {
  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const [items, totalItems] = await Promise.all([
    Content.find(filters).sort(sort).skip(skip).limit(limit),
    Content.countDocuments(filters)
  ]);

  return {
    items,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    currentPage: page,
    itemsPerPage: limit
  };
};

export const getContentById = async (id: string): Promise<ContentDocument> => {
  const cacheKey = `content:${id}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    console.log('✅ Served from Redis cache');
    return cached;
  }
  
  console.log('🗄️ Fetched from MongoDB');

  const content = await Content.findById(id);
  if (!content) throw new Error('Content not found');

  await redisClient.set(cacheKey, content, 3600);
  return content;
};

export const getContentBySlug = async (slug: string): Promise<ContentDocument> => {
  const cacheKey = `content:slug:${slug}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return cached;

  const content = await Content.findOne({ slug });
  if (!content) throw new Error('Content not found');

  await redisClient.set(cacheKey, content, 3600);
  return content;
};

export const updateContent = async (id: string, updateData: Partial<ExtendedContent>, user: RequestUser): Promise<ContentDocument> => {
  const content = await Content.findById(id);
  if (!content) throw new Error('Content not found');

  Object.assign(content, updateData);
  const updated = await content.save();

  await redisClient.set(`content:${id}`, updated, 3600);
  await esClient.indexDocument('content', id, updated);

  return updated;
};

export const deleteContent = async (id: string, user: RequestUser): Promise<ContentDocument> => {
  const content = await Content.findByIdAndDelete(id);
  if (!content) throw new Error('Content not found');

  await redisClient.del(`content:${id}`);
  await esClient.deleteDocument('content', id);

  return content;
};

export const updateContentStatus = async (id: string, status: ContentStatus | string, user: RequestUser): Promise<ContentDocument> => {
  const content = await Content.findById(id);
  if (!content) throw new Error('Content not found');

  content.status = status as ContentStatus;
  if (status === ContentStatus.PUBLISHED && !content.publishedAt) {
    content.publishedAt = new Date();
  }

  const updated = await content.save();
  await redisClient.set(`content:${id}`, updated, 3600);
  await esClient.indexDocument('content', id, updated);

  return updated;
};

export const incrementViewCount = async (id: string): Promise<number> => {
  const content = await Content.findByIdAndUpdate(
    id,
    { $inc: { viewCount: 1 } },
    { new: true }
  );

  if (!content) throw new Error('Content not found');

  await redisClient.set(`content:${id}`, content, 3600);
  return content.viewCount || 0;
};

export const getAllCategories = async (): Promise<CategoryDocument[]> => {
  const cacheKey = 'content:categories';
  const cached = await redisClient.get(cacheKey);
  if (cached) return cached;

  const categories = await Category.find().sort({ name: 1 });
  await redisClient.set(cacheKey, categories, 3600);
  return categories;
};

export const createCategory = async (data: Partial<CategoryDocument>): Promise<CategoryDocument> => {
  if (!data.slug && data.name) {
    data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  const category = new Category(data);
  const saved = await category.save();

  await redisClient.del('content:categories');
  return saved;
};

export const searchContent = async (query: string): Promise<ContentDocument[]> => {
  const esQuery = {
    query: {
      multi_match: {
        query,
        fields: ['title^3', 'body', 'tags', 'author.name']
      }
    }
  };

  const result = await esClient.search('content', esQuery);
  return result.hits.map((hit: any) => hit._source);
};
