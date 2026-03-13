/**
 * PostgreSQL-based job queue — pengganti RabbitMQ
 * Jobs disimpan di tabel `job_queue`, diproses oleh worker cron setiap 5 detik
 */
import { db } from '../db/postgres.js';

export const JOB_TYPES = {
  SEND_NOTIFICATION: 'send_notification',
  SEND_EMAIL: 'send_email',
  PROCESS_TRANSACTION: 'process_transaction',
  SCHEDULED_PAYMENT: 'scheduled_payment',
  WRITE_AUDIT: 'write_audit',
};

/**
 * Enqueue a job
 * @param {string} type - JOB_TYPES value
 * @param {object} payload - Job data
 * @param {object} opts - { delay_seconds, priority }
 */
export async function enqueue(type, payload, opts = {}) {
  const { delay_seconds = 0, priority = 5 } = opts;
  const run_at = new Date(Date.now() + delay_seconds * 1000);

  const result = await db.query(
    `INSERT INTO job_queue (type, payload, priority, run_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [type, JSON.stringify(payload), priority, run_at]
  );
  return result.rows[0].id;
}

/**
 * Claim and return next pending jobs (locked for this worker)
 */
export async function claimJobs(limit = 10) {
  const result = await db.query(
    `UPDATE job_queue
     SET status = 'processing', started_at = NOW()
     WHERE id IN (
       SELECT id FROM job_queue
       WHERE status = 'pending'
         AND run_at <= NOW()
       ORDER BY priority ASC, run_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [limit]
  );
  return result.rows;
}

/**
 * Mark job as done
 */
export async function completeJob(id) {
  await db.query(
    `UPDATE job_queue SET status = 'done', completed_at = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * Mark job as failed (with retry)
 */
export async function failJob(id, error, maxRetries = 3) {
  await db.query(
    `UPDATE job_queue
     SET
       status = CASE WHEN attempts >= $2 THEN 'failed' ELSE 'pending' END,
       attempts = attempts + 1,
       last_error = $3,
       run_at = CASE WHEN attempts < $2 THEN NOW() + INTERVAL '30 seconds' ELSE run_at END
     WHERE id = $1`,
    [id, maxRetries, String(error)]
  );
}

/**
 * Cleanup old done/failed jobs older than N days
 */
export async function cleanupOldJobs(days = 7) {
  const result = await db.query(
    `DELETE FROM job_queue
     WHERE status IN ('done', 'failed')
       AND created_at < NOW() - INTERVAL '${days} days'`
  );
  return result.rowCount;
}
