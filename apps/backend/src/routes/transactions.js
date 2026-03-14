import Router from '@koa/router';
import { z } from 'zod';
import { db, withTransaction } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { enqueue, JOB_TYPES } from '../services/jobQueue.js';
import { authenticate } from '../middleware/authenticate.js';
import cobol from '../services/cobol-bridge.js';

const router = new Router();
router.use(authenticate);

// GET /transactions
router.get('/', async (ctx) => {
  const { account_id, page=1, limit=20, category, start_date, end_date } = ctx.query;
  const offset = (page-1)*limit;
  const userId = ctx.state.user.sub;

  let where = 'WHERE ba.user_id = $1';
  const params = [userId];
  if (account_id) { params.push(account_id);  where += ` AND t.account_id = $${params.length}`; }
  if (category)   { params.push(category);    where += ` AND t.category = $${params.length}`; }
  if (start_date) { params.push(start_date);  where += ` AND t.transaction_date >= $${params.length}`; }
  if (end_date)   { params.push(end_date);    where += ` AND t.transaction_date <= $${params.length}`; }

  const cacheKey = `transactions:${userId}:${JSON.stringify(ctx.query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) { ctx.body = cached; return; }

  const [{ rows }, { rows:[{count}] }] = await Promise.all([
    db.query(
      `SELECT t.*, ba.account_name, ba.account_number, ba.currency
       FROM transactions t JOIN bank_accounts ba ON ba.id = t.account_id
       ${where} ORDER BY t.transaction_date DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    db.query(
      `SELECT COUNT(*) FROM transactions t
       JOIN bank_accounts ba ON ba.id = t.account_id ${where}`,
      params
    ),
  ]);

  const result = {
    data: rows,
    pagination: { page:+page, limit:+limit, total:+count, pages:Math.ceil(count/limit) },
  };
  await cache.set(cacheKey, result, 30);
  ctx.body = result;
});

// POST /transactions — COBOL validates + calculates balance
router.post('/', async (ctx) => {
  const body = z.object({
    account_id:       z.string().uuid(),
    transaction_type: z.enum(['credit','debit','transfer']),
    amount:           z.number().positive(),
    description:      z.string().optional(),
    payee:            z.string().optional(),
    category:         z.string().optional(),
    related_account_id: z.string().uuid().optional(),
  }).parse(ctx.request.body);

  const userId = ctx.state.user.sub;

  const result = await withTransaction(async (client) => {
    const { rows:[acc] } = await client.query(
      'SELECT * FROM bank_accounts WHERE id=$1 AND user_id=$2 AND is_active=true FOR UPDATE',
      [body.account_id, userId]
    );
    if (!acc) { const e=new Error('Rekening tidak ditemukan'); e.status=404; throw e; }

    // ── COBOL: validasi + hitung saldo baru ──────────────────────────────
    const cobolResult = await cobol.calcBalance({
      amount:   body.amount,
      balance:  parseFloat(acc.balance),
      txn_type: body.transaction_type,
    });

    if (cobolResult.status === 'ERROR') {
      const e = new Error(cobolResult.message);
      e.status = 400;
      throw e;
    }

    const newBalance = parseFloat(cobolResult.balance);
    // ────────────────────────────────────────────────────────────────────

    // Handle transfer ke rekening lain
    if (body.transaction_type === 'transfer' && body.related_account_id) {
      const { rows:[target] } = await client.query(
        'SELECT * FROM bank_accounts WHERE id=$1 AND is_active=true FOR UPDATE',
        [body.related_account_id]
      );
      if (!target) { const e=new Error('Rekening tujuan tidak ditemukan'); e.status=404; throw e; }

      // COBOL: hitung saldo target
      const targetResult = await cobol.calcBalance({
        amount:   body.amount,
        balance:  parseFloat(target.balance),
        txn_type: 'CREDIT',
      });

      await client.query(
        'UPDATE bank_accounts SET balance=$1, updated_at=NOW() WHERE id=$2',
        [parseFloat(targetResult.balance), body.related_account_id]
      );
      await client.query(
        `INSERT INTO transactions (account_id, related_account_id, user_id, transaction_type,
           amount, balance_after, description, payee, category, reference_number)
         VALUES ($1,$2,$3,'credit',$4,$5,$6,$7,$8,$9)`,
        [body.related_account_id, body.account_id, target.user_id, body.amount,
         parseFloat(targetResult.balance), 'Transfer diterima', acc.account_name,
         body.category||'Transfer', `TRF${Date.now()}`]
      );
    }

    await client.query(
      'UPDATE bank_accounts SET balance=$1, updated_at=NOW() WHERE id=$2',
      [newBalance, body.account_id]
    );

    const ref = `TXN${Date.now()}${Math.random().toString(36).substr(2,4).toUpperCase()}`;
    const { rows:[txn] } = await client.query(
      `INSERT INTO transactions (account_id, related_account_id, user_id, transaction_type,
         amount, balance_after, description, payee, category, reference_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [body.account_id, body.related_account_id||null, userId, body.transaction_type,
       body.amount, newBalance, body.description, body.payee, body.category||'Umum', ref]
    );

    // Sertakan info COBOL di response
    txn._cobol = { engine: 'GnuCOBOL CFTRXVAL', validated: true, balance_calc: 'COBOL' };
    return txn;
  });

  await cache.delPattern(`transactions:${userId}:*`);
  await cache.del(`accounts:${userId}`);

  await enqueue(JOB_TYPES.PROCESS_TRANSACTION, {
    user_id: userId,
    amount:  result.amount,
    type:    result.transaction_type,
    description: result.description,
  });

  ctx.status = 201;
  ctx.body = result;
});

// GET /transactions/stats/summary
router.get('/stats/summary', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { period='monthly' } = ctx.query;
  const cacheKey = `txn_stats:${userId}:${period}`;
  const cached = await cache.get(cacheKey);
  if (cached) { ctx.body = cached; return; }
  const { rows } = await db.query(
    `SELECT DATE_TRUNC($1, t.transaction_date) as period,
       SUM(CASE WHEN t.transaction_type='credit' THEN t.amount ELSE 0 END) as total_income,
       SUM(CASE WHEN t.transaction_type='debit'  THEN t.amount ELSE 0 END) as total_expenses,
       COUNT(*) as transaction_count, t.category
     FROM transactions t JOIN bank_accounts ba ON ba.id=t.account_id
     WHERE ba.user_id=$2 AND t.transaction_date >= NOW()-INTERVAL '12 months'
     GROUP BY DATE_TRUNC($1, t.transaction_date), t.category
     ORDER BY period DESC`,
    [period, userId]
  );
  await cache.set(cacheKey, rows, 300);
  ctx.body = rows;
});

// GET /transactions/:id
router.get('/:id', async (ctx) => {
  const { rows:[t] } = await db.query(
    `SELECT t.*, ba.account_name, ba.currency
     FROM transactions t JOIN bank_accounts ba ON ba.id=t.account_id
     WHERE t.id=$1 AND ba.user_id=$2`,
    [ctx.params.id, ctx.state.user.sub]
  );
  if (!t) { ctx.status=404; ctx.body={error:'Transaksi tidak ditemukan'}; return; }
  ctx.body = t;
});

export default router;
