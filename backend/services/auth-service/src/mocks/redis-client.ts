/**
 * Redis client interface with proper TypeScript types
 */

interface RedisClient {
  set(key: string, value: string, option?: string, expiry?: number): Promise<string>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  quit(): Promise<string>;
}

const redisClient: RedisClient = {
  set: (key, value, option, expiry) => Promise.resolve('OK'),
  get: (key) => Promise.resolve(null),
  del: (key) => Promise.resolve(1),
  exists: (key) => Promise.resolve(0),
  expire: (key, seconds) => Promise.resolve(1),
  quit: () => Promise.resolve('OK'),
};

export default redisClient;
