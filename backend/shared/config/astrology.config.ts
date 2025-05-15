/**
 * Astrology configuration for the Corp Astro platform
 * This file contains configuration settings for the Astro Engine and Astro Ratan services
 */

export interface AstrologyConfig {
  astroEngine: {
    url: string;
    apiKey?: string;
    defaultZodiacSystem: 'tropical' | 'sidereal';
    defaultHouseSystem: string;
    defaultAyanamsa?: string;
    cacheEnabled: boolean;
    cacheTTL: number; // in seconds
  };
  astroRatan: {
    url: string;
    apiKey?: string;
    modelVersion: string;
    maxTokens: number;
    temperature: number;
    defaultLanguage: string;
  };
}

// Default configuration values
const defaultConfig: AstrologyConfig = {
  astroEngine: {
    url: process.env.ASTRO_ENGINE_URL || 'http://localhost:3004',
    apiKey: process.env.ASTRO_ENGINE_API_KEY,
    defaultZodiacSystem: 'sidereal',
    defaultHouseSystem: 'whole-sign',
    defaultAyanamsa: 'lahiri',
    cacheEnabled: true,
    cacheTTL: 3600 // 1 hour
  },
  astroRatan: {
    url: process.env.ASTRO_RATAN_URL || 'http://localhost:3005',
    apiKey: process.env.ASTRO_RATAN_API_KEY,
    modelVersion: process.env.ASTRO_RATAN_MODEL_VERSION || 'v1.0',
    maxTokens: parseInt(process.env.ASTRO_RATAN_MAX_TOKENS || '2048', 10),
    temperature: parseFloat(process.env.ASTRO_RATAN_TEMPERATURE || '0.7'),
    defaultLanguage: process.env.ASTRO_RATAN_DEFAULT_LANGUAGE || 'en'
  }
};

export default defaultConfig;
