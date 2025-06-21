import { redisUtils, contentCache, categoryCache } from '../utils/redis';
import esClient from '../../../../shared/utils/elasticsearch';
import Content from '../models/Content';
import Category from '../models/Category';
import { ContentStatus } from '@corp-astro/shared-types';
import { RequestUser, ExtendedContent, ContentDocument, CategoryDocument } from '../interfaces/shared-types';

const logger = {
  info: (...args: any[]) => console.info('[Content Service]', ...args),
  error: (...args: any[]) => console.error('[Content Service]', ...args),
  warn: (...args: any[]) => console.warn('[Content Service]', ...args),
  debug: (...args: any[]) => console.debug('[Content Service]', ...args),
};

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

  // Cache content using redisUtils
  await redisUtils.set(`${saved._id}`, saved, 3600);
  await redisUtils.set(`slug:${saved.slug}`, saved, 3600);

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

export const getAllContent = async (
  filters = {},
  page = 1,
  limit = 10,
  sortBy = 'createdAt',
  sortOrder = 'desc'
) => {
  const cacheKey = `content:list:${JSON.stringify({ filters, page, limit, sortBy, sortOrder })}`;
  const cached = await redisUtils.get(cacheKey);
  if (cached) {
    logger.info('Served from Redis cache');
    return cached;
  }

  logger.info('Fetched from MongoDB');

  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const [items, totalItems] = await Promise.all([
    Content.find(filters).sort(sort).skip(skip).limit(limit),
    Content.countDocuments(filters)
  ]);

  const result = {
    items,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    currentPage: page,
    itemsPerPage: limit
  };

  // Cache the result
  await redisUtils.set(cacheKey, result, 1800); // Cache for 30 minutes
  return result;
};

export const getContentById = async (id: string): Promise<ContentDocument> => {
  const cacheKey = `${id}`;
  const cached = await redisUtils.get(cacheKey);
  if (cached) {
    logger.info('Served from Redis cache');
    return cached;
  }

  logger.info('Fetched from MongoDB');

  const content = await Content.findById(id);
  if (!content) throw new Error('Content not found');

  await redisUtils.set(cacheKey, content, 3600);
  return content;
};

export const getContentBySlug = async (slug: string): Promise<ContentDocument> => {
  const cacheKey = `slug:${slug}`;
  const cached = await redisUtils.get(cacheKey);
  if (cached) {
    logger.info('Served from Redis cache');
    return cached;
  }

  logger.info('Fetched from MongoDB');

  const content = await Content.findOne({ slug });
  if (!content) throw new Error('Content not found');

  await redisUtils.set(cacheKey, content, 3600);
  return content;
};

