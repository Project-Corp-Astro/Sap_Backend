import { jest } from '@jest/globals';
import { MediaType } from '../../interfaces/media.interfaces.js';
import { ContentStatus } from '../../interfaces/content.interfaces.js';
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
};
// Create mock media service functions
export const createMedia = jest.fn().mockImplementation((data) => Promise.resolve(mockMedia));
export const getAllMedia = jest.fn().mockImplementation((filters, page, limit, sortBy, sortOrder) => Promise.resolve({
    data: [mockMedia],
    totalCount: 1,
    page: 1,
    limit: 10
}));
export const getMediaById = jest.fn().mockImplementation((id) => Promise.resolve(mockMedia));
export const getMediaBySlug = jest.fn().mockImplementation((slug) => Promise.resolve(mockMedia));
export const updateMedia = jest.fn().mockImplementation((id, data) => Promise.resolve({
    ...mockMedia,
    title: 'Updated Media',
    description: 'Updated Description'
}));
export const deleteMedia = jest.fn().mockImplementation((id) => Promise.resolve(mockMedia));
export const updateMediaStatus = jest.fn().mockImplementation((id, status) => Promise.resolve({
    ...mockMedia,
    status: ContentStatus.PUBLISHED
}));
export const incrementViewCount = jest.fn().mockImplementation((id) => Promise.resolve(1));
export const incrementDownloadCount = jest.fn().mockImplementation((id) => Promise.resolve(1));
export const getMediaByType = jest.fn().mockImplementation((type, limit) => Promise.resolve([mockMedia]));
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
