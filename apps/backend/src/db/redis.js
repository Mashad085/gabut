import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL, {
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: false,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => console.log('Redis: connected'));
redis.on('error', (err) => console.error('Redis error:', err));

// Cache helpers
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

  // Session management
  async setSession(sessionId, data, ttl = 86400) {
    await this.set(`session:${sessionId}`, data, ttl);
  },

  async getSession(sessionId) {
    return this.get(`session:${sessionId}`);
  },

  async destroySession(sessionId) {
    await this.del(`session:${sessionId}`);
  },

  // Blacklist tokens
  async blacklistToken(token, ttl) {
    await redis.setex(`blacklist:${token}`, ttl, '1');
  },

  async isBlacklisted(token) {
    return await redis.exists(`blacklist:${token}`);
  },

  // Rate limiting
  async increment(key, ttl) {
    const multi = redis.multi();
    multi.incr(key);
    multi.expire(key, ttl);
    const results = await multi.exec();
    return results[0][1];
  },
};

export default redis;