export const updateContent = async (
  id: string,
  updateData: Partial<ExtendedContent>,
  user: RequestUser
): Promise<ContentDocument> => {
  const content = await Content.findById(id);
  if (!content) throw new Error('Content not found');

  Object.assign(content, updateData);
  
  // Update slug if title changes
  if (updateData.title && !updateData.slug) {
    content.slug = updateData.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  const updated = await content.save();

  // Update caches
  await redisUtils.set(`${id}`, updated, 3600);
  await redisUtils.set(`slug:${updated.slug}`, updated, 3600);
  await esClient.indexDocument('content', id, updated);

  // Invalidate content list cache
  const keys = await contentCache.getClient().keys('content:list:*');
  if (keys.length > 0) {
    await contentCache.getClient().del(...keys);
  }

  return updated;
};

export const deleteContent = async (id: string, user: RequestUser): Promise<ContentDocument> => {
  const content = await Content.findById(id);
  if (!content) throw new Error('Content not found');

  await content.deleteOne();

  // Delete from caches
  await redisUtils.del(`${id}`);
  await redisUtils.del(`slug:${content.slug}`);
  await esClient.deleteDocument('content', id);

  // Invalidate content list cache
  const keys = await contentCache.getClient().keys('content:list:*');
  if (keys.length > 0) {
    await contentCache.getClient().del(...keys);
  }

  return content;
};

export const updateContentStatus = async (
  id: string,
  status: ContentStatus | string,
  user: RequestUser
): Promise<ContentDocument> => {
  const content = await Content.findById(id);
  if (!content) throw new Error('Content not found');

  content.status = status as ContentStatus;
  if (status === ContentStatus.PUBLISHED && !content.publishedAt) {
    content.publishedAt = new Date();
  }

  const updated = await content.save();

  // Update caches
  await redisUtils.set(`${id}`, updated, 3600);
  await redisUtils.set(`slug:${updated.slug}`, updated, 3600);
  await esClient.indexDocument('content', id, updated);

  // Invalidate content list cache
  const keys = await contentCache.getClient().keys('content:list:*');
  if (keys.length > 0) {
    await contentCache.getClient().del(...keys);
  }

  return updated;
};

export const incrementViewCount = async (id: string): Promise<number> => {
  const content = await Content.findByIdAndUpdate(
    id,
    { $inc: { viewCount: 1 } },
    { new: true }
  );

  if (!content) throw new Error('Content not found');

  // Update caches
  await redisUtils.set(`${id}`, content, 3600);
  await redisUtils.set(`slug:${content.slug}`, content, 3600);

  return content.viewCount || 0;
};

export const getAllCategories = async (): Promise<CategoryDocument[]> => {
  const cacheKey = 'categories';
  const cached = await redisUtils.get(cacheKey);
  if (cached) {
    logger.info('Served from Redis cache');
    return cached;
  }

  logger.info('Fetched from MongoDB');

  const categories = await Category.find().sort({ name: 1 });
  await redisUtils.set(cacheKey, categories, 3600);
  return categories;
};

export const createCategory = async (data: Partial<CategoryDocument>): Promise<CategoryDocument> => {
  if (!data.slug && data.name) {
    data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  const category = new Category(data);
  const saved = await category.save();

  // Invalidate categories cache
  await redisUtils.del('categories');

  // Cache the new category
  await redisUtils.cacheCategory(saved._id.toString(), saved, 3600);

  return saved;
};

export const searchContent = async (query: string): Promise<ContentDocument[]> => {
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = await redisUtils.get(cacheKey);
  if (cached) {
    logger.info('Served from Redis cache');
    return cached;
  }

  logger.info('Searching Elasticsearch');

  const esQuery = {
    query: {
      multi_match: {
        query,
        fields: ['title^3', 'body', 'tags', 'author.name']
      }
    }
  };

  const result = await esClient.search('content', esQuery);
  const items = result.hits.map((hit: any) => hit._source);

  // Cache search results
  await redisUtils.set(cacheKey, items, 900); // Cache for 15 minutes
  return items;
};

export const getCategoryById = async (id: string): Promise<CategoryDocument> => {
  const cached = await redisUtils.getCachedCategory(id);
  if (cached) {
    logger.info('Served from Redis cache');
    return cached;
  }

  logger.info('Fetched from MongoDB');

  const category = await Category.findById(id);
  if (!category) throw new Error('Category not found');

  await redisUtils.cacheCategory(id, category, 3600);
  return category;
};

export const updateCategory = async (
  id: string,
  updateData: Partial<CategoryDocument>
): Promise<CategoryDocument> => {
  const category = await Category.findById(id);
  if (!category) throw new Error('Category not found');

  Object.assign(category, updateData);
  
  if (updateData.name && !updateData.slug) {
    category.slug = updateData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  const updated = await category.save();

  // Update category cache and invalidate categories list
  await redisUtils.cacheCategory(id, updated, 3600);
  await redisUtils.del('categories');

  return updated;
};

export const deleteCategory = async (id: string): Promise<CategoryDocument> => {
  const category = await Category.findById(id);
  if (!category) throw new Error('Category not found');

  await category.deleteOne();

  // Delete from cache and invalidate categories list
  await redisUtils.del(`category:${id}`);
  await redisUtils.del('categories');

  // Invalidate related content caches
  await redisUtils.invalidateCategoryCache(id);

  return category;
};