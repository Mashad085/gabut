import Redis from 'ioredis';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  lazyConnect: false,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => console.log('Redis: connected'));
redis.on('error',   (err) => console.error('Redis error:', err.message));

export const cache = {
  async get(key) {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  },
  async set(key, value, ttlSeconds = 300) {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },
  async del(key) {
    await redis.del(key);
  },
  async delPattern(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  },
  async exists(key) {
    return await redis.exists(key);
  },
  async setSession(sessionId, data, ttl = 86400) {
    await this.set(`session:${sessionId}`, data, ttl);
  },
  async getSession(sessionId) {
    return this.get(`session:${sessionId}`);
  },
  async destroySession(sessionId) {
    await this.del(`session:${sessionId}`);
  },
  async blacklistToken(token, ttl) {
    await redis.setex(`blacklist:${token}`, ttl, '1');
  },
  async isBlacklisted(token) {
    return await redis.exists(`blacklist:${token}`);
  },
  async increment(key, ttl) {
    const multi = redis.multi();
    multi.incr(key);
    multi.expire(key, ttl);
    const results = await multi.exec();
    return results[0][1];
  },
};

export default redis;
