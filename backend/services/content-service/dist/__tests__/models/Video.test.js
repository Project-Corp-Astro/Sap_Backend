import Video from '../../models/Video.js';
import { jest, describe, it, expect, afterEach } from '@jest/globals';
// Set longer timeout for all tests in this file
jest.setTimeout(30000);
describe('Video Model', () => {
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
    };
    afterEach(async () => {
        await Video.deleteMany({});
    });
    it('should create a new video successfully', async () => {
        const video = new Video(mockVideoData);
        const savedVideo = await video.save();
        expect(savedVideo._id).toBeDefined();
        expect(savedVideo.title).toBe(mockVideoData.title);
        expect(savedVideo.description).toBe(mockVideoData.description);
        expect(savedVideo.url).toBe(mockVideoData.url);
        expect(savedVideo.slug).toBe('test-video');
        expect(savedVideo.status).toBe('draft');
        expect(savedVideo.viewCount).toBe(0);
        expect(savedVideo.likeCount).toBe(0);
        expect(savedVideo.dislikeCount).toBe(0);
        expect(savedVideo.commentCount).toBe(0);
        expect(savedVideo.shareCount).toBe(0);
    });
    it('should not create video without required fields', async () => {
        const videoWithoutTitle = new Video({
            ...mockVideoData,
            title: undefined,
        });
        await expect(videoWithoutTitle.save()).rejects.toThrow();
        const videoWithoutDescription = new Video({
            ...mockVideoData,
            description: undefined,
        });
        await expect(videoWithoutDescription.save()).rejects.toThrow();
        const videoWithoutUrl = new Video({
            ...mockVideoData,
            url: undefined,
        });
        await expect(videoWithoutUrl.save()).rejects.toThrow();
    });
    it('should generate a slug from the title', async () => {
        const video = new Video({
            ...mockVideoData,
            title: 'This is a Test Title with Spaces and Punctuation!',
        });
        const savedVideo = await video.save();
        expect(savedVideo.slug).toBe('this-is-a-test-title-with-spaces-and-punctuation');
    });
    it('should set publishedAt when status is changed to published', async () => {
        const video = new Video(mockVideoData);
        await video.save();
        expect(video.publishedAt).toBeUndefined();
        video.status = 'published';
        await video.save();
        expect(video.publishedAt).toBeDefined();
        expect(video.publishedAt instanceof Date).toBe(true);
    });
    it('should enforce unique slugs', async () => {
        const video1 = new Video(mockVideoData);
        await video1.save();
        const video2 = new Video({
            ...mockVideoData,
            title: 'Test Video', // Same title will generate same slug
        });
        await expect(video2.save()).rejects.toThrow();
    });
    it('should handle video provider options', async () => {
        const youtubeVideo = new Video({
            ...mockVideoData,
            videoProvider: 'youtube',
            videoId: 'abc123',
        });
        const savedYoutubeVideo = await youtubeVideo.save();
        expect(savedYoutubeVideo.videoProvider).toBe('youtube');
        expect(savedYoutubeVideo.videoId).toBe('abc123');
        const vimeoVideo = new Video({
            ...mockVideoData,
            title: 'Vimeo Video',
            videoProvider: 'vimeo',
            videoId: 'def456',
        });
        const savedVimeoVideo = await vimeoVideo.save();
        expect(savedVimeoVideo.videoProvider).toBe('vimeo');
        expect(savedVimeoVideo.videoId).toBe('def456');
    });
    it('should validate video status values', async () => {
        const validStatuses = ['draft', 'published', 'archived', 'pending_review', 'rejected'];
        for (const status of validStatuses) {
            const video = new Video({
                ...mockVideoData,
                title: `${status} Video`,
                status,
            });
            const savedVideo = await video.save();
            expect(savedVideo.status).toBe(status);
        }
        const videoWithInvalidStatus = new Video({
            ...mockVideoData,
            status: 'invalid_status',
        });
        await expect(videoWithInvalidStatus.save()).rejects.toThrow();
    });
    it('should handle captions array', async () => {
        const videoWithCaptions = new Video({
            ...mockVideoData,
            captions: [
                {
                    language: 'en',
                    url: 'https://example.com/captions-en.vtt',
                },
                {
                    language: 'es',
                    url: 'https://example.com/captions-es.vtt',
                },
            ],
        });
        const savedVideo = await videoWithCaptions.save();
        expect(savedVideo.captions).toHaveLength(2);
        expect(savedVideo.captions?.[0].language).toBe('en');
        expect(savedVideo.captions?.[1].language).toBe('es');
    });
});
