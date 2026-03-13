import { ZodError } from 'zod';
import { cache } from '../db/redis.js';

// Error Handler Middleware
export const errorHandler = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ZodError) {
      ctx.status = 400;
      ctx.body = {
        error: 'Validation error',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      };
      return;
    }

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      ctx.status = 401;
      ctx.body = { error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' };
      return;
    }

    if (error.code === '23505') {
      ctx.status = 409;
      ctx.body = { error: 'Duplicate entry', detail: error.detail };
      return;
    }

    console.error('Unhandled error:', error);
    ctx.status = error.status || 500;
    ctx.body = {
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    };
  }
};

// Request Logger Middleware
export const requestLogger = async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  
  if (ms > 1000) {
    console.warn(`Slow request: ${ctx.method} ${ctx.url} - ${ms}ms`);
  }
};
