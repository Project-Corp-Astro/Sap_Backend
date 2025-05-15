import { jest } from '@jest/globals';
import { MediaType } from '../../interfaces/media.interfaces.js';
import { ContentStatus } from '../../interfaces/content.interfaces.js';
import { MediaDocument, MediaResponse } from '../types/jest-mock.js';

// Create a mock media object
export const mockMedia = {
  _id: '123456789012345678901234',
  title: 'Test Media',
  description: 'Test Description',
  type: MediaType.IMAGE,
  url: 'https://example.com/test.jpg',
  slug: 'test-media',
  status: ContentStatus.PUBLISHED,
  fileSize: 1024,
  mimeType: 'image/jpeg',
  category: 'Test',
  tags: ['test'],
  author: {
    id: '123456789012345678901234',
    name: 'Test User',
    email: 'test@example.com'
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  viewCount: 0,
  downloadCount: 0
} as MediaDocument;

// Create mock media service functions
export const createMedia = jest.fn().mockImplementation((data: any) => Promise.resolve(mockMedia));

export const getAllMedia = jest.fn().mockImplementation((filters: any, page: number, limit: number, sortBy: string, sortOrder: string) => Promise.resolve({
  data: [mockMedia],
  totalCount: 1,
  page: 1,
  limit: 10
} as MediaResponse));

export const getMediaById = jest.fn().mockImplementation((id: string) => Promise.resolve(mockMedia));

export const getMediaBySlug = jest.fn().mockImplementation((slug: string) => Promise.resolve(mockMedia));

export const updateMedia = jest.fn().mockImplementation((id: string, data: any) => Promise.resolve({
  ...mockMedia,
  title: 'Updated Media',
  description: 'Updated Description'
} as MediaDocument));

export const deleteMedia = jest.fn().mockImplementation((id: string) => Promise.resolve(mockMedia));

export const updateMediaStatus = jest.fn().mockImplementation((id: string, status: ContentStatus) => Promise.resolve({
  ...mockMedia,
  status: ContentStatus.PUBLISHED
} as MediaDocument));

export const incrementViewCount = jest.fn().mockImplementation((id: string) => Promise.resolve(1));

export const incrementDownloadCount = jest.fn().mockImplementation((id: string) => Promise.resolve(1));

export const getMediaByType = jest.fn().mockImplementation((type: MediaType, limit: number) => Promise.resolve([mockMedia]));

// Export the mock service
const mediaService = {
  createMedia,
  getAllMedia,
  getMediaById,
  getMediaBySlug,
  updateMedia,
  deleteMedia,
  updateMediaStatus,
  incrementViewCount,
  incrementDownloadCount,
  getMediaByType
};

export default mediaService;
