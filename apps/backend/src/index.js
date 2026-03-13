import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import koaBody from 'koa-body';
import helmet from 'koa-helmet';
import logger from 'koa-logger';
import compress from 'koa-compress';
import { createServer } from 'http';
import dotenv from 'dotenv';

dotenv.config();

import { db } from './db/postgres.js';
import { redis } from './db/redis.js';
import { rabbitMQ } from './services/rabbitmq.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';

// Routes
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import transactionRoutes from './routes/transactions.js';
import communityRoutes from './routes/communities.js';
import budgetRoutes from './routes/budgets.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

const app = new Koa();

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression
app.use(compress());

// Body parser
app.use(koaBody({
  json: true,
  multipart: true,
  urlencoded: true,
  jsonLimit: '10mb',
}));

// Logger
app.use(logger());
app.use(requestLogger);

// Error handler
app.use(errorHandler);

// Rate limiter
app.use(rateLimiter);

// App state
app.context.db = db;
app.context.redis = redis;

// API Router
const apiRouter = new Router({ prefix: '/api/v1' });

// Health check
apiRouter.get('/health', async (ctx) => {
  const dbHealth = await db.query('SELECT 1').then(() => 'ok').catch(() => 'error');
  const redisHealth = await redis.ping().then(() => 'ok').catch(() => 'error');
  
  ctx.body = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      rabbitmq: rabbitMQ.isConnected() ? 'ok' : 'error',
    },
    version: '1.0.0',
  };
});

// Mount routes
apiRouter.use('/auth', authRoutes.routes(), authRoutes.allowedMethods());
apiRouter.use('/accounts', accountRoutes.routes(), accountRoutes.allowedMethods());
apiRouter.use('/transactions', transactionRoutes.routes(), transactionRoutes.allowedMethods());
apiRouter.use('/communities', communityRoutes.routes(), communityRoutes.allowedMethods());
apiRouter.use('/budgets', budgetRoutes.routes(), budgetRoutes.allowedMethods());
apiRouter.use('/reports', reportRoutes.routes(), reportRoutes.allowedMethods());
apiRouter.use('/notifications', notificationRoutes.routes(), notificationRoutes.allowedMethods());
apiRouter.use('/admin', adminRoutes.routes(), adminRoutes.allowedMethods());

app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());

// 404 handler
app.use(async (ctx) => {
  ctx.status = 404;
  ctx.body = { error: 'Route not found', path: ctx.path };
});

const PORT = process.env.PORT || 3001;
const server = createServer(app.callback());

const start = async () => {
  try {
    // Connect to services
    await db.connect();
    console.log('✅ PostgreSQL connected');
    
    await redis.ping();
    console.log('✅ Redis connected');
    
    await rabbitMQ.connect();
    console.log('✅ RabbitMQ connected');
    
    server.listen(PORT, () => {
      console.log(`🚀 Community Finance API running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log('🔄 Gracefully shutting down...');
  server.close(async () => {
    await db.end();
    await redis.quit();
    await rabbitMQ.close();
    console.log('✅ Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

export default app;
