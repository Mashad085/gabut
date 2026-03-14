import Router from '@koa/router';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { authenticate } from '../middleware/authenticate.js';
import cobol from '../services/cobol-bridge.js';

const router = new Router();
router.use(authenticate);

router.get('/', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { rows } = await db.query(
    `SELECT ba.*,
       (SELECT COUNT(*) FROM transactions t WHERE t.account_id=ba.id) as transaction_count,
       (SELECT MAX(t.transaction_date) FROM transactions t WHERE t.account_id=ba.id) as last_transaction
     FROM bank_accounts ba
     WHERE ba.user_id=$1 AND ba.is_active=true
     ORDER BY ba.is_primary DESC, ba.created_at ASC`,
    [userId]
  );
  ctx.body = rows;
});

router.post('/', async (ctx) => {
  const body = z.object({
    account_type:    z.enum(['savings','checking','investment','loan']),
    account_name:    z.string().min(2).max(100),
    currency:        z.string().default('IDR'),
    initial_balance: z.number().min(0).default(0),
    is_primary:      z.boolean().default(false),
  }).parse(ctx.request.body);

  const userId = ctx.state.user.sub;
  const accountNumber = `CF${Date.now()}${Math.random().toString(36).substr(2,4).toUpperCase()}`;

  if (body.is_primary) {
    await db.query('UPDATE bank_accounts SET is_primary=false WHERE user_id=$1', [userId]);
  }

  const { rows:[acc] } = await db.query(
    `INSERT INTO bank_accounts (user_id,account_number,account_type,account_name,balance,currency,is_primary)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [userId, accountNumber, body.account_type, body.account_name, body.initial_balance, body.currency, body.is_primary]
  );
  await cache.del(`accounts:${userId}`);
  ctx.status=201; ctx.body=acc;
});

router.get('/:id', async (ctx) => {
  const { rows:[acc] } = await db.query(
    'SELECT * FROM bank_accounts WHERE id=$1 AND user_id=$2',
    [ctx.params.id, ctx.state.user.sub]
  );
  if (!acc) { ctx.status=404; ctx.body={error:'Rekening tidak ditemukan'}; return; }
  ctx.body=acc;
});

router.put('/:id', async (ctx) => {
  const body = z.object({
    account_name: z.string().min(2).max(100).optional(),
    is_primary:   z.boolean().optional(),
  }).parse(ctx.request.body);

  const userId = ctx.state.user.sub;
  if (body.is_primary) {
    await db.query('UPDATE bank_accounts SET is_primary=false WHERE user_id=$1', [userId]);
  }
  const { rows:[acc] } = await db.query(
    `UPDATE bank_accounts SET
       account_name=COALESCE($1,account_name),
       is_primary=COALESCE($2,is_primary),
       updated_at=NOW()
     WHERE id=$3 AND user_id=$4 RETURNING *`,
    [body.account_name, body.is_primary, ctx.params.id, userId]
  );
  await cache.del(`accounts:${userId}`);
  ctx.body=acc;
});

router.delete('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  await db.query(
    'UPDATE bank_accounts SET is_active=false, updated_at=NOW() WHERE id=$1 AND user_id=$2',
    [ctx.params.id, userId]
  );
  await cache.del(`accounts:${userId}`);
  ctx.body={message:'Rekening dinonaktifkan'};
});

// POST /accounts/transfer — COBOL validates and calculates both balances
router.post('/transfer', async (ctx) => {
  const body = z.object({
    from_account_id:   z.string().uuid(),
    to_account_number: z.string(),
    amount:            z.number().positive(),
    description:       z.string().optional(),
  }).parse(ctx.request.body);

  const userId = ctx.state.user.sub;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows:[from] } = await client.query(
      `SELECT id,balance,account_name,account_number FROM bank_accounts
       WHERE id=$1 AND user_id=$2 AND is_active=true FOR UPDATE`,
      [body.from_account_id, userId]
    );
    if (!from) { await client.query('ROLLBACK'); ctx.status=403; ctx.body={error:'Rekening asal tidak ditemukan'}; return; }

    // ── COBOL: validasi saldo cukup ──────────────────────────────────────
    const validation = await cobol.validateTransaction({
      amount:   body.amount,
      balance:  parseFloat(from.balance),
      txn_type: 'TRANSFER',
    });
    if (validation.status === 'ERROR') {
      await client.query('ROLLBACK');
      ctx.status=400; ctx.body={error:validation.message}; return;
    }
    // ────────────────────────────────────────────────────────────────────

    const { rows:[to] } = await client.query(
      `SELECT id,balance,account_name,user_id FROM bank_accounts
       WHERE account_number=$1 AND is_active=true FOR UPDATE`,
      [body.to_account_number]
    );
    if (!to) { await client.query('ROLLBACK'); ctx.status=404; ctx.body={error:'Nomor rekening tujuan tidak ditemukan'}; return; }
    if (to.id===from.id) { await client.query('ROLLBACK'); ctx.status=400; ctx.body={error:'Tidak bisa transfer ke rekening sendiri'}; return; }

    // ── COBOL: hitung saldo baru kedua rekening ─────────────────────────
    const [fromResult, toResult] = await Promise.all([
      cobol.calcBalance({ amount:body.amount, balance:parseFloat(from.balance), txn_type:'DEBIT' }),
      cobol.calcBalance({ amount:body.amount, balance:parseFloat(to.balance),   txn_type:'CREDIT' }),
    ]);
    const newFromBalance = parseFloat(fromResult.balance);
    const newToBalance   = parseFloat(toResult.balance);
    // ────────────────────────────────────────────────────────────────────

    const ref = `TRF-${Date.now()}`;
    const desc = body.description || `Transfer ke ${to.account_name}`;

    await client.query('UPDATE bank_accounts SET balance=$1, updated_at=NOW() WHERE id=$2', [newFromBalance, from.id]);
    await client.query('UPDATE bank_accounts SET balance=$1, updated_at=NOW() WHERE id=$2', [newToBalance, to.id]);

    await client.query(
      `INSERT INTO transactions (account_id,related_account_id,user_id,transaction_type,
         amount,balance_after,description,reference_number,category)
       VALUES ($1,$2,$3,'transfer',$4,$5,$6,$7,'transfer')`,
      [from.id,to.id,userId,body.amount,newFromBalance,desc,ref]
    );
    await client.query(
      `INSERT INTO transactions (account_id,related_account_id,user_id,transaction_type,
         amount,balance_after,description,reference_number,category)
       VALUES ($1,$2,$3,'transfer',$4,$5,$6,$7,'transfer')`,
      [to.id,from.id,to.user_id,body.amount,newToBalance,`Transfer dari ${from.account_name}`,ref]
    );
    await client.query(
      `INSERT INTO notifications (user_id,title,message,type,metadata) VALUES ($1,'Transfer Masuk',$2,'transaction',$3)`,
      [to.user_id,
       `Dana masuk ${new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(body.amount)} dari ${from.account_number}`,
       JSON.stringify({amount:body.amount,from_account:from.account_number,ref,_cobol:'CFTRXVAL'})]
    );

    await client.query('COMMIT');
    await cache.del(`accounts:${userId}`);

    ctx.body = {
      message:     'Transfer berhasil',
      reference:   ref,
      balance_after: newFromBalance,
      _cobol:      'CFTRXVAL VALIDATE + CALC-BALANCE',
    };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally    { client.release(); }
});

export default router;
