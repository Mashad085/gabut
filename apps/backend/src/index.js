import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import koaBody from 'koa-body';
import helmet from 'koa-helmet';
import logger from 'koa-logger';
import compress from 'koa-compress';
import { createServer } from 'http';

import { db, testConnection } from './db/postgres.js';
import { redis } from './db/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { startJobProcessor } from './services/jobProcessor.js';

import authRoutes         from './routes/auth.js';
import accountRoutes      from './routes/accounts.js';
import transactionRoutes  from './routes/transactions.js';
import communityRoutes    from './routes/communities.js';
import budgetRoutes       from './routes/budgets.js';
import reportRoutes       from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes        from './routes/admin.js';

const app = new Koa();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      scriptSrc:  ["'self'"],
      imgSrc:     ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(compress());
app.use(koaBody({ json: true, multipart: true, urlencoded: true, jsonLimit: '10mb' }));
app.use(logger());
app.use(errorHandler);
app.use(rateLimiter);

app.context.db    = db;
app.context.redis = redis;

const apiRouter = new Router({ prefix: '/api/v1' });

apiRouter.get('/health', async (ctx) => {
  const dbOk    = await db.query('SELECT 1').then(() => 'ok').catch(() => 'error');
  const redisOk = await redis.ping().then(() => 'ok').catch(() => 'error');
  ctx.body = { status: 'ok', timestamp: new Date().toISOString(), services: { database: dbOk, redis: redisOk }, version: '1.0.0' };
});

apiRouter.use('/auth',          authRoutes.routes(),         authRoutes.allowedMethods());
apiRouter.use('/accounts',      accountRoutes.routes(),      accountRoutes.allowedMethods());
apiRouter.use('/transactions',  transactionRoutes.routes(),  transactionRoutes.allowedMethods());
apiRouter.use('/communities',   communityRoutes.routes(),    communityRoutes.allowedMethods());
apiRouter.use('/budgets',       budgetRoutes.routes(),       budgetRoutes.allowedMethods());
apiRouter.use('/reports',       reportRoutes.routes(),       reportRoutes.allowedMethods());
apiRouter.use('/notifications', notificationRoutes.routes(), notificationRoutes.allowedMethods());
apiRouter.use('/admin',         adminRoutes.routes(),        adminRoutes.allowedMethods());

app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());
app.use(async (ctx) => { ctx.status = 404; ctx.body = { error: 'Route not found', path: ctx.path }; });

const PORT   = process.env.PORT || 3001;
const server = createServer(app.callback());
let isShuttingDown = false;

const start = async () => {
  try {
    await testConnection();
    console.log('✅ PostgreSQL connected');
    await redis.ping();
    console.log('✅ Redis connected');
    startJobProcessor();
    server.listen(PORT, () => {
      console.log(`🚀 API running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n🔄 Shutting down...');
  server.close(async () => {
    try { await db.end(); } catch (_) {}
    try { await redis.quit(); } catch (_) {}
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
start();
export default app;
