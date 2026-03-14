import Router from '@koa/router';
import { db } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { authenticate } from '../middleware/authenticate.js';

const router = new Router();
router.use(authenticate);

// GET /reports/dashboard - Main dashboard data
router.get('/dashboard', async (ctx) => {
  const userId = ctx.state.user.sub;
  const cacheKey = `dashboard:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) { ctx.body = cached; return; }
  
  const [netWorth, monthlyFlow, categoryBreakdown, recentTxns, accounts] = await Promise.all([
    // Net worth over time
    db.query(
      `SELECT DATE_TRUNC('month', t.transaction_date) as month,
              SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE -t.amount END) as net_change
       FROM transactions t
       JOIN bank_accounts ba ON ba.id = t.account_id
       WHERE ba.user_id = $1 AND t.transaction_date >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', t.transaction_date)
       ORDER BY month`,
      [userId]
    ),
    // Monthly cash flow
    db.query(
      `SELECT 
         DATE_TRUNC('month', t.transaction_date) as month,
         SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE 0 END) as income,
         SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE 0 END) as expenses
       FROM transactions t
       JOIN bank_accounts ba ON ba.id = t.account_id
       WHERE ba.user_id = $1 AND t.transaction_date >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', t.transaction_date)
       ORDER BY month`,
      [userId]
    ),
    // Category breakdown (last 30 days)
    db.query(
      `SELECT t.category, 
              SUM(t.amount) as total,
              COUNT(*) as count,
              AVG(t.amount) as average
       FROM transactions t
       JOIN bank_accounts ba ON ba.id = t.account_id
       WHERE ba.user_id = $1 
         AND t.transaction_type = 'debit'
         AND t.transaction_date >= NOW() - INTERVAL '30 days'
       GROUP BY t.category
       ORDER BY total DESC`,
      [userId]
    ),
    // Recent transactions
    db.query(
      `SELECT t.*, ba.account_name, ba.currency
       FROM transactions t
       JOIN bank_accounts ba ON ba.id = t.account_id
       WHERE ba.user_id = $1
       ORDER BY t.transaction_date DESC
       LIMIT 10`,
      [userId]
    ),
    // Account balances
    db.query(
      `SELECT id, account_name, account_type, balance, currency, is_primary
       FROM bank_accounts WHERE user_id = $1 AND is_active = true`,
      [userId]
    ),
  ]);
  
  // Calculate totals
  const totalBalance = accounts.rows.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
  const currentMonthIncome = monthlyFlow.rows.slice(-1)[0]?.income || 0;
  const currentMonthExpenses = monthlyFlow.rows.slice(-1)[0]?.expenses || 0;
  
  const result = {
    summary: {
      total_balance: totalBalance,
      monthly_income: parseFloat(currentMonthIncome),
      monthly_expenses: parseFloat(currentMonthExpenses),
      net_savings: parseFloat(currentMonthIncome) - parseFloat(currentMonthExpenses),
    },
    accounts: accounts.rows,
    net_worth_trend: netWorth.rows,
    monthly_cashflow: monthlyFlow.rows,
    category_breakdown: categoryBreakdown.rows,
    recent_transactions: recentTxns.rows,
  };
  
  await cache.set(cacheKey, result, 60);
  ctx.body = result;
});

// GET /reports/investment - Investment performance
router.get('/investment', async (ctx) => {
  const userId = ctx.state.user.sub;
  
  const result = await db.query(
    `SELECT 
       DATE_TRUNC('month', t.transaction_date) as month,
       SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE -t.amount END) as performance,
       ba.account_type
     FROM transactions t
     JOIN bank_accounts ba ON ba.id = t.account_id
     WHERE ba.user_id = $1 
       AND ba.account_type = 'investment'
     GROUP BY DATE_TRUNC('month', t.transaction_date), ba.account_type
     ORDER BY month`,
    [userId]
  );
  
  ctx.body = result.rows;
});

// GET /reports/cost-of-living
router.get('/cost-of-living', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { months = 12 } = ctx.query;
  
  const result = await db.query(
    `SELECT 
       DATE_TRUNC('month', t.transaction_date) as month,
       t.category,
       SUM(t.amount) as total
     FROM transactions t
     JOIN bank_accounts ba ON ba.id = t.account_id
     WHERE ba.user_id = $1 
       AND t.transaction_type = 'debit'
       AND t.transaction_date >= NOW() - INTERVAL '${parseInt(months)} months'
     GROUP BY DATE_TRUNC('month', t.transaction_date), t.category
     ORDER BY month DESC`,
    [userId]
  );
  
  ctx.body = result.rows;
});

// GET /reports/net-worth
router.get('/net-worth', async (ctx) => {
  const userId = ctx.state.user.sub;
  
  const result = await db.query(
    `SELECT 
       DATE_TRUNC('month', t.transaction_date) as date,
       SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE -t.amount END) 
         OVER (ORDER BY DATE_TRUNC('month', t.transaction_date)) as cumulative_net_worth
     FROM transactions t
     JOIN bank_accounts ba ON ba.id = t.account_id
     WHERE ba.user_id = $1
     GROUP BY DATE_TRUNC('month', t.transaction_date), t.transaction_type, t.amount
     ORDER BY date`,
    [userId]
  );
  
  ctx.body = result.rows;
});

export default router;

// GET /reports/financial-report — laporan keuangan via COBOL CFREPORT
import cobol from '../services/cobol-bridge.js';

reportRouter.get('/financial-report', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { rows: accounts } = await db.query(
    `SELECT ba.account_name, ba.balance,
       COALESCE(SUM(CASE WHEN t.transaction_type='debit'  THEN t.amount ELSE 0 END), 0) AS total_debit,
       COALESCE(SUM(CASE WHEN t.transaction_type='credit' THEN t.amount ELSE 0 END), 0) AS total_credit
     FROM bank_accounts ba
     LEFT JOIN transactions t ON t.account_id=ba.id
       AND t.transaction_date >= DATE_TRUNC('month', NOW())
     WHERE ba.user_id=$1 AND ba.is_active=true
     GROUP BY ba.id ORDER BY ba.is_primary DESC`,
    [userId]
  );

  if (accounts.length === 0) {
    ctx.body = { report: 'Belum ada rekening', raw: '' };
    return;
  }

  // COBOL CFREPORT: generate formatted text report
  const reportText = await cobol.generateFinancialReport(accounts);
  ctx.set('Content-Type', 'text/plain; charset=utf-8');
  ctx.body = reportText;
});
