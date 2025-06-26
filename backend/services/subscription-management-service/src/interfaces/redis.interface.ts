import { Redis as IORedis } from 'ioredis';

export interface RedisService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  deleteByPattern(pattern: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  close(): Promise<void>;
}

export interface RedisUtils {
  stats: {
    hits: number;
    misses: number;
  };
  redisService: RedisService;
  client: IORedis;
}
