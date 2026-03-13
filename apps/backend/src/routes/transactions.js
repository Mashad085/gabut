import Router from '@koa/router';
import { z } from 'zod';
import { db, withTransaction } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { enqueue, JOB_TYPES } from '../services/jobQueue.js';
import { authenticate } from '../middleware/authenticate.js';

const router = new Router();
router.use(authenticate);

const transactionSchema = z.object({
  account_id: z.string().uuid(),
  transaction_type: z.enum(['credit', 'debit', 'transfer']),
  amount: z.number().positive(),
  description: z.string().optional(),
  payee: z.string().optional(),
  category: z.string().optional(),
  related_account_id: z.string().uuid().optional(),
});

// GET /transactions - List transactions for user
router.get('/', async (ctx) => {
  const { account_id, page = 1, limit = 20, category, start_date, end_date } = ctx.query;
  const offset = (page - 1) * limit;
  const userId = ctx.state.user.sub;
  
  let whereClause = 'WHERE ba.user_id = $1';
  const params = [userId];
  
  if (account_id) {
    params.push(account_id);
    whereClause += ` AND t.account_id = $${params.length}`;
  }
  
  if (category) {
    params.push(category);
    whereClause += ` AND t.category = $${params.length}`;
  }
  
  if (start_date) {
    params.push(start_date);
    whereClause += ` AND t.transaction_date >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    whereClause += ` AND t.transaction_date <= $${params.length}`;
  }
  
  const cacheKey = `transactions:${userId}:${JSON.stringify(ctx.query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    ctx.body = cached;
    return;
  }
  
  const [transactions, countResult] = await Promise.all([
    db.query(
      `SELECT t.*, ba.account_name, ba.account_number, ba.currency
       FROM transactions t
       JOIN bank_accounts ba ON ba.id = t.account_id
       ${whereClause}
       ORDER BY t.transaction_date DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    db.query(
      `SELECT COUNT(*) FROM transactions t
       JOIN bank_accounts ba ON ba.id = t.account_id
       ${whereClause}`,
      params
    ),
  ]);
  
  const result = {
    data: transactions.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
  
  await cache.set(cacheKey, result, 30);
  ctx.body = result;
});

// POST /transactions - Create transaction
router.post('/', async (ctx) => {
  const body = transactionSchema.parse(ctx.request.body);
  const userId = ctx.state.user.sub;
  
  const result = await withTransaction(async (client) => {
    // Verify account ownership
    const account = await client.query(
      'SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2 AND is_active = true FOR UPDATE',
      [body.account_id, userId]
    );
    
    if (account.rows.length === 0) {
      const err = new Error('Account not found or access denied');
      err.status = 404;
      throw err;
    }
    
    const acc = account.rows[0];
    let newBalance = parseFloat(acc.balance);
    
    if (body.transaction_type === 'debit' || body.transaction_type === 'transfer') {
      if (newBalance < body.amount) {
        const err = new Error('Insufficient balance');
        err.status = 400;
        throw err;
      }
      newBalance -= body.amount;
    } else {
      newBalance += body.amount;
    }
    
    // Handle transfer
    if (body.transaction_type === 'transfer' && body.related_account_id) {
      const targetAccount = await client.query(
        'SELECT * FROM bank_accounts WHERE id = $1 AND is_active = true FOR UPDATE',
        [body.related_account_id]
      );
      
      if (targetAccount.rows.length === 0) {
        const err = new Error('Target account not found');
        err.status = 404;
        throw err;
      }
      
      const targetAcc = targetAccount.rows[0];
      const targetNewBalance = parseFloat(targetAcc.balance) + body.amount;
      
      // Credit target account
      await client.query(
        'UPDATE bank_accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
        [targetNewBalance, body.related_account_id]
      );
      
      // Create credit transaction for target
      await client.query(
        `INSERT INTO transactions (account_id, related_account_id, transaction_type, amount, balance_after, description, payee, category, reference_number)
         VALUES ($1, $2, 'credit', $3, $4, $5, $6, $7, $8)`,
        [body.related_account_id, body.account_id, body.amount, targetNewBalance,
         body.description || 'Transfer received', acc.account_name, body.category || 'Transfer',
         `TRF${Date.now()}`]
      );
    }
    
    // Update source account balance
    await client.query(
      'UPDATE bank_accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, body.account_id]
    );
    
    const refNum = `TXN${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    // Create transaction record
    const txn = await client.query(
      `INSERT INTO transactions (account_id, related_account_id, transaction_type, amount, balance_after, description, payee, category, reference_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [body.account_id, body.related_account_id, body.transaction_type, body.amount,
       newBalance, body.description, body.payee, body.category || 'General', refNum]
    );
    
    return txn.rows[0];
  });
  
  // Invalidate cache
  await cache.delPattern(`transactions:${userId}:*`);
  await cache.delPattern(`accounts:${userId}:*`);
  
  // Enqueue notification for transaction
  await enqueue(JOB_TYPES.PROCESS_TRANSACTION, {
    user_id: userId,
    amount: result.amount,
    type: result.type,
    description: result.description,
  });
  
  ctx.status = 201;
  ctx.body = result;
});

// GET /transactions/:id
router.get('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  
  const result = await db.query(
    `SELECT t.*, ba.account_name, ba.currency, ba.user_id
     FROM transactions t
     JOIN bank_accounts ba ON ba.id = t.account_id
     WHERE t.id = $1 AND ba.user_id = $2`,
    [ctx.params.id, userId]
  );
  
  if (result.rows.length === 0) {
    ctx.status = 404;
    ctx.body = { error: 'Transaction not found' };
    return;
  }
  
  ctx.body = result.rows[0];
});

// GET /transactions/stats/summary
router.get('/stats/summary', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { period = 'monthly' } = ctx.query;
  
  const cacheKey = `txn_stats:${userId}:${period}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    ctx.body = cached;
    return;
  }
  
  const result = await db.query(
    `SELECT 
       DATE_TRUNC($1, t.transaction_date) as period,
       SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE 0 END) as total_income,
       SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE 0 END) as total_expenses,
       COUNT(*) as transaction_count,
       t.category
     FROM transactions t
     JOIN bank_accounts ba ON ba.id = t.account_id
     WHERE ba.user_id = $2
       AND t.transaction_date >= NOW() - INTERVAL '12 months'
     GROUP BY DATE_TRUNC($1, t.transaction_date), t.category
     ORDER BY period DESC`,
    [period, userId]
  );
  
  await cache.set(cacheKey, result.rows, 300);
  ctx.body = result.rows;
});

export default router;
