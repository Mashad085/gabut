import jwt from 'jsonwebtoken';
import { cache } from '../db/redis.js';

export const authenticate = async (ctx, next) => {
  const authHeader = ctx.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    ctx.status = 401;
    ctx.body = { error: 'Authentication required' };
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  // Check blacklist
  const blacklisted = await cache.isBlacklisted(token);
  if (blacklisted) {
    ctx.status = 401;
    ctx.body = { error: 'Token revoked' };
    return;
  }
  
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  
  if (payload.type !== 'access') {
    ctx.status = 401;
    ctx.body = { error: 'Invalid token type' };
    return;
  }
  
  ctx.state.user = payload;
  await next();
};

export const requireRole = (...roles) => async (ctx, next) => {
  if (!roles.includes(ctx.state.user?.role)) {
    ctx.status = 403;
    ctx.body = { error: 'Insufficient permissions' };
    return;
  }
  await next();
};
