import mongoose from 'mongoose';
import videoService from '../../services/video.service.js';
import Video from '../../models/Video.js';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Set longer timeout for all tests in this file
jest.setTimeout(30000);
// Create a manual mock for the logger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};
// Mock the video service's internal dependencies manually
const mockCreateServiceLogger = jest.fn().mockReturnValue(mockLogger);
describe('Video Service', () => {
    const mockVideoData = {
        title: 'Test Video',
        description: 'This is a test video',
        url: 'https://example.com/test-video.mp4',
        thumbnailUrl: 'https://example.com/test-thumbnail.jpg',
        duration: 120,
        fileSize: 1024 * 1024 * 10, // 10MB
        resolution: {
            width: 1920,
            height: 1080,
        },
        format: 'mp4',
        category: 'Test Category',
        tags: ['test', 'video', 'sample'],
        author: {
            id: '123456789012345678901234',
            name: 'Test User',
            email: 'test@example.com',
        },
        videoProvider: 'internal',
        slug: 'test-video'
    };
    afterEach(async () => {
        await Video.deleteMany({});
    });
    describe('createVideo', () => {
        it('should create a new video', async () => {
            const video = await videoService.createVideo(mockVideoData);
            expect(video._id).toBeDefined();
            expect(video.title).toBe(mockVideoData.title);
            expect(video.slug).toBe('test-video');
            expect(video.status).toBe('draft');
            expect(video.viewCount).toBe(0);
        });
        it('should generate a unique slug if one already exists', async () => {
            // Create first video
            await videoService.createVideo(mockVideoData);
            // Create second video with same title but add a timestamp to make it unique
            const secondVideoData = {
                ...mockVideoData,
                title: `${mockVideoData.title} (Copy)`,
            };
            const secondVideo = await videoService.createVideo(secondVideoData);
            expect(secondVideo.slug).not.toBe('test-video');
            expect(secondVideo.slug).toBe('test-video-copy');
        });
        it('should set default values for engagement metrics', async () => {
            const video = await videoService.createVideo(mockVideoData);
            expect(video.viewCount).toBe(0);
            expect(video.likeCount).toBe(0);
            expect(video.dislikeCount).toBe(0);
            expect(video.commentCount).toBe(0);
            expect(video.shareCount).toBe(0);
        });
    });
    describe('getVideos', () => {
        beforeEach(async () => {
            // Create test videos
            await Video.create([
                {
                    ...mockVideoData,
                    slug: 'test-video-1',
                    title: 'Test Video 1',
                    status: 'published',
                },
                {
                    ...mockVideoData,
                    slug: 'test-video-2',
                    title: 'Test Video 2',
                    category: 'Another Category',
                },
                {
                    ...mockVideoData,
                    slug: 'test-video-3',
                    title: 'Test Video 3',
                    tags: ['another', 'tag'],
                    status: 'archived',
                },
            ]);
        });
        it('should return paginated videos list', async () => {
            const result = await videoService.getVideos({}, { page: 1, limit: 2 });
            expect(result.videos.length).toBe(2);
            expect(result.totalVideos).toBe(3);
            expect(result.totalPages).toBe(2);
            expect(result.currentPage).toBe(1);
            expect(result.videosPerPage).toBe(2);
        });
        it('should filter videos by category', async () => {
            const result = await videoService.getVideos({ category: 'Another Category' });
            expect(result.videos.length).toBe(1);
            expect(result.videos[0].title).toBe('Test Video 2');
        });
        it('should filter videos by status', async () => {
            const result = await videoService.getVideos({ status: 'published' });
            expect(result.videos.length).toBe(1);
            expect(result.videos[0].title).toBe('Test Video 1');
        });
        it('should filter videos by tags', async () => {
            const result = await videoService.getVideos({ tags: ['another'] });
            expect(result.videos.length).toBe(1);
            expect(result.videos[0].title).toBe('Test Video 3');
        });
        it('should search videos by title', async () => {
            const result = await videoService.getVideos({ search: 'Video 2' });
            expect(result.videos.length).toBe(1);
            expect(result.videos[0].title).toBe('Test Video 2');
        });
    });
    describe('getVideoById', () => {
        let videoId;
        beforeEach(async () => {
            const video = await Video.create(mockVideoData);
            videoId = video._id.toString();
        });
        it('should return video by ID', async () => {
            const video = await videoService.getVideoById(videoId);
            expect(video).not.toBeNull();
            expect(video?._id.toString()).toBe(videoId);
            expect(video?.title).toBe(mockVideoData.title);
        });
        it('should return null if video not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            const video = await videoService.getVideoById(nonExistentId);
            expect(video).toBeNull();
        });
    });
    describe('getVideoBySlug', () => {
        beforeEach(async () => {
            await Video.create(mockVideoData);
        });
        it('should return video by slug', async () => {
            const video = await videoService.getVideoBySlug('test-video');
            expect(video).not.toBeNull();
            expect(video?.title).toBe(mockVideoData.title);
        });
        it('should return null if video not found by slug', async () => {
            const video = await videoService.getVideoBySlug('non-existent-slug');
            expect(video).toBeNull();
        });
    });
    describe('updateVideo', () => {
        let videoId;
        beforeEach(async () => {
            const video = await Video.create(mockVideoData);
            videoId = video._id.toString();
        });
        it('should update video', async () => {
            const updateData = {
                title: 'Updated Title',
                description: 'Updated description',
            };
            const updatedVideo = await videoService.updateVideo(videoId, updateData);
            expect(updatedVideo).not.toBeNull();
            expect(updatedVideo?.title).toBe(updateData.title);
            expect(updatedVideo?.description).toBe(updateData.description);
            expect(updatedVideo?.slug).toBe('updated-title');
        });
        it('should return null if video not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            const updatedVideo = await videoService.updateVideo(nonExistentId, { title: 'New Title' });
            expect(updatedVideo).toBeNull();
        });
        it('should set publishedAt when status is updated to published', async () => {
            const updateData = {
                status: 'published',
            };
            const updatedVideo = await videoService.updateVideo(videoId, updateData);
            expect(updatedVideo).not.toBeNull();
            expect(updatedVideo?.status).toBe('published');
            expect(updatedVideo?.publishedAt).toBeDefined();
        });
        it('should generate a unique slug if title is updated and slug already exists', async () => {
            // Create another video
            await Video.create({
                ...mockVideoData,
                title: 'Another Video',
                slug: 'another-video',
            });
            // Update first video to have the same title as second
            const updatedVideo = await videoService.updateVideo(videoId, { title: 'Another Video' });
            expect(updatedVideo).not.toBeNull();
            expect(updatedVideo?.title).toBe('Another Video');
            expect(updatedVideo?.slug).not.toBe('another-video');
            expect(updatedVideo?.slug?.startsWith('another-video-')).toBe(true);
        });
    });
    describe('deleteVideo', () => {
        let videoId;
        beforeEach(async () => {
            const video = await Video.create(mockVideoData);
            videoId = video._id.toString();
        });
        it('should delete video', async () => {
            const deletedVideo = await videoService.deleteVideo(videoId);
            expect(deletedVideo).not.toBeNull();
            expect(deletedVideo?._id.toString()).toBe(videoId);
            const video = await Video.findById(videoId);
            expect(video).toBeNull();
        });
        it('should return null if video not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            const deletedVideo = await videoService.deleteVideo(nonExistentId);
            expect(deletedVideo).toBeNull();
        });
    });
    describe('incrementViewCount', () => {
        let videoId;
        beforeEach(async () => {
            const video = await Video.create(mockVideoData);
            videoId = video._id.toString();
        });
        it('should increment view count', async () => {
            const updatedVideo = await videoService.incrementViewCount(videoId);
            expect(updatedVideo).not.toBeNull();
            expect(updatedVideo?.viewCount).toBe(1);
            const updatedVideo2 = await videoService.incrementViewCount(videoId);
            expect(updatedVideo2?.viewCount).toBe(2);
        });
        it('should return null if video not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            const updatedVideo = await videoService.incrementViewCount(nonExistentId);
            expect(updatedVideo).toBeNull();
        });
    });
    describe('updateEngagementMetrics', () => {
        let videoId;
        beforeEach(async () => {
            const video = await Video.create(mockVideoData);
            videoId = video._id.toString();
        });
        it('should update engagement metrics', async () => {
            const metrics = {
                likeCount: 10,
                dislikeCount: 2,
                commentCount: 5,
                shareCount: 3,
            };
            const updatedVideo = await videoService.updateEngagementMetrics(videoId, metrics);
            expect(updatedVideo).not.toBeNull();
            expect(updatedVideo?.likeCount).toBe(10);
            expect(updatedVideo?.dislikeCount).toBe(2);
            expect(updatedVideo?.commentCount).toBe(5);
            expect(updatedVideo?.shareCount).toBe(3);
        });
        it('should update only specified metrics', async () => {
            const metrics = {
                likeCount: 10,
            };
            const updatedVideo = await videoService.updateEngagementMetrics(videoId, metrics);
            expect(updatedVideo).not.toBeNull();
            expect(updatedVideo?.likeCount).toBe(10);
            expect(updatedVideo?.dislikeCount).toBe(0);
            expect(updatedVideo?.commentCount).toBe(0);
            expect(updatedVideo?.shareCount).toBe(0);
        });
        it('should return null if video not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            const updatedVideo = await videoService.updateEngagementMetrics(nonExistentId, { likeCount: 10 });
            expect(updatedVideo).toBeNull();
        });
    });
    describe('getFeaturedVideos', () => {
        beforeEach(async () => {
            await Video.create([
                {
                    ...mockVideoData,
                    slug: 'test-video-1',
                    title: 'Featured Video 1',
                    status: 'published',
                    viewCount: 100,
                    isPrivate: false,
                },
                {
                    ...mockVideoData,
                    slug: 'test-video-2',
                    title: 'Featured Video 2',
                    status: 'published',
                    viewCount: 50,
                    isPrivate: false,
                },
                {
                    ...mockVideoData,
                    slug: 'test-video-3',
                    title: 'Private Video',
                    status: 'published',
                    viewCount: 200,
                    isPrivate: true,
                },
                {
                    ...mockVideoData,
                    slug: 'test-video-4',
                    title: 'Draft Video',
                    status: 'draft',
                    viewCount: 300,
                    isPrivate: false,
                },
            ]);
        });
        it('should return featured videos sorted by view count', async () => {
            const videos = await videoService.getFeaturedVideos(2);
            expect(videos.length).toBe(2);
            expect(videos[0].title).toBe('Featured Video 1');
            expect(videos[1].title).toBe('Featured Video 2');
        });
        it('should only return published and non-private videos', async () => {
            const videos = await videoService.getFeaturedVideos(5);
            expect(videos.length).toBe(2);
            expect(videos.some(v => v.title === 'Private Video')).toBe(false);
            expect(videos.some(v => v.title === 'Draft Video')).toBe(false);
        });
    });
    describe('getRelatedVideos', () => {
        let videoId;
        beforeEach(async () => {
            // Create a main video
            const mainVideo = await Video.create({
                ...mockVideoData,
                title: 'Main Video',
                slug: 'main-video',
                category: 'Test Category',
                tags: ['test', 'main', 'video'],
                status: 'published',
                isPrivate: false,
            });
            videoId = mainVideo._id.toString();
            // Create related videos
            await Video.create([
                {
                    ...mockVideoData,
                    title: 'Same Category Video',
                    slug: 'same-category-video',
                    category: 'Test Category',
                    tags: ['other', 'tags'],
                    status: 'published',
                    isPrivate: false,
                },
                {
                    ...mockVideoData,
                    title: 'Same Tags Video',
                    slug: 'same-tags-video',
                    category: 'Other Category',
                    tags: ['test', 'other'],
                    status: 'published',
                    isPrivate: false,
                },
                {
                    ...mockVideoData,
                    title: 'Private Video',
                    slug: 'private-video',
                    category: 'Test Category',
                    tags: ['test'],
                    status: 'published',
                    isPrivate: true,
                },
                {
                    ...mockVideoData,
                    title: 'Draft Video',
                    slug: 'draft-video',
                    category: 'Test Category',
                    tags: ['test'],
                    status: 'draft',
                    isPrivate: false,
                },
            ]);
        });
        it('should return related videos based on category and tags', async () => {
            const videos = await videoService.getRelatedVideos(videoId);
            expect(videos.length).toBe(2);
            expect(videos.some(v => v.title === 'Same Category Video')).toBe(true);
            expect(videos.some(v => v.title === 'Same Tags Video')).toBe(true);
        });
        it('should only return published and non-private videos', async () => {
            const videos = await videoService.getRelatedVideos(videoId);
            expect(videos.some(v => v.title === 'Private Video')).toBe(false);
            expect(videos.some(v => v.title === 'Draft Video')).toBe(false);
        });
        it('should return empty array if video not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            const videos = await videoService.getRelatedVideos(nonExistentId);
            expect(videos).toEqual([]);
        });
    });
});
