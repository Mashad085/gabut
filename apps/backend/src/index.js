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
import cobol from './services/cobol-bridge.js';

import authRoutes         from './routes/auth.js';
import accountRoutes      from './routes/accounts.js';
import transactionRoutes  from './routes/transactions.js';
import communityRoutes    from './routes/communities.js';
import budgetRoutes       from './routes/budgets.js';
import reportRoutes       from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes        from './routes/admin.js';
import walletRoutes       from './routes/wallet.js';
import scheduleRoutes     from './routes/schedules.js';

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
  allowMethods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowHeaders: ['Content-Type','Authorization','X-Requested-With'],
}));
app.use(compress());
app.use(koaBody({ json:true, multipart:true, urlencoded:true, jsonLimit:'10mb' }));
app.use(logger());
app.use(errorHandler);
app.use(rateLimiter);

app.context.db    = db;
app.context.redis = redis;

const apiRouter = new Router({ prefix: '/api/v1' });

// Health check — include COBOL binary status
apiRouter.get('/health', async (ctx) => {
  const dbOk    = await db.query('SELECT 1').then(() => 'ok').catch(() => 'error');
  const redisOk = await redis.ping().then(() => 'ok').catch(() => 'error');

  let cobolStatus = {};
  try {
    cobolStatus = await cobol.cobolHealthCheck();
  } catch {
    cobolStatus = { error: 'COBOL health check gagal' };
  }

  const allCobolOk = Object.values(cobolStatus).every(v => v === 'ok');

  ctx.body = {
    status:    dbOk === 'ok' && redisOk === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version:   '2.0.0',
    services: {
      database: dbOk,
      redis:    redisOk,
      cobol:    allCobolOk ? 'ok' : 'degraded',
    },
    cobol_modules: cobolStatus,
    architecture: 'Node.js (HTTP/Auth/DB) + GnuCOBOL (Business Logic)',
  };
});

apiRouter.use('/auth',          authRoutes.routes(),         authRoutes.allowedMethods());
apiRouter.use('/accounts',      accountRoutes.routes(),      accountRoutes.allowedMethods());
apiRouter.use('/transactions',  transactionRoutes.routes(),  transactionRoutes.allowedMethods());
apiRouter.use('/communities',   communityRoutes.routes(),    communityRoutes.allowedMethods());
apiRouter.use('/budgets',       budgetRoutes.routes(),       budgetRoutes.allowedMethods());
apiRouter.use('/reports',       reportRoutes.routes(),       reportRoutes.allowedMethods());
apiRouter.use('/notifications', notificationRoutes.routes(), notificationRoutes.allowedMethods());
apiRouter.use('/admin',         adminRoutes.routes(),        adminRoutes.allowedMethods());
apiRouter.use('/wallet',        walletRoutes.routes(),       walletRoutes.allowedMethods());
apiRouter.use('/schedules',     scheduleRoutes.routes(),     scheduleRoutes.allowedMethods());

app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());
app.use(async (ctx) => {
  ctx.status = 404;
  ctx.body = { error: 'Route tidak ditemukan', path: ctx.path };
});

const PORT   = process.env.PORT || 3001;
const server = createServer(app.callback());
let isShuttingDown = false;

const start = async () => {
  try {
    await testConnection();
    console.log('✅ PostgreSQL connected');
    await redis.ping();
    console.log('✅ Redis connected');

    // Verifikasi COBOL binaries saat startup
    try {
      const cobolHealth = await cobol.cobolHealthCheck();
      const allOk = Object.entries(cobolHealth).every(([,v]) => v === 'ok');
      if (allOk) {
        console.log('✅ COBOL modules: cftrxval, cfwallet, cfbudget, cfbatch, cfreport');
      } else {
        const missing = Object.entries(cobolHealth)
          .filter(([,v]) => v !== 'ok').map(([k]) => k).join(', ');
        console.warn(`⚠️  COBOL modules degraded: ${missing}`);
        console.warn('   Jalankan: cd cobol && make');
      }
    } catch {
      console.warn('⚠️  COBOL health check gagal — pastikan binary sudah di-compile');
    }

    startJobProcessor();
    server.listen(PORT, () => {
      console.log(`🚀 API running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🏦 Engine: Node.js + GnuCOBOL hybrid`);
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
    try { await db.end(); }   catch {}
    try { await redis.quit(); } catch {}
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
start();
export default app;
