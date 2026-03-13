import Router from '@koa/router';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authenticate.js';

// ── Budgets ──────────────────────────────────────────────────────────────────
export const budgetsRouter = new Router();
budgetsRouter.use(authenticate);

budgetsRouter.get('/', async (ctx) => {
  const userId = ctx.state.user.sub;
  const result = await db.query(
    'SELECT * FROM budgets WHERE user_id = $1 ORDER BY period_start DESC LIMIT 12',
    [userId]
  );
  ctx.body = result.rows;
});

budgetsRouter.post('/', async (ctx) => {
  const schema = z.object({
    name: z.string().min(1),
    period_type: z.enum(['monthly', 'yearly']),
    period_start: z.string(),
    period_end: z.string(),
    total_income: z.number().default(0),
  });
  const body = schema.parse(ctx.request.body);
  const userId = ctx.state.user.sub;
  const result = await db.query(
    `INSERT INTO budgets (user_id, name, period_type, period_start, period_end, total_income)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, body.name, body.period_type, body.period_start, body.period_end, body.total_income]
  );
  ctx.status = 201;
  ctx.body = result.rows[0];
});

budgetsRouter.get('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  const [budget, categories] = await Promise.all([
    db.query('SELECT * FROM budgets WHERE id = $1 AND user_id = $2', [ctx.params.id, userId]),
    db.query('SELECT * FROM budget_categories WHERE budget_id = $1 ORDER BY is_income DESC, budgeted_amount DESC', [ctx.params.id]),
  ]);
  if (!budget.rows[0]) { ctx.status = 404; ctx.body = { error: 'Budget not found' }; return; }
  ctx.body = { ...budget.rows[0], categories: categories.rows };
});

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsRouter = new Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { page = 1, limit = 20, unread_only } = ctx.query;
  const offset = (page - 1) * limit;

  let where = 'WHERE user_id = $1';
  if (unread_only === 'true') where += ' AND is_read = false';

  const result = await db.query(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const unread = await db.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false', [userId]);
  ctx.body = { data: result.rows, unread_count: parseInt(unread.rows[0].count) };
});

notificationsRouter.patch('/:id/read', async (ctx) => {
  const userId = ctx.state.user.sub;
  await db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [ctx.params.id, userId]);
  ctx.body = { message: 'Marked as read' };
});

notificationsRouter.patch('/read-all', async (ctx) => {
  const userId = ctx.state.user.sub;
  await db.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userId]);
  ctx.body = { message: 'All marked as read' };
});

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminRouter = new Router();
adminRouter.use(authenticate, requireRole('admin'));

adminRouter.get('/stats', async (ctx) => {
  const [users, accounts, transactions, communities] = await Promise.all([
    db.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
    db.query('SELECT COUNT(*), SUM(balance) as total_balance FROM bank_accounts WHERE is_active = true'),
    db.query('SELECT COUNT(*), SUM(amount) as total_volume FROM transactions WHERE transaction_date >= NOW() - INTERVAL \'30 days\''),
    db.query('SELECT COUNT(*) FROM communities'),
  ]);

  ctx.body = {
    users: parseInt(users.rows[0].count),
    accounts: parseInt(accounts.rows[0].count),
    total_balance: parseFloat(accounts.rows[0].total_balance || 0),
    monthly_transactions: parseInt(transactions.rows[0].count),
    monthly_volume: parseFloat(transactions.rows[0].total_volume || 0),
    communities: parseInt(communities.rows[0].count),
  };
});

adminRouter.get('/users', async (ctx) => {
  const { page = 1, limit = 20, search } = ctx.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (email ILIKE $${params.length} OR username ILIKE $${params.length} OR full_name ILIKE $${params.length})`;
  }
  const result = await db.query(
    `SELECT id, email, username, full_name, role, is_verified, is_active, last_login_at, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const count = await db.query(`SELECT COUNT(*) FROM users ${where}`, params);
  ctx.body = { data: result.rows, total: parseInt(count.rows[0].count) };
});

adminRouter.get('/audit-logs', async (ctx) => {
  const { page = 1, limit = 50 } = ctx.query;
  const offset = (page - 1) * limit;
  const result = await db.query(
    `SELECT al.*, u.email, u.username FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  ctx.body = { data: result.rows };
});
