import Router from '@koa/router';
import { z } from 'zod';
import { db, withTransaction } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { enqueue, JOB_TYPES } from '../services/jobQueue.js';
import { authenticate } from '../middleware/authenticate.js';

const router = new Router();
router.use(authenticate);

// GET /communities - List public communities
router.get('/', async (ctx) => {
  const { type, page = 1, limit = 12, search } = ctx.query;
  const offset = (page - 1) * limit;
  
  let whereClause = 'WHERE c.is_public = true';
  const params = [];
  
  if (type) {
    params.push(type);
    whereClause += ` AND c.community_type = $${params.length}`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`;
  }
  
  const communities = await db.query(
    `SELECT c.*, 
            COUNT(DISTINCT cm.id) as member_count,
            u.full_name as creator_name,
            CASE WHEN my_mem.id IS NOT NULL THEN true ELSE false END as is_member
     FROM communities c
     LEFT JOIN community_members cm ON cm.community_id = c.id
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN community_members my_mem ON my_mem.community_id = c.id AND my_mem.user_id = $${params.length + 1}
     ${whereClause}
     GROUP BY c.id, u.full_name, my_mem.id
     ORDER BY member_count DESC
     LIMIT $${params.length + 2} OFFSET $${params.length + 3}`,
    [...params, ctx.state.user.sub, limit, offset]
  );
  
  ctx.body = { data: communities.rows };
});

// GET /communities/my - My communities
router.get('/my', async (ctx) => {
  const userId = ctx.state.user.sub;
  
  const communities = await db.query(
    `SELECT c.*, cm.role as my_role, cm.total_contributed,
            COUNT(DISTINCT cm2.id) as member_count,
            cf.balance as main_fund_balance
     FROM communities c
     JOIN community_members cm ON cm.community_id = c.id AND cm.user_id = $1
     LEFT JOIN community_members cm2 ON cm2.community_id = c.id
     LEFT JOIN community_funds cf ON cf.community_id = c.id AND cf.fund_type = 'main'
     GROUP BY c.id, cm.role, cm.total_contributed, cf.balance
     ORDER BY c.created_at DESC`,
    [userId]
  );
  
  ctx.body = communities.rows;
});

// POST /communities - Create community
router.post('/', async (ctx) => {
  const schema = z.object({
    name: z.string().min(3).max(255),
    description: z.string().optional(),
    community_type: z.enum(['arisan', 'koperasi', 'savings_group', 'investment_club', 'general']),
    is_public: z.boolean().default(true),
    max_members: z.number().int().min(2).optional(),
    contribution_amount: z.number().positive().optional(),
  });
  
  const body = schema.parse(ctx.request.body);
  const userId = ctx.state.user.sub;
  const slug = body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
  
  const result = await withTransaction(async (client) => {
    const community = await client.query(
      `INSERT INTO communities (name, slug, description, community_type, is_public, max_members, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.name, slug, body.description, body.community_type, body.is_public, body.max_members, userId]
    );
    
    const comm = community.rows[0];
    
    // Add creator as admin member
    await client.query(
      `INSERT INTO community_members (community_id, user_id, role, contribution_amount)
       VALUES ($1, $2, 'admin', $3)`,
      [comm.id, userId, body.contribution_amount || 0]
    );
    
    // Create main fund
    await client.query(
      `INSERT INTO community_funds (community_id, fund_name, fund_type)
       VALUES ($1, 'Dana Utama', 'main')`,
      [comm.id]
    );
    
    return comm;
  });
  
  ctx.status = 201;
  ctx.body = result;
});

// GET /communities/:id
router.get('/:id', async (ctx) => {
  const userId = ctx.state.user.sub;
  
  const community = await db.query(
    `SELECT c.*, 
            COUNT(DISTINCT cm.id) as member_count,
            u.full_name as creator_name,
            my_mem.role as my_role,
            my_mem.total_contributed,
            COALESCE(SUM(cf.balance), 0) as total_funds
     FROM communities c
     LEFT JOIN community_members cm ON cm.community_id = c.id
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN community_members my_mem ON my_mem.community_id = c.id AND my_mem.user_id = $2
     LEFT JOIN community_funds cf ON cf.community_id = c.id
     WHERE c.id = $1 OR c.slug = $1
     GROUP BY c.id, u.full_name, my_mem.role, my_mem.total_contributed`,
    [ctx.params.id, userId]
  );
  
  if (!community.rows[0]) {
    ctx.status = 404;
    ctx.body = { error: 'Community not found' };
    return;
  }
  
  ctx.body = community.rows[0];
});

