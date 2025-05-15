# Corp Astro - Shared Types and Configuration

This directory contains shared types and configuration files used across the Corp Astro platform's microservices architecture.

## Overview

The Corp Astro platform is a modern dashboard and calendar application for astrology content management with a microservices architecture. It uses React with TypeScript for the frontend and Node.js/Express microservices for the backend.

## Directory Structure

- `types/` - Contains shared TypeScript definitions used across services
  - `astrology/` - Astrology-specific type definitions
- `config/` - Contains shared configuration files

## Astrology Types

The shared astrology types include:

- Zodiac signs and planets
- Chart types and house systems
- Astrological calculation interfaces
- Prediction and report interfaces
- Astro Engine and Astro Ratan service interfaces

## Usage

To use these shared types in a service, import them directly:

```typescript
// Import specific types
import { ZodiacSign, ChartType, AstrologyChart } from '../../shared/types/astrology';

// Import configuration
import astrologyConfig from '../../shared/config/astrology.config';
```

## TypeScript Migration

The TypeScript migration for the API Gateway and other services has been completed. The migration includes:

1. Converting JavaScript files to TypeScript
2. Adding proper type definitions for all services
3. Creating shared types for astrology-specific data structures
4. Ensuring compatibility between services

## Microservices

The backend consists of the following microservices:

1. **API Gateway** - Routes requests to various microservices
2. **Auth Service** - Handles authentication and authorization
3. **User Service** - Manages user profiles and preferences
4. **Content Service** - Manages astrology content and horoscopes
5. **Astro Engine** - Generates astrological charts and calculations
6. **Astro Ratan** - AI-powered astrological insights and predictions

## Environment Variables

Each service uses environment variables for configuration. The shared configuration files provide default values that can be overridden by environment variables.

## Dependencies

The project requires the following supporting services:

- MongoDB - Database for storing user data and content
- Redis - Caching and session management
- RabbitMQ - Message queue for inter-service communication
