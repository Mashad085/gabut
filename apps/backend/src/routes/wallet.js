import Router from '@koa/router';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import cobol from '../services/cobol-bridge.js';

const router = new Router();
router.use(authenticate);

const ensureWallet = async (userId) =>
  db.query(`INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);

router.get('/me', async (ctx) => {
  const userId = ctx.state.user.sub;
  await ensureWallet(userId);
  const { rows:[w] } = await db.query(
    `SELECT w.*, u.full_name, u.username FROM wallets w JOIN users u ON u.id=w.user_id WHERE w.user_id=$1`,
    [userId]
  );
  const { rows:history } = await db.query(
    `SELECT wt.*,
       fu.full_name AS from_name,
       tu.full_name AS to_name
     FROM wallet_transactions wt
     LEFT JOIN wallets fw ON fw.id=wt.from_wallet_id LEFT JOIN users fu ON fu.id=fw.user_id
     LEFT JOIN wallets tw ON tw.id=wt.to_wallet_id   LEFT JOIN users tu ON tu.id=tw.user_id
     WHERE wt.wallet_id=$1 ORDER BY wt.created_at DESC LIMIT 50`, [w.id]
  );
  ctx.body = { wallet:w, transactions:history };
});

router.get('/users', async (ctx) => {
  const userId = ctx.state.user.sub;
  const q = ctx.query.q;
  const params = [userId];
  let extra = '';
  if (q) {
    params.push(`%${q}%`);
    extra = ` AND (u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.username, u.email,
            COALESCE(w.balance,0) AS balance, COALESCE(w.currency,'KOIN') AS currency
     FROM users u LEFT JOIN wallets w ON w.user_id=u.id
     WHERE u.id!=$1 AND u.is_active=true${extra} ORDER BY u.full_name LIMIT 20`, params
  );
  ctx.body = rows;
});

router.get('/all', requireRole('admin'), async (ctx) => {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.username, u.email, u.role,
            COALESCE(w.balance,0) AS balance, COALESCE(w.currency,'KOIN') AS currency, w.updated_at
     FROM users u LEFT JOIN wallets w ON w.user_id=u.id
     WHERE u.is_active=true ORDER BY u.full_name`
  );
  ctx.body = rows;
});

// POST /wallet/topup — admin only, COBOL calculates new balance
router.post('/topup', requireRole('admin'), async (ctx) => {
  const body = z.object({
    user_id: z.string().uuid(),
    amount:  z.number().positive(),
    note:    z.string().optional(),
  }).parse(ctx.request.body);

  const adminId = ctx.state.user.sub;
  await ensureWallet(body.user_id);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows:[w] } = await client.query(
      `SELECT id, balance FROM wallets WHERE user_id=$1 FOR UPDATE`, [body.user_id]
    );

    // ── COBOL: hitung saldo KOIN baru setelah top-up ────────────────────
    const cobolResult = await cobol.calcKoinTopup({
      to_balance: parseFloat(w.balance),
      amount:     body.amount,
    });
    if (cobolResult.status === 'ERROR') {
      await client.query('ROLLBACK');
      ctx.status = 400; ctx.body = { error: cobolResult.message }; return;
    }
    const newBalance = parseFloat(cobolResult.to_balance);
    // ────────────────────────────────────────────────────────────────────

    await client.query(
      `UPDATE wallets SET balance=$1, updated_at=NOW() WHERE id=$2`,
      [newBalance, w.id]
    );
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id,type,amount,balance_after,note,created_by)
       VALUES ($1,'topup',$2,$3,$4,$5)`,
      [w.id, body.amount, newBalance, body.note||'Top-up oleh admin', adminId]
    );
    const { rows:[adm] } = await client.query('SELECT full_name FROM users WHERE id=$1',[adminId]);
    await client.query(
      `INSERT INTO notifications (user_id,title,message,type,metadata)
       VALUES ($1,'Saldo KOIN Ditambahkan',$2,'system',$3)`,
      [body.user_id,
       `Saldo KOIN kamu ditambahkan ${body.amount} oleh ${adm?.full_name||'Admin'}`,
       JSON.stringify({amount:body.amount,type:'topup',_cobol:'CFWALLET'})]
    );
    await client.query('COMMIT');
    ctx.body = { message:'Top-up berhasil', balance:newBalance, _cobol:'CFWALLET TOPUP' };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally    { client.release(); }
});

// POST /wallet/transfer — COBOL validates + calculates both balances
router.post('/transfer', async (ctx) => {
  const body = z.object({
    to_user_id: z.string().uuid(),
    amount:     z.number().positive(),
    note:       z.string().optional(),
  }).parse(ctx.request.body);

  const fromUserId = ctx.state.user.sub;
  if (fromUserId===body.to_user_id) {
    ctx.status=400; ctx.body={error:'Tidak bisa transfer ke diri sendiri'}; return;
  }
  await ensureWallet(fromUserId);
  await ensureWallet(body.to_user_id);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows:[fromW] } = await client.query(
      `SELECT id,balance FROM wallets WHERE user_id=$1 FOR UPDATE`, [fromUserId]
    );
    const { rows:[toW] } = await client.query(
      `SELECT id,balance FROM wallets WHERE user_id=$1 FOR UPDATE`, [body.to_user_id]
    );

    // ── COBOL: validasi + hitung kedua saldo ─────────────────────────────
    const cobolResult = await cobol.calcKoinTransfer({
      from_balance: parseFloat(fromW.balance),
      to_balance:   parseFloat(toW.balance),
      amount:       body.amount,
    });
    if (cobolResult.status === 'ERROR') {
      await client.query('ROLLBACK');
      ctx.status=400; ctx.body={error:cobolResult.message}; return;
    }
    const newFromBalance = parseFloat(cobolResult.from_balance);
    const newToBalance   = parseFloat(cobolResult.to_balance);
    // ────────────────────────────────────────────────────────────────────

    await client.query(
      `UPDATE wallets SET balance=$1, updated_at=NOW() WHERE id=$2`, [newFromBalance, fromW.id]
    );
    await client.query(
      `UPDATE wallets SET balance=$1, updated_at=NOW() WHERE id=$2`, [newToBalance, toW.id]
    );

    const note = body.note||'Transfer KOIN';
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id,from_wallet_id,to_wallet_id,type,amount,balance_after,note,created_by)
       VALUES ($1,$2,$3,'transfer',$4,$5,$6,$7)`,
      [fromW.id,fromW.id,toW.id,body.amount,newFromBalance,note,fromUserId]
    );
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id,from_wallet_id,to_wallet_id,type,amount,balance_after,note,created_by)
       VALUES ($1,$2,$3,'transfer',$4,$5,$6,$7)`,
      [toW.id,fromW.id,toW.id,body.amount,newToBalance,note,fromUserId]
    );

    const { rows:[sender] } = await client.query('SELECT full_name FROM users WHERE id=$1',[fromUserId]);
    await client.query(
      `INSERT INTO notifications (user_id,title,message,type,metadata)
       VALUES ($1,'KOIN Diterima',$2,'system',$3)`,
      [body.to_user_id,
       `Kamu menerima ${body.amount} KOIN dari ${sender.full_name}`,
       JSON.stringify({amount:body.amount,from:fromUserId,_cobol:'CFWALLET'})]
    );

    await client.query('COMMIT');
    ctx.body = {
      message:      'Transfer berhasil',
      balance_after: newFromBalance,
      _cobol:       'CFWALLET CALC-TRANSFER',
    };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally    { client.release(); }
});

export default router;
