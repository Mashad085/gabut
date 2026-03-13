import { cache } from '../db/redis.js';

const RATE_LIMITS = {
  default: { max: 100, window: 60 },
  auth: { max: 10, window: 300 },
  transactions: { max: 50, window: 60 },
};

export const rateLimiter = async (ctx, next) => {
  const ip = ctx.ip;
  const path = ctx.path;
  
  let limit = RATE_LIMITS.default;
  if (path.includes('/auth')) limit = RATE_LIMITS.auth;
  if (path.includes('/transactions')) limit = RATE_LIMITS.transactions;
  
  const key = `ratelimit:${ip}:${path.split('/')[3] || 'default'}`;
  const count = await cache.increment(key, limit.window);
  
  ctx.set('X-RateLimit-Limit', limit.max);
  ctx.set('X-RateLimit-Remaining', Math.max(0, limit.max - count));
  
  if (count > limit.max) {
    ctx.status = 429;
    ctx.body = {
      error: 'Too many requests',
      retry_after: limit.window,
    };
    return;
  }
  
  await next();
};
