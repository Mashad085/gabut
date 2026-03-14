import Router from '@koa/router';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { authenticate } from '../middleware/authenticate.js';
import cobol from '../services/cobol-bridge.js';

const router = new Router();
router.use(authenticate);

// GET /budgets
router.get('/', async (ctx) => {
  const { rows } = await db.query(
    `SELECT b.*,
       (SELECT COALESCE(SUM(budgeted_amount),0) FROM budget_categories bc
        WHERE bc.budget_id=b.id AND bc.is_income=false) AS total_budgeted,
       (SELECT COALESCE(SUM(spent_amount),0)    FROM budget_categories bc
        WHERE bc.budget_id=b.id AND bc.is_income=false) AS total_spent
     FROM budgets b WHERE b.user_id=$1 ORDER BY b.period_start DESC LIMIT 24`,
    [ctx.state.user.sub]
  );

  // COBOL: analisis kesehatan tiap anggaran
  const enriched = await Promise.all(rows.map(async (b) => {
    try {
      const h = await cobol.analyzeBudgetHealth({
        total_income:   parseFloat(b.total_income   || 0),
        total_budgeted: parseFloat(b.total_budgeted || 0),
      });
      return { ...b, health: h.health || 'GOOD', pct_used: h.pct_used || 0 };
    } catch { return { ...b, health: 'GOOD', pct_used: 0 }; }
  }));

  ctx.body = enriched;
});

// POST /budgets
router.post('/', async (ctx) => {
  const body = z.object({
    name:         z.string().min(1),
    period_type:  z.enum(['monthly','yearly']),
    period_start: z.string(),
    period_end:   z.string(),
    total_income: z.number().default(0),
  }).parse(ctx.request.body);
  const { rows:[b] } = await db.query(
    `INSERT INTO budgets (user_id,name,period_type,period_start,period_end,total_income)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [ctx.state.user.sub, body.name, body.period_type, body.period_start, body.period_end, body.total_income]
  );
  ctx.status=201; ctx.body=b;
});

// GET /budgets/:id — detail + COBOL analisis per kategori
router.get('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  const [{ rows:[b] }, { rows:cats }] = await Promise.all([
    db.query('SELECT * FROM budgets WHERE id=$1 AND user_id=$2',[ctx.params.id,userId]),
    db.query(
      'SELECT * FROM budget_categories WHERE budget_id=$1 ORDER BY is_income DESC,budgeted_amount DESC',
      [ctx.params.id]
    ),
  ]);
  if (!b) { ctx.status=404; ctx.body={error:'Anggaran tidak ditemukan'}; return; }

  const expCats      = cats.filter(c => !c.is_income);
  const totalBudgeted = expCats.reduce((s,c) => s+parseFloat(c.budgeted_amount||0), 0);
  const totalSpent    = expCats.reduce((s,c) => s+parseFloat(c.spent_amount||0),    0);

  // COBOL: analisis keseluruhan
  let analysis = { health:'GOOD', pct_used:0, remaining:0, message:'' };
  try {
    const r = await cobol.analyzeBudgetHealth({
      total_income:   parseFloat(b.total_income || 0),
      total_budgeted: totalBudgeted,
    });
    analysis = { health:r.health||'GOOD', pct_used:r.pct_used||0,
                 remaining:r.remaining||0, message:r.message||'' };
  } catch {}

  // COBOL: sisa per kategori pengeluaran
  const catsEnriched = await Promise.all(cats.map(async (cat) => {
    if (cat.is_income) return cat;
    try {
      const r = await cobol.calcBudgetRemaining({
        budgeted: parseFloat(cat.budgeted_amount || 0),
        spent:    parseFloat(cat.spent_amount    || 0),
      });
      return { ...cat, remaining:r.remaining||0, pct_used:r.pct_used||0, cobol_calc:true };
    } catch {
      return { ...cat,
        remaining: parseFloat(cat.budgeted_amount||0) - parseFloat(cat.spent_amount||0),
        pct_used: 0, cobol_calc: false };
    }
  }));

  ctx.body = { ...b, total_budgeted:totalBudgeted, total_spent:totalSpent,
               analysis, categories:catsEnriched, _engine:'GnuCOBOL CFBUDGET' };
});

// PUT /budgets/:id
router.put('/:id', async (ctx) => {
  const body = z.object({
    name:         z.string().min(1).optional(),
    total_income: z.number().optional(),
  }).parse(ctx.request.body);
  const { rows:[b] } = await db.query(
    `UPDATE budgets SET name=COALESCE($1,name), total_income=COALESCE($2,total_income),
       updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING *`,
    [body.name, body.total_income, ctx.params.id, ctx.state.user.sub]
  );
  if (!b) { ctx.status=404; ctx.body={error:'Anggaran tidak ditemukan'}; return; }
  ctx.body=b;
});

// DELETE /budgets/:id
router.delete('/:id', async (ctx) => {
  await db.query('DELETE FROM budgets WHERE id=$1 AND user_id=$2',[ctx.params.id, ctx.state.user.sub]);
  ctx.body={message:'Anggaran dihapus'};
});

// POST /budgets/:id/categories
router.post('/:id/categories', async (ctx) => {
  const body = z.object({
    name:            z.string().min(1),
    budgeted_amount: z.number().min(0),
    color:           z.string().optional(),
    icon:            z.string().optional(),
    is_income:       z.boolean().default(false),
  }).parse(ctx.request.body);

  const { rows:[b] } = await db.query(
    'SELECT id,total_income FROM budgets WHERE id=$1 AND user_id=$2',
    [ctx.params.id, ctx.state.user.sub]
  );
  if (!b) { ctx.status=404; ctx.body={error:'Anggaran tidak ditemukan'}; return; }

  // COBOL: cek apakah tambah kategori ini membahayakan anggaran
  if (!body.is_income && body.budgeted_amount > 0 && parseFloat(b.total_income) > 0) {
    try {
      const { rows:[existing] } = await db.query(
        `SELECT COALESCE(SUM(budgeted_amount),0) AS tot
         FROM budget_categories WHERE budget_id=$1 AND is_income=false`, [ctx.params.id]
      );
      const check = await cobol.analyzeBudgetHealth({
        total_income:   parseFloat(b.total_income),
        total_budgeted: parseFloat(existing.tot) + body.budgeted_amount,
      });
      if (check.health === 'DANGER') ctx.set('X-Budget-Warning', check.message);
    } catch {}
  }

  const { rows:[cat] } = await db.query(
    `INSERT INTO budget_categories (budget_id,name,budgeted_amount,color,icon,is_income)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [ctx.params.id, body.name, body.budgeted_amount,
     body.color||'#6366f1', body.icon||'circle', body.is_income]
  );
  ctx.status=201; ctx.body=cat;
});

