import Media from '../../models/Media.js';
import { MediaType } from '../../interfaces/media.interfaces.js';
import { ContentStatus } from '../../interfaces/content.interfaces.js';
import { jest, describe, it, expect, afterEach } from '@jest/globals';
// Set longer timeout for all tests in this file
jest.setTimeout(30000);
describe('Media Model', () => {
    const mockMediaData = {
        title: 'Test Media',
        description: 'This is a test media item',
        type: MediaType.IMAGE,
        url: 'https://example.com/test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        category: 'Test Category',
        tags: ['test', 'media', 'image'],
        slug: 'test-media',
        author: {
            id: '123456789012345678901234',
            name: 'Test User',
            email: 'test@example.com',
        },
    };
    afterEach(async () => {
        await Media.deleteMany({});
    });
    it('should create a new media item successfully', async () => {
        const media = new Media(mockMediaData);
        const savedMedia = await media.save();
        expect(savedMedia._id).toBeDefined();
        expect(savedMedia.title).toBe(mockMediaData.title);
        expect(savedMedia.description).toBe(mockMediaData.description);
        expect(savedMedia.type).toBe(mockMediaData.type);
        expect(savedMedia.slug).toBe('test-media');
        expect(savedMedia.status).toBe(ContentStatus.DRAFT);
        expect(savedMedia.viewCount).toBe(0);
        expect(savedMedia.downloadCount).toBe(0);
    });
    it('should not create media without required fields', async () => {
        const mediaWithoutTitle = new Media({
            ...mockMediaData,
            title: undefined,
        });
        await expect(mediaWithoutTitle.save()).rejects.toThrow();
        const mediaWithoutDescription = new Media({
            ...mockMediaData,
            description: undefined,
        });
        await expect(mediaWithoutDescription.save()).rejects.toThrow();
    });
    it('should generate a slug from the title', async () => {
        const media = new Media({
            ...mockMediaData,
            title: 'This is a Test Title with Spaces and Punctuation!',
        });
        const savedMedia = await media.save();
        expect(savedMedia.slug).toBe('this-is-a-test-title-with-spaces-and-punctuation');
    });
    it('should set publishedAt when status is changed to published', async () => {
        const media = new Media(mockMediaData);
        await media.save();
        expect(media.publishedAt).toBeUndefined();
        media.status = ContentStatus.PUBLISHED;
        await media.save();
        expect(media.publishedAt).toBeDefined();
        expect(media.publishedAt instanceof Date).toBe(true);
    });
    it('should enforce unique slugs', async () => {
        const media1 = new Media(mockMediaData);
        await media1.save();
        const media2 = new Media({
            ...mockMediaData,
            title: 'Test Media', // Same title will generate same slug
        });
        await expect(media2.save()).rejects.toThrow();
    });
    it('should handle video-specific fields', async () => {
        const videoMedia = new Media({
            ...mockMediaData,
            type: MediaType.VIDEO,
            videoProvider: 'youtube',
            videoId: 'abc123',
            dimensions: {
                width: 1920,
                height: 1080,
                duration: 120,
            },
        });
        const savedMedia = await videoMedia.save();
        expect(savedMedia.videoProvider).toBe('youtube');
        expect(savedMedia.videoId).toBe('abc123');
        expect(savedMedia.dimensions?.duration).toBe(120);
    });
});
