import Router from '@koa/router';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { authenticate } from '../middleware/authenticate.js';

const router = new Router();
router.use(authenticate);

router.get('/', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { rows } = await db.query(
    `SELECT st.*, ba.account_name, ba.account_number
     FROM scheduled_transactions st
     JOIN bank_accounts ba ON ba.id=st.account_id
     WHERE ba.user_id=$1 AND st.is_active=true
     ORDER BY st.next_run_at ASC`, [userId]
  );
  ctx.body = rows;
});

router.post('/', async (ctx) => {
  const body = z.object({
    account_id:       z.string().uuid(),
    transaction_type: z.enum(['debit','credit']),
    amount:           z.number().positive(),
    description:      z.string().optional(),
    payee:            z.string().optional(),
    category:         z.string().optional(),
    frequency:        z.enum(['daily','weekly','monthly','yearly','once']),
    next_run_at:      z.string(),
    end_date:         z.string().optional(),
  }).parse(ctx.request.body);
  const userId = ctx.state.user.sub;

  // Verify account belongs to user
  const { rows:[acc] } = await db.query('SELECT id FROM bank_accounts WHERE id=$1 AND user_id=$2',[body.account_id,userId]);
  if (!acc) { ctx.status=403; ctx.body={error:'Rekening tidak ditemukan'}; return; }

  const { rows:[s] } = await db.query(
    `INSERT INTO scheduled_transactions
       (account_id,transaction_type,amount,description,payee,category,frequency,next_run_at,end_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [body.account_id,body.transaction_type,body.amount,body.description,body.payee,body.category,body.frequency,body.next_run_at,body.end_date||null]
  );
  ctx.status=201; ctx.body=s;
});

router.put('/:id', async (ctx) => {
  const body = z.object({
    amount:      z.number().positive().optional(),
    description: z.string().optional(),
    payee:       z.string().optional(),
    category:    z.string().optional(),
    frequency:   z.enum(['daily','weekly','monthly','yearly','once']).optional(),
    next_run_at: z.string().optional(),
    end_date:    z.string().optional(),
    is_active:   z.boolean().optional(),
  }).parse(ctx.request.body);
  const userId = ctx.state.user.sub;

  const { rows:[s] } = await db.query(
    `UPDATE scheduled_transactions SET
       amount=COALESCE($1,amount), description=COALESCE($2,description),
       payee=COALESCE($3,payee), category=COALESCE($4,category),
       frequency=COALESCE($5,frequency), next_run_at=COALESCE($6,next_run_at),
       end_date=COALESCE($7,end_date), is_active=COALESCE($8,is_active)
     WHERE id=$9 AND account_id IN (SELECT id FROM bank_accounts WHERE user_id=$10)
     RETURNING *`,
    [body.amount,body.description,body.payee,body.category,body.frequency,body.next_run_at,body.end_date,body.is_active,ctx.params.id,userId]
  );
  if (!s) { ctx.status=404; ctx.body={error:'Jadwal tidak ditemukan'}; return; }
  ctx.body=s;
});

router.delete('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  await db.query(
    `UPDATE scheduled_transactions SET is_active=false
     WHERE id=$1 AND account_id IN (SELECT id FROM bank_accounts WHERE user_id=$2)`,
    [ctx.params.id, userId]
  );
  ctx.body={message:'Jadwal dihapus'};
});

export default router;
