import { ContentStatus } from '../../interfaces/content.interfaces.js';
import { jest } from '@jest/globals';
import { VideoDocument, VideoResponse } from '../types/jest-mock.js';

// Create a mock video object
export const mockVideo = {
  _id: '123456789012345678901234',
  title: 'Test Video',
  description: 'Test Description',
  url: 'https://example.com/test-video.mp4',
  slug: 'test-video',
  status: ContentStatus.PUBLISHED,
  duration: 120,
  videoProvider: 'youtube',
  videoId: 'abc123',
  category: 'Test',
  tags: ['test'],
  author: {
    id: '123456789012345678901234',
    name: 'Test User',
    email: 'test@example.com'
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  publishedAt: new Date(),
  viewCount: 0,
  likeCount: 0,
  dislikeCount: 0,
  commentCount: 0,
  shareCount: 0,
  captions: [
    {
      language: 'en',
      url: 'https://example.com/captions-en.vtt'
    }
  ]
} as VideoDocument;

// Create mock video service functions
export const createVideo = jest.fn().mockImplementation((data: any) => Promise.resolve(mockVideo));
export const getVideos = jest.fn().mockImplementation(() => Promise.resolve({
  videos: [mockVideo],
  totalCount: 1,
  page: 1,
  limit: 10
} as VideoResponse));
export const getVideoById = jest.fn().mockImplementation((id: string) => Promise.resolve(mockVideo));
export const getVideoBySlug = jest.fn().mockImplementation((slug: string) => Promise.resolve(mockVideo));
export const updateVideo = jest.fn().mockImplementation((id: string, data: any) => Promise.resolve({
  ...mockVideo,
  title: 'Updated Video',
  description: 'Updated Description'
} as VideoDocument));
export const deleteVideo = jest.fn().mockImplementation((id: string) => Promise.resolve(mockVideo));
export const incrementViewCount = jest.fn().mockImplementation((id: string) => Promise.resolve({
  ...mockVideo,
  viewCount: 1
} as VideoDocument));
export const updateEngagementMetrics = jest.fn().mockImplementation((id: string, metrics: any) => Promise.resolve({
  ...mockVideo,
  likeCount: 1,
  commentCount: 1
} as VideoDocument));
export const getFeaturedVideos = jest.fn().mockImplementation((limit: number) => Promise.resolve([mockVideo]));
export const getRelatedVideos = jest.fn().mockImplementation((videoId: string, limit: number) => Promise.resolve([mockVideo]));

// Export the mock service
const videoService = {
  createVideo,
  getVideos,
  getVideoById,
  getVideoBySlug,
  updateVideo,
  deleteVideo,
  incrementViewCount,
  updateEngagementMetrics,
  getFeaturedVideos,
  getRelatedVideos
};

export default videoService;
