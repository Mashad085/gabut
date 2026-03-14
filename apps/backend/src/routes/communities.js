import Router from '@koa/router';
import { z } from 'zod';
import { db, withTransaction } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { enqueue, JOB_TYPES } from '../services/jobQueue.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';

const router = new Router();
router.use(authenticate);

router.get('/', async (ctx) => {
  const { type, page=1, limit=12, search } = ctx.query;
  const offset = (page-1)*limit;
  const userId = ctx.state.user.sub;
  const params = [userId];
  let where = '';
  if (type)   { params.push(type);        where += ` AND c.community_type=$${params.length}`; }
  if (search) { params.push(`%${search}%`); where += ` AND (c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`; }
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT c.*,
            COUNT(DISTINCT cm.id) AS member_count,
            u.full_name AS creator_name,
            CASE WHEN my.id IS NOT NULL THEN true ELSE false END AS is_member
     FROM communities c
     LEFT JOIN community_members cm ON cm.community_id=c.id
     LEFT JOIN users u ON u.id=c.created_by
     LEFT JOIN community_members my ON my.community_id=c.id AND my.user_id=$1
     WHERE c.is_public=true${where}
     GROUP BY c.id,u.full_name,my.id
     ORDER BY member_count DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params
  );
  ctx.body = { data: rows };
});

router.get('/my', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { rows } = await db.query(
    `SELECT c.*, cm.role AS my_role, cm.total_contributed,
            COUNT(DISTINCT cm2.id) AS member_count,
            COALESCE(cf.balance,0) AS main_fund_balance
     FROM communities c
     JOIN community_members cm ON cm.community_id=c.id AND cm.user_id=$1
     LEFT JOIN community_members cm2 ON cm2.community_id=c.id
     LEFT JOIN community_funds cf ON cf.community_id=c.id AND cf.fund_type='main'
     GROUP BY c.id,cm.role,cm.total_contributed,cf.balance
     ORDER BY c.created_at DESC`, [userId]
  );
  ctx.body = rows;
});

