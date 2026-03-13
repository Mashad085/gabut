import Router from '@koa/router';
import { db } from '../db/postgres.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';

const router = new Router();
router.use(authenticate, requireRole('admin'));

router.get('/stats', async (ctx) => {
  const [users, accounts, transactions, communities] = await Promise.all([
    db.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
    db.query('SELECT COUNT(*), SUM(balance) as total_balance FROM bank_accounts WHERE is_active = true'),
    db.query("SELECT COUNT(*), SUM(amount) as total_volume FROM transactions WHERE transaction_date >= NOW() - INTERVAL '30 days'"),
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

router.get('/users', async (ctx) => {
  const { page = 1, limit = 20 } = ctx.query;
  const result = await db.query(
    'SELECT id, email, username, full_name, role, is_verified, is_active, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, (page - 1) * limit]
  );
  ctx.body = { data: result.rows };
});

router.patch('/users/:id/role', async (ctx) => {
  const { role } = ctx.request.body;
  await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, ctx.params.id]);
  ctx.body = { message: 'Role updated' };
});

router.get('/audit-logs', async (ctx) => {
  const result = await db.query(
    'SELECT al.*, u.email FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ORDER BY al.created_at DESC LIMIT 100'
  );
  ctx.body = { data: result.rows };
});

export default router;
