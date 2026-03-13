/**
 * Job processor — dijalankan in-process di backend
 * Menggantikan worker service terpisah
 */
import cron from 'node-cron';
import { db } from '../db/postgres.js';
import { claimJobs, completeJob, failJob, cleanupOldJobs, JOB_TYPES } from './jobQueue.js';

// ── Handler per job type ──────────────────────────────────────────────────────

async function handleSendNotification(payload) {
  const { user_id, title, message, type = 'system', metadata = {} } = payload;
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [user_id, title, message, type, JSON.stringify(metadata)]
  );
}

async function handleWriteAudit(payload) {
  const { user_id, action, resource, resource_id, details = {}, ip } = payload;
  await db.query(
    `INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user_id, action, resource, resource_id, JSON.stringify(details), ip]
  );
}

async function handleProcessTransaction(payload) {
  // Kirim notifikasi ke user setelah transaksi
  const { user_id, amount, type, description } = payload;
  const label = type === 'income' ? 'masuk' : 'keluar';
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Math.abs(amount));
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, metadata)
     VALUES ($1, $2, $3, 'transaction', $4)`,
    [
      user_id,
      `Transaksi ${label}: ${formatted}`,
      description || `Dana ${label} sebesar ${formatted} telah dicatat`,
      JSON.stringify(payload),
    ]
  );
}

async function handleScheduledPayment(payload) {
  const { scheduled_id } = payload;

  const { rows } = await db.query(
    `SELECT st.*, ba.balance FROM scheduled_transactions st
     JOIN bank_accounts ba ON st.account_id = ba.id
     WHERE st.id = $1 AND st.is_active = true`,
    [scheduled_id]
  );
  if (!rows.length) return;

  const s = rows[0];

  // Create the transaction
  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO transactions (account_id, user_id, type, amount, description, category, reference_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [s.account_id, s.user_id, s.type, s.amount, s.description, s.category, `SCH-${s.id}`]
    );

    const delta = s.type === 'income' ? s.amount : -s.amount;
    await db.query(`UPDATE bank_accounts SET balance = balance + $1 WHERE id = $2`, [delta, s.account_id]);

    // Update next run
    await db.query(
      `UPDATE scheduled_transactions
       SET last_run_at = NOW(),
           next_run_at = CASE frequency
             WHEN 'daily'   THEN NOW() + INTERVAL '1 day'
             WHEN 'weekly'  THEN NOW() + INTERVAL '7 days'
             WHEN 'monthly' THEN NOW() + INTERVAL '1 month'
             ELSE NULL END
       WHERE id = $1`,
      [s.id]
    );
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

// dispatch map
const HANDLERS = {
  [JOB_TYPES.SEND_NOTIFICATION]:  handleSendNotification,
  [JOB_TYPES.WRITE_AUDIT]:        handleWriteAudit,
  [JOB_TYPES.PROCESS_TRANSACTION]:handleProcessTransaction,
  [JOB_TYPES.SCHEDULED_PAYMENT]:  handleScheduledPayment,
  [JOB_TYPES.SEND_EMAIL]:         async () => { /* SMTP opsional, skip jika tidak dikonfigurasi */ },
};

// ── Worker loop ───────────────────────────────────────────────────────────────

let isRunning = false;

async function runJobs() {
  if (isRunning) return;
  isRunning = true;
  try {
    const jobs = await claimJobs(10);
    for (const job of jobs) {
      const handler = HANDLERS[job.type];
      if (!handler) {
        await failJob(job.id, `Unknown job type: ${job.type}`, 0);
        continue;
      }
      try {
        await handler(job.payload);
        await completeJob(job.id);
      } catch (err) {
        console.error(`[JobWorker] Job ${job.id} (${job.type}) failed:`, err.message);
        await failJob(job.id, err.message);
      }
    }
  } catch (err) {
    console.error('[JobWorker] Poll error:', err.message);
  } finally {
    isRunning = false;
  }
}

// ── Scheduled jobs (cron) ─────────────────────────────────────────────────────

async function processScheduledTransactions() {
  try {
    const { rows } = await db.query(
      `SELECT id FROM scheduled_transactions
       WHERE is_active = true
         AND next_run_at <= NOW()
         AND (end_date IS NULL OR end_date >= NOW())`
    );
    const { enqueue } = await import('./jobQueue.js');
    for (const row of rows) {
      await enqueue(JOB_TYPES.SCHEDULED_PAYMENT, { scheduled_id: row.id }, { priority: 3 });
    }
    if (rows.length) console.log(`[Cron] Enqueued ${rows.length} scheduled transactions`);
  } catch (err) {
    console.error('[Cron] Scheduled transactions error:', err.message);
  }
}

async function processMonthlyInterest() {
  try {
    const { rows } = await db.query(
      `SELECT id, balance FROM bank_accounts WHERE type = 'savings' AND balance > 0`
    );
    for (const acc of rows) {
      const interest = Math.round(acc.balance * 0.005); // 0.5% / bulan
      if (interest < 100) continue;
      await db.query(
        `INSERT INTO transactions (account_id, user_id, type, amount, description, category)
         SELECT $1, user_id, 'income', $2, 'Bunga tabungan bulanan', 'interest'
         FROM bank_accounts WHERE id = $1`,
        [acc.id, interest]
      );
      await db.query(`UPDATE bank_accounts SET balance = balance + $1 WHERE id = $2`, [interest, acc.id]);
    }
    if (rows.length) console.log(`[Cron] Monthly interest processed for ${rows.length} savings accounts`);
  } catch (err) {
    console.error('[Cron] Monthly interest error:', err.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

export function startJobProcessor() {
  // Poll job queue setiap 5 detik
  cron.schedule('*/5 * * * * *', runJobs);

  // Cek scheduled transactions setiap menit
  cron.schedule('* * * * *', processScheduledTransactions);

  // Bunga tabungan setiap tanggal 1, jam 01:00
  cron.schedule('0 1 1 * *', processMonthlyInterest);

  // Cleanup job lama setiap hari jam 03:00
  cron.schedule('0 3 * * *', () => cleanupOldJobs(7));

  console.log('✅ Job processor started (PostgreSQL queue)');
}
