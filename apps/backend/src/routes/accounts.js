import Router from '@koa/router';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { authenticate } from '../middleware/authenticate.js';

const router = new Router();
router.use(authenticate);

// GET /accounts
router.get('/', async (ctx) => {
  const userId = ctx.state.user.sub;
  const cacheKey = `accounts:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) { ctx.body = cached; return; }

  const result = await db.query(
    `SELECT ba.*,
      (SELECT COUNT(*) FROM transactions t WHERE t.account_id = ba.id) as transaction_count,
      (SELECT MAX(t.transaction_date) FROM transactions t WHERE t.account_id = ba.id) as last_transaction
     FROM bank_accounts ba
     WHERE ba.user_id = $1 AND ba.is_active = true
     ORDER BY ba.is_primary DESC, ba.created_at ASC`,
    [userId]
  );

  await cache.set(cacheKey, result.rows, 60);
  ctx.body = result.rows;
});

// POST /accounts
router.post('/', async (ctx) => {
  const schema = z.object({
    account_type: z.enum(['savings', 'checking', 'investment', 'loan']),
    account_name: z.string().min(2).max(100),
    currency: z.string().default('IDR'),
    initial_balance: z.number().min(0).default(0),
  });

  const body = schema.parse(ctx.request.body);
  const userId = ctx.state.user.sub;
  const accountNumber = `CF${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  const result = await db.query(
    `INSERT INTO bank_accounts (user_id, account_number, account_type, account_name, balance, currency)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, accountNumber, body.account_type, body.account_name, body.initial_balance, body.currency]
  );

  await cache.del(`accounts:${userId}`);
  ctx.status = 201;
  ctx.body = result.rows[0];
});

// GET /accounts/:id
router.get('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  const result = await db.query(
    'SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2',
    [ctx.params.id, userId]
  );
  if (!result.rows[0]) { ctx.status = 404; ctx.body = { error: 'Account not found' }; return; }
  ctx.body = result.rows[0];
});

// PUT /accounts/:id
router.put('/:id', async (ctx) => {
  const schema = z.object({
    account_name: z.string().min(2).max(100).optional(),
    is_primary: z.boolean().optional(),
  });

  const body = schema.parse(ctx.request.body);
  const userId = ctx.state.user.sub;

  if (body.is_primary) {
    await db.query('UPDATE bank_accounts SET is_primary = false WHERE user_id = $1', [userId]);
  }

  const result = await db.query(
    `UPDATE bank_accounts SET account_name = COALESCE($1, account_name),
       is_primary = COALESCE($2, is_primary), updated_at = NOW()
     WHERE id = $3 AND user_id = $4 RETURNING *`,
    [body.account_name, body.is_primary, ctx.params.id, userId]
  );

  await cache.del(`accounts:${userId}`);
  ctx.body = result.rows[0];
});

// DELETE /accounts/:id (soft delete)
router.delete('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  await db.query(
    'UPDATE bank_accounts SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2',
    [ctx.params.id, userId]
  );
  await cache.del(`accounts:${userId}`);
  ctx.body = { message: 'Account deactivated' };
});

export default router;
