import Router from '@koa/router';
import { db } from '../db/postgres.js';
import { authenticate } from '../middleware/authenticate.js';

const router = new Router();
router.use(authenticate);

router.get('/', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { page=1, limit=20, unread_only } = ctx.query;
  const offset = (page-1)*limit;
  let where = 'WHERE user_id=$1';
  if (unread_only==='true') where += ' AND is_read=false';
  const { rows } = await db.query(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,[userId,limit,offset]);
  const { rows:[{count}] } = await db.query('SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false',[userId]);
  ctx.body = { data:rows, unread_count:parseInt(count) };
});

// PATCH read-all harus sebelum /:id supaya tidak conflict
router.patch('/read-all', async (ctx) => {
  await db.query('UPDATE notifications SET is_read=true WHERE user_id=$1',[ctx.state.user.sub]);
  ctx.body={message:'Semua ditandai dibaca'};
});

router.patch('/:id/read', async (ctx) => {
  await db.query('UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2',[ctx.params.id,ctx.state.user.sub]);
  ctx.body={message:'Ditandai dibaca'};
});

router.delete('/:id', async (ctx) => {
  await db.query('DELETE FROM notifications WHERE id=$1 AND user_id=$2',[ctx.params.id,ctx.state.user.sub]);
  ctx.body={message:'Notifikasi dihapus'};
});

export default router;