// POST /communities/:id/join
router.post('/:id/join', async (ctx) => {
  const userId = ctx.state.user.sub;
  
  const community = await db.query(
    'SELECT * FROM communities WHERE id = $1 AND is_public = true',
    [ctx.params.id]
  );
  
  if (!community.rows[0]) {
    ctx.status = 404;
    ctx.body = { error: 'Community not found' };
    return;
  }
  
  const existing = await db.query(
    'SELECT id FROM community_members WHERE community_id = $1 AND user_id = $2',
    [ctx.params.id, userId]
  );
  
  if (existing.rows.length > 0) {
    ctx.status = 409;
    ctx.body = { error: 'Already a member' };
    return;
  }
  
  await db.query(
    `INSERT INTO community_members (community_id, user_id, role)
     VALUES ($1, $2, 'member')`,
    [ctx.params.id, userId]
  );
  
  // Notify community admins via job queue
  const admins = await ctx.db.query(
    `SELECT cm.user_id FROM community_members cm WHERE cm.community_id = $1 AND cm.role = 'admin'`,
    [ctx.params.id]
  );
  const joiner = await ctx.db.query('SELECT full_name FROM users WHERE id = $1', [userId]);
  for (const admin of admins.rows) {
    await enqueue(JOB_TYPES.SEND_NOTIFICATION, {
      user_id: admin.user_id,
      title: 'Anggota Baru Bergabung',
      message: `${joiner.rows[0]?.full_name || 'Seseorang'} telah bergabung ke komunitas`,
      type: 'community',
      metadata: { communityId: ctx.params.id, userId },
    });
  }
  
  ctx.body = { message: 'Successfully joined community' };
});

// GET /communities/:id/members
router.get('/:id/members', async (ctx) => {
  const members = await db.query(
    `SELECT cm.*, u.full_name, u.username, u.avatar_url, u.email
     FROM community_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.community_id = $1
     ORDER BY cm.role, cm.joined_at`,
    [ctx.params.id]
  );
  
  ctx.body = members.rows;
});

// GET /communities/:id/transactions
router.get('/:id/transactions', async (ctx) => {
  const { page = 1, limit = 20 } = ctx.query;
  const offset = (page - 1) * limit;
  
  const transactions = await db.query(
    `SELECT ct.*, u.full_name, u.username
     FROM community_transactions ct
     JOIN users u ON u.id = ct.user_id
     WHERE ct.community_id = $1
     ORDER BY ct.created_at DESC
     LIMIT $2 OFFSET $3`,
    [ctx.params.id, limit, offset]
  );
  
  ctx.body = { data: transactions.rows };
});

// POST /communities/:id/contribute
router.post('/:id/contribute', async (ctx) => {
  const schema = z.object({
    amount: z.number().positive(),
    from_account_id: z.string().uuid(),
    description: z.string().optional(),
  });
  
  const body = schema.parse(ctx.request.body);
  const userId = ctx.state.user.sub;
  
  // Verify membership
  const member = await db.query(
    'SELECT * FROM community_members WHERE community_id = $1 AND user_id = $2',
    [ctx.params.id, userId]
  );
  
  if (!member.rows[0]) {
    ctx.status = 403;
    ctx.body = { error: 'You are not a member of this community' };
    return;
  }
  
  const result = await withTransaction(async (client) => {
    // Debit user account
    const account = await client.query(
      'SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [body.from_account_id, userId]
    );
    
    if (!account.rows[0] || account.rows[0].balance < body.amount) {
      const err = new Error('Insufficient balance');
      err.status = 400;
      throw err;
    }
    
    const newBalance = parseFloat(account.rows[0].balance) - body.amount;
    await client.query(
      'UPDATE bank_accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, body.from_account_id]
    );
    
    // Update community fund
    const fund = await client.query(
      'SELECT id FROM community_funds WHERE community_id = $1 AND fund_type = \'main\'',
      [ctx.params.id]
    );
    
    await client.query(
      'UPDATE community_funds SET balance = balance + $1 WHERE id = $2',
      [body.amount, fund.rows[0].id]
    );
    
    // Update member contribution
    await client.query(
      'UPDATE community_members SET total_contributed = total_contributed + $1 WHERE community_id = $2 AND user_id = $3',
      [body.amount, ctx.params.id, userId]
    );
    
    // Record transaction
    const txn = await client.query(
      `INSERT INTO community_transactions (community_id, fund_id, user_id, transaction_type, amount, description, status)
       VALUES ($1, $2, $3, 'contribution', $4, $5, 'completed') RETURNING *`,
      [ctx.params.id, fund.rows[0].id, userId, body.amount, body.description || 'Kontribusi']
    );
    
    return txn.rows[0];
  });
  
  ctx.status = 201;
  ctx.body = result;
});

export default router;
