/**
 * Shared type definitions for the Corp Astro platform
 * These types are used across all services to ensure consistency
 */

/**
 * Zodiac sign enumeration
 */
export enum ZodiacSign {
  ARIES = 'aries',
  TAURUS = 'taurus',
  GEMINI = 'gemini',
  CANCER = 'cancer',
  LEO = 'leo',
  VIRGO = 'virgo',
  LIBRA = 'libra',
  SCORPIO = 'scorpio',
  SAGITTARIUS = 'sagittarius',
  CAPRICORN = 'capricorn',
  AQUARIUS = 'aquarius',
  PISCES = 'pisces'
}

/**
 * Planet enumeration
 */
export enum Planet {
  SUN = 'sun',
  MOON = 'moon',
  MERCURY = 'mercury',
  VENUS = 'venus',
  MARS = 'mars',
  JUPITER = 'jupiter',
  SATURN = 'saturn',
  URANUS = 'uranus',
  NEPTUNE = 'neptune',
  PLUTO = 'pluto',
  NORTH_NODE = 'northNode',
  SOUTH_NODE = 'southNode',
  CHIRON = 'chiron',
  CERES = 'ceres',
  PALLAS = 'pallas',
  JUNO = 'juno',
  VESTA = 'vesta'
}

/**
 * House system enumeration
 */
export enum HouseSystem {
  WHOLE_SIGN = 'whole-sign',
  PLACIDUS = 'placidus',
  KOCH = 'koch',
  EQUAL = 'equal',
  PORPHYRY = 'porphyry',
  REGIOMONTANUS = 'regiomontanus',
  CAMPANUS = 'campanus',
  TOPOCENTRIC = 'topocentric'
}

/**
 * Zodiac system enumeration
 */
export enum ZodiacSystem {
  TROPICAL = 'tropical',
  SIDEREAL = 'sidereal'
}

/**
 * Ayanamsa (for sidereal calculations) enumeration
 */
export enum Ayanamsa {
  LAHIRI = 'lahiri',
  RAMAN = 'raman',
  KRISHNAMURTI = 'krishnamurti',
  FAGAN_BRADLEY = 'fagan_bradley',
  ALDEBARAN_15TAU = 'aldebaran_15tau',
  GALACTIC_CENTER_5SAG = 'galactic_center_5sag',
  JN_BHASIN = 'jn_bhasin',
  YUKTESHWAR = 'yukteshwar',
  TRUE_CHITRA = 'true_chitra'
}

/**
 * Chart type enumeration
 */
export enum ChartType {
  NATAL = 'natal',
  TRANSIT = 'transit',
  PROGRESSION = 'progression',
  SYNASTRY = 'synastry',
  COMPOSITE = 'composite',
  SOLAR_RETURN = 'solarReturn',
  LUNAR_RETURN = 'lunarReturn',
  DASHA = 'dasha'
}

/**
 * Aspect type enumeration
 */
export enum AspectType {
  CONJUNCTION = 'conjunction',
  OPPOSITION = 'opposition',
  TRINE = 'trine',
  SQUARE = 'square',
  SEXTILE = 'sextile',
  QUINCUNX = 'quincunx',
  SEMI_SEXTILE = 'semi-sextile',
  SEMI_SQUARE = 'semi-square',
  SESQUI_SQUARE = 'sesqui-square',
  QUINTILE = 'quintile',
  BI_QUINTILE = 'bi-quintile'
}

/**
 * Prediction type enumeration
 */
export enum PredictionType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  TRANSIT = 'transit',
  DASHA = 'dasha'
}

/**
 * Location interface for astrological calculations
 */
export interface Location {
  latitude: number;
  longitude: number;
  timezone: string;
  city?: string;
  country?: string;
}

/**
 * Planet position interface
 */
export interface PlanetPosition {
  planet: Planet;
  sign: ZodiacSign;
  degree: number;
  minute: number;
  second: number;
  house: number;
  retrograde: boolean;
  speed: number;
}

/**
 * House cusp interface
 */
export interface HouseCusp {
  house: number;
  sign: ZodiacSign;
  degree: number;
  minute: number;
  second: number;
}

/**
 * Aspect interface
 */
export interface Aspect {
  planet1: Planet;
  planet2: Planet;
  type: AspectType;
  orb: number;
  applying: boolean;
}

/**
 * Astrological chart interface
 */
export interface AstrologyChart {
  id: string;
  userId: string;
  name: string;
  chartType: ChartType;
  zodiacSystem: ZodiacSystem;
  houseSystem: HouseSystem;
  ayanamsa?: Ayanamsa;
  date: string; // ISO format
  time: string; // 24-hour format
  location: Location;
  planets: PlanetPosition[];
  houses: HouseCusp[];
  aspects: Aspect[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Business chart interface (extends AstrologyChart)
 */
export interface BusinessChart extends AstrologyChart {
  businessId: string;
  businessName: string;
  incorporationDate: string;
  industry: string;
  founders: string[];
}

/**
 * Astrological prediction interface
 */
export interface AstrologyPrediction {
  id: string;
  userId?: string;
  businessId?: string;
  chartId: string;
  type: PredictionType;
  startDate: string;
  endDate: string;
  content: string;
  highlights: string[];
  challenges: string[];
  opportunities: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Astro Engine calculation request interface
 */
export interface AstroEngineRequest {
  chartType: ChartType;
  zodiacSystem: ZodiacSystem;
  houseSystem: HouseSystem;
  ayanamsa?: Ayanamsa;
  date: string;
  time: string;
  location: Location;
  options?: {
    includePlanets?: Planet[];
    includeAspects?: boolean;
    includeHouses?: boolean;
    includeMidpoints?: boolean;
    includeArabicParts?: boolean;
    includeFixedStars?: boolean;
  };
}

/**
 * Astro Engine calculation response interface
 */
export interface AstroEngineResponse {
  success: boolean;
  chart?: AstrologyChart;
  error?: string;
  calculationTime?: number;
}

/**
 * Astro Ratan AI request interface
 */
export interface AstroRatanRequest {
  userId?: string;
  businessId?: string;
  chartId?: string;
  query: string;
  context?: {
    previousMessages?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    userProfile?: any;
    businessProfile?: any;
  };
  options?: {
    detailedAnalysis?: boolean;
    includeRemedies?: boolean;
    language?: string;
    maxTokens?: number;
  };
}

/**
 * Astro Ratan AI response interface
 */
export interface AstroRatanResponse {
  success: boolean;
  response: string;
  chartReferences?: {
    planets?: PlanetPosition[];
    houses?: HouseCusp[];
    aspects?: Aspect[];
  };
  recommendations?: string[];
  error?: string;
}