// PUT /budgets/:id/categories/:catId
router.put('/:id/categories/:catId', async (ctx) => {
  const body = z.object({
    name:            z.string().min(1).optional(),
    budgeted_amount: z.number().min(0).optional(),
    spent_amount:    z.number().min(0).optional(),
    color:           z.string().optional(),
  }).parse(ctx.request.body);

  // COBOL: validasi jika ada update pengeluaran
  if (body.spent_amount !== undefined && body.spent_amount > 0) {
    try {
      const { rows:[ex] } = await db.query(
        'SELECT budgeted_amount FROM budget_categories WHERE id=$1', [ctx.params.catId]
      );
      if (ex) {
        const check = await cobol.validateBudgetSpend({
          budgeted: parseFloat(ex.budgeted_amount || 0),
          spent:    0,
          amount:   body.spent_amount,
        });
        if (check.status === 'ERROR') { ctx.status=400; ctx.body={error:check.message}; return; }
        if (check.status === 'WARN')  ctx.set('X-Budget-Warning', check.message);
      }
    } catch {}
  }

  const { rows:[cat] } = await db.query(
    `UPDATE budget_categories SET
       name=COALESCE($1,name), budgeted_amount=COALESCE($2,budgeted_amount),
       spent_amount=COALESCE($3,spent_amount), color=COALESCE($4,color)
     WHERE id=$5 AND budget_id=$6 RETURNING *`,
    [body.name, body.budgeted_amount, body.spent_amount,
     body.color, ctx.params.catId, ctx.params.id]
  );
  if (!cat) { ctx.status=404; ctx.body={error:'Kategori tidak ditemukan'}; return; }
  ctx.body=cat;
});

// DELETE /budgets/:id/categories/:catId
router.delete('/:id/categories/:catId', async (ctx) => {
  await db.query('DELETE FROM budget_categories WHERE id=$1 AND budget_id=$2',
    [ctx.params.catId, ctx.params.id]);
  ctx.body={message:'Kategori dihapus'};
});

export default router;
