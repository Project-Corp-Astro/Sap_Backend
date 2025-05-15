# Content Service

The Content Service is responsible for managing media and video content in the SAP platform. It provides APIs for creating, retrieving, updating, and deleting content items, as well as specialized operations like incrementing view counts and managing engagement metrics.

## Features

- **Media Management**: Create, retrieve, update, and delete media items
- **Video Management**: Create, retrieve, update, and delete video items
- **Content Filtering**: Filter content by various criteria like category, tags, status, etc.
- **Pagination**: Paginate results for better performance
- **Engagement Tracking**: Track views, downloads, likes, dislikes, comments, and shares
- **Performance Optimizations**: Caching for frequently accessed data
- **Performance Monitoring**: Track cache effectiveness, response times, and database query performance
- **Centralized Logging**: Consistent logging across all services with structured formats

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Database**: MongoDB (via Mongoose)
- **Testing**: Jest

## Performance Optimizations

The Content Service includes several performance optimizations to improve response times and reduce database load:

### Caching System

We've implemented an in-memory caching system that stores frequently accessed data to reduce database queries. The cache is automatically invalidated when data is modified to ensure consistency.

Key features of the caching system:

- **Time-to-Live (TTL)**: Cache entries expire after a configurable time period
- **Automatic Invalidation**: Cache entries are invalidated when related data is modified
- **Partial Updates**: Some operations update cached data instead of invalidating it
- **Memory Management**: Expired entries are automatically cleaned up

### Cached Operations

The following operations use caching for improved performance:

#### Media Service

- `getMediaById`: Caches media items by ID
- `getMediaBySlug`: Caches media items by slug
- `getMediaByType`: Caches media lists by type

#### Video Service

- `getVideoById`: Caches video items by ID
- `getVideoBySlug`: Caches video items by slug
- `getFeaturedVideos`: Caches featured video lists
- `getRelatedVideos`: Caches related video lists

### Cache Invalidation

The cache is automatically invalidated in the following scenarios:

- When a media or video item is created
- When a media or video item is updated
- When a media or video item is deleted
- When a media or video item's status is changed
- When engagement metrics are updated

## API Endpoints

### Media Endpoints

- `GET /api/media`: Get all media with filtering and pagination
- `GET /api/media/:id`: Get media by ID
- `GET /api/media/slug/:slug`: Get media by slug
- `GET /api/media/type/:type`: Get media by type
- `POST /api/media`: Create new media
- `PUT /api/media/:id`: Update media
- `DELETE /api/media/:id`: Delete media
- `PATCH /api/media/:id/status`: Update media status
- `PATCH /api/media/:id/view`: Increment view count
- `PATCH /api/media/:id/download`: Increment download count

### Video Endpoints

- `GET /api/videos`: Get all videos with filtering and pagination
- `GET /api/videos/:id`: Get video by ID
- `GET /api/videos/slug/:slug`: Get video by slug
- `GET /api/videos/featured`: Get featured videos
- `GET /api/videos/:id/related`: Get related videos
- `POST /api/videos`: Create new video
- `PUT /api/videos/:id`: Update video
- `DELETE /api/videos/:id`: Delete video
- `PATCH /api/videos/:id/view`: Increment view count
- `PATCH /api/videos/:id/engagement`: Update engagement metrics

## Development

### Prerequisites

- Node.js 14+
- npm or yarn
- MongoDB

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Start development server
npm run dev

# Start production server
npm start
```

### Environment Variables

- `PORT`: Server port (default: 3003)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT authentication
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `LOG_FILE_PATH`: Path for log files (default: logs/content-service.log)
- `MAX_CACHE_SIZE`: Maximum number of items in the cache (default: 1000)
- `CACHE_TTL`: Time-to-live for cache items in seconds (default: 3600)

## Testing

The service includes comprehensive test coverage using Jest. Run tests with:

```bash
npm test
```

## TypeScript Migration

This service has been fully migrated to TypeScript, providing better type safety, improved code quality, and better developer experience. The migration included:

1. Converting all JavaScript files to TypeScript
2. Adding proper interfaces and type definitions
3. Implementing proper error handling with type checking
4. Ensuring compatibility with existing APIs

## Performance Monitoring

The Content Service now includes a comprehensive performance monitoring system that tracks:

- **Cache Effectiveness**: Hit/miss rates for the caching system
- **Response Times**: Timing for all API requests
- **Database Performance**: Query execution times and optimization metrics
- **System Resources**: CPU and memory usage tracking

### Monitoring Endpoints

- `GET /api/monitoring/metrics`: Get current performance metrics
- `GET /api/monitoring/health`: Check service health status
- `POST /api/monitoring/metrics/reset`: Reset performance metrics

## Centralized Logging

We've implemented a shared logging utility (`@sap/logger`) that provides:

- **Structured Logging**: Consistent log format across all services
- **Log Levels**: Different levels (debug, info, warn, error) for better filtering
- **Transport Options**: Console and file logging with rotation
- **Request Logging**: HTTP request logging with customizable format
- **Error Logging**: Detailed error logging with stack traces

## Performance Considerations

When working with the Content Service, keep these performance considerations in mind:

1. **Use Pagination**: Always use pagination when retrieving lists of items
2. **Minimize Fields**: Use projection to retrieve only the fields you need
3. **Leverage Caching**: Frequently accessed data is automatically cached
4. **Batch Operations**: Group related operations when possible
5. **Avoid Deep Nesting**: Keep document structures relatively flat for better performance
6. **Monitor Performance**: Use the monitoring endpoints to track performance metrics