router.post('/', async (ctx) => {
  const body = z.object({
    name:                z.string().min(3).max(255),
    description:         z.string().optional(),
    community_type:      z.enum(['arisan','koperasi','savings_group','investment_club','general']),
    is_public:           z.boolean().default(true),
    max_members:         z.number().int().min(2).optional(),
    contribution_amount: z.number().positive().optional(),
  }).parse(ctx.request.body);
  const userId = ctx.state.user.sub;
  const slug = body.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')+'-'+Date.now();
  const result = await withTransaction(async (client) => {
    const { rows:[comm] } = await client.query(
      `INSERT INTO communities (name,slug,description,community_type,is_public,max_members,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.name,slug,body.description,body.community_type,body.is_public,body.max_members,userId]
    );
    await client.query(
      `INSERT INTO community_members (community_id,user_id,role,contribution_amount) VALUES ($1,$2,'admin',$3)`,
      [comm.id,userId,body.contribution_amount||0]
    );
    await client.query(
      `INSERT INTO community_funds (community_id,fund_name,fund_type) VALUES ($1,'Dana Utama','main')`,
      [comm.id]
    );
    return comm;
  });
  ctx.status=201; ctx.body=result;
});

router.get('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { rows:[comm] } = await db.query(
    `SELECT c.*,
            COUNT(DISTINCT cm.id) AS member_count,
            u.full_name AS creator_name,
            my.role AS my_role, my.total_contributed,
            COALESCE(SUM(cf.balance),0) AS total_funds
     FROM communities c
     LEFT JOIN community_members cm ON cm.community_id=c.id
     LEFT JOIN users u ON u.id=c.created_by
     LEFT JOIN community_members my ON my.community_id=c.id AND my.user_id=$2
     LEFT JOIN community_funds cf ON cf.community_id=c.id
     WHERE c.id=$1 OR c.slug=$1
     GROUP BY c.id,u.full_name,my.role,my.total_contributed`,
    [ctx.params.id, userId]
  );
  if (!comm) { ctx.status=404; ctx.body={error:'Komunitas tidak ditemukan'}; return; }
  ctx.body = comm;
});

// PUT /communities/:id — edit komunitas (admin komunitas atau app-admin)
router.put('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  const body = z.object({
    name:                z.string().min(3).max(255).optional(),
    description:         z.string().optional(),
    is_public:           z.boolean().optional(),
    max_members:         z.number().int().min(2).optional(),
    contribution_amount: z.number().positive().optional(),
  }).parse(ctx.request.body);

  // Hanya admin komunitas yang boleh edit
  const { rows:[mem] } = await db.query(
    `SELECT role FROM community_members WHERE community_id=$1 AND user_id=$2`, [ctx.params.id, userId]
  );
  const { rows:[appUser] } = await db.query(`SELECT role FROM users WHERE id=$1`,[userId]);
  if (mem?.role!=='admin' && appUser?.role!=='admin') { ctx.status=403; ctx.body={error:'Tidak diizinkan'}; return; }

  const { rows:[c] } = await db.query(
    `UPDATE communities SET
       name=COALESCE($1,name), description=COALESCE($2,description),
       is_public=COALESCE($3,is_public), max_members=COALESCE($4,max_members),
       updated_at=NOW()
     WHERE id=$5 RETURNING *`,
    [body.name,body.description,body.is_public,body.max_members,ctx.params.id]
  );
  ctx.body = c;
});

// DELETE /communities/:id
router.delete('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { rows:[c] } = await db.query('SELECT created_by FROM communities WHERE id=$1',[ctx.params.id]);
  const { rows:[u] } = await db.query('SELECT role FROM users WHERE id=$1',[userId]);
  if (c?.created_by!==userId && u?.role!=='admin') { ctx.status=403; ctx.body={error:'Tidak diizinkan'}; return; }
  await db.query('DELETE FROM communities WHERE id=$1',[ctx.params.id]);
  ctx.body={message:'Komunitas dihapus'};
});

router.post('/:id/join', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { rows:[comm] } = await db.query('SELECT * FROM communities WHERE id=$1 AND is_public=true',[ctx.params.id]);
  if (!comm) { ctx.status=404; ctx.body={error:'Komunitas tidak ditemukan'}; return; }
  const { rows:ex } = await db.query('SELECT id FROM community_members WHERE community_id=$1 AND user_id=$2',[ctx.params.id,userId]);
  if (ex.length) { ctx.status=409; ctx.body={error:'Sudah menjadi anggota'}; return; }
  await db.query(`INSERT INTO community_members (community_id,user_id,role) VALUES ($1,$2,'member')`,[ctx.params.id,userId]);
  ctx.body={message:'Berhasil bergabung'};
});

// POST /communities/:id/add-member — admin tambah anggota langsung (by email/username)
router.post('/:id/add-member', async (ctx) => {
  const userId = ctx.state.user.sub;
  const body = z.object({
    identifier: z.string(), // email atau username
    role: z.enum(['member','admin']).default('member'),
  }).parse(ctx.request.body);

  const { rows:[mem] } = await db.query('SELECT role FROM community_members WHERE community_id=$1 AND user_id=$2',[ctx.params.id,userId]);
  const { rows:[u]   } = await db.query('SELECT role FROM users WHERE id=$1',[userId]);
  if (mem?.role!=='admin' && u?.role!=='admin') { ctx.status=403; ctx.body={error:'Hanya admin komunitas yang bisa menambah anggota'}; return; }

  const { rows:[target] } = await db.query('SELECT id,full_name FROM users WHERE email=$1 OR username=$1',[body.identifier]);
  if (!target) { ctx.status=404; ctx.body={error:'User tidak ditemukan'}; return; }

  const { rows:ex } = await db.query('SELECT id FROM community_members WHERE community_id=$1 AND user_id=$2',[ctx.params.id,target.id]);
  if (ex.length) { ctx.status=409; ctx.body={error:'User sudah menjadi anggota'}; return; }

  await db.query(`INSERT INTO community_members (community_id,user_id,role) VALUES ($1,$2,$3)`,[ctx.params.id,target.id,body.role]);
  await db.query(
    `INSERT INTO notifications (user_id,title,message,type,metadata) VALUES ($1,'Ditambahkan ke Komunitas',$2,'community',$3)`,
    [target.id,`Kamu ditambahkan ke komunitas`,JSON.stringify({communityId:ctx.params.id})]
  );
  ctx.status=201; ctx.body={message:`${target.full_name} berhasil ditambahkan`};
});

// DELETE /communities/:id/members/:userId — hapus anggota
router.delete('/:id/members/:memberId', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { rows:[mem] } = await db.query('SELECT role FROM community_members WHERE community_id=$1 AND user_id=$2',[ctx.params.id,userId]);
  const { rows:[u]   } = await db.query('SELECT role FROM users WHERE id=$1',[userId]);
  // Bisa hapus diri sendiri (leave) atau admin hapus orang lain
  if (ctx.params.memberId!==userId && mem?.role!=='admin' && u?.role!=='admin') {
    ctx.status=403; ctx.body={error:'Tidak diizinkan'}; return;
  }
  await db.query('DELETE FROM community_members WHERE community_id=$1 AND user_id=$2',[ctx.params.id,ctx.params.memberId]);
  ctx.body={message:'Anggota dikeluarkan'};
});

// PATCH /communities/:id/members/:memberId/role — ubah role
router.patch('/:id/members/:memberId/role', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { role } = z.object({ role: z.enum(['member','admin']) }).parse(ctx.request.body);
  const { rows:[mem] } = await db.query('SELECT role FROM community_members WHERE community_id=$1 AND user_id=$2',[ctx.params.id,userId]);
  const { rows:[u]   } = await db.query('SELECT role FROM users WHERE id=$1',[userId]);
  if (mem?.role!=='admin' && u?.role!=='admin') { ctx.status=403; ctx.body={error:'Tidak diizinkan'}; return; }
  await db.query('UPDATE community_members SET role=$1 WHERE community_id=$2 AND user_id=$3',[role,ctx.params.id,ctx.params.memberId]);
  ctx.body={message:'Role diperbarui'};
});

router.get('/:id/members', async (ctx) => {
  const { rows } = await db.query(
    `SELECT cm.*, u.full_name, u.username, u.avatar_url, u.email
     FROM community_members cm JOIN users u ON u.id=cm.user_id
     WHERE cm.community_id=$1 ORDER BY cm.role,cm.joined_at`, [ctx.params.id]
  );
  ctx.body = rows;
});

router.get('/:id/transactions', async (ctx) => {
  const { page=1, limit=20 } = ctx.query;
  const offset = (page-1)*limit;
  const { rows } = await db.query(
    `SELECT ct.*, u.full_name, u.username FROM community_transactions ct
     JOIN users u ON u.id=ct.user_id
     WHERE ct.community_id=$1 ORDER BY ct.created_at DESC LIMIT $2 OFFSET $3`,
    [ctx.params.id, limit, offset]
  );
  ctx.body = { data: rows };
});

router.post('/:id/contribute', async (ctx) => {
  const body = z.object({
    amount:          z.number().positive(),
    from_account_id: z.string().uuid(),
    description:     z.string().optional(),
  }).parse(ctx.request.body);
  const userId = ctx.state.user.sub;

  const { rows:[mem] } = await db.query('SELECT * FROM community_members WHERE community_id=$1 AND user_id=$2',[ctx.params.id,userId]);
  if (!mem) { ctx.status=403; ctx.body={error:'Bukan anggota komunitas ini'}; return; }

  const result = await withTransaction(async (client) => {
    const { rows:[acc] } = await client.query('SELECT * FROM bank_accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',[body.from_account_id,userId]);
    if (!acc || acc.balance < body.amount) { const e=new Error('Saldo tidak mencukupi'); e.status=400; throw e; }
    await client.query('UPDATE bank_accounts SET balance=balance-$1, updated_at=NOW() WHERE id=$2',[body.amount,body.from_account_id]);
    const { rows:[fund] } = await client.query(`SELECT id FROM community_funds WHERE community_id=$1 AND fund_type='main'`,[ctx.params.id]);
    await client.query('UPDATE community_funds SET balance=balance+$1 WHERE id=$2',[body.amount,fund.id]);
    await client.query('UPDATE community_members SET total_contributed=total_contributed+$1 WHERE community_id=$2 AND user_id=$3',[body.amount,ctx.params.id,userId]);
    const { rows:[txn] } = await client.query(
      `INSERT INTO community_transactions (community_id,fund_id,user_id,transaction_type,amount,description,status)
       VALUES ($1,$2,$3,'contribution',$4,$5,'completed') RETURNING *`,
      [ctx.params.id,fund.id,userId,body.amount,body.description||'Kontribusi']
    );
    return txn;
  });
  ctx.status=201; ctx.body=result;
});

export default router;
