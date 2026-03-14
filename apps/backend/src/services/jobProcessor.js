/**
 * jobProcessor.js — In-process job queue worker
 * Business logic: semua kalkulasi keuangan dijalankan oleh COBOL
 */
import cron from 'node-cron';
import { db } from '../db/postgres.js';
import { claimJobs, completeJob, failJob, cleanupOldJobs, JOB_TYPES } from './jobQueue.js';
import cobol from './cobol-bridge.js';

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleSendNotification(payload) {
  const { user_id, title, message, type='system', metadata={} } = payload;
  await db.query(
    `INSERT INTO notifications (user_id,title,message,type,metadata) VALUES ($1,$2,$3,$4,$5)`,
    [user_id, title, message, type, JSON.stringify(metadata)]
  );
}

async function handleWriteAudit(payload) {
  const { user_id, action, resource, resource_id, details={}, ip } = payload;
  await db.query(
    `INSERT INTO audit_logs (user_id,action,resource,resource_id,details,ip_address)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [user_id, action, resource, resource_id, JSON.stringify(details), ip]
  );
}

async function handleProcessTransaction(payload) {
  const { user_id, amount, type, description } = payload;
  const label = type==='credit'?'masuk':'keluar';
  const fmt = new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(Math.abs(amount));
  await db.query(
    `INSERT INTO notifications (user_id,title,message,type,metadata)
     VALUES ($1,$2,$3,'transaction',$4)`,
    [user_id, `Transaksi ${label}: ${fmt}`,
     description||`Dana ${label} sebesar ${fmt} telah dicatat`,
     JSON.stringify(payload)]
  );
}

async function handleScheduledPayment(payload) {
  const { scheduled_id } = payload;
  const { rows } = await db.query(
    `SELECT st.*, ba.balance, ba.user_id FROM scheduled_transactions st
     JOIN bank_accounts ba ON st.account_id=ba.id
     WHERE st.id=$1 AND st.is_active=true`,
    [scheduled_id]
  );
  if (!rows.length) return;
  const s = rows[0];

  // COBOL: validasi + hitung saldo
  const cobolResult = await cobol.calcBalance({
    amount:   parseFloat(s.amount),
    balance:  parseFloat(s.balance),
    txn_type: s.transaction_type.toUpperCase(),
  });
  if (cobolResult.status==='ERROR') {
    console.warn(`[Cron] Scheduled payment ${scheduled_id} gagal: ${cobolResult.message}`);
    return;
  }

  const newBalance = parseFloat(cobolResult.balance);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE bank_accounts SET balance=$1, updated_at=NOW() WHERE id=$2', [newBalance, s.account_id]);
    await client.query(
      `INSERT INTO transactions (account_id,user_id,transaction_type,amount,balance_after,description,payee,category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [s.account_id, s.user_id, s.transaction_type, s.amount, newBalance,
       s.description||'Transaksi terjadwal', s.payee, s.category||'Jadwal']
    );

    // Hitung next_run_at berdasarkan frekuensi
    let nextRun = "NOW() + INTERVAL '1 month'";
    if (s.frequency==='daily')   nextRun = "NOW() + INTERVAL '1 day'";
    if (s.frequency==='weekly')  nextRun = "NOW() + INTERVAL '7 days'";
    if (s.frequency==='yearly')  nextRun = "NOW() + INTERVAL '1 year'";
    if (s.frequency==='once')    nextRun = null;

    if (nextRun) {
      await client.query(`UPDATE scheduled_transactions SET next_run_at=${nextRun}, last_run_at=NOW() WHERE id=$1`, [s.id]);
    } else {
      await client.query('UPDATE scheduled_transactions SET is_active=false, last_run_at=NOW() WHERE id=$1', [s.id]);
    }
    await client.query('COMMIT');
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally    { client.release(); }
}

// ── Job queue processor ────────────────────────────────────────────────────────

const JOB_HANDLERS = {
  [JOB_TYPES.SEND_NOTIFICATION]:  handleSendNotification,
  [JOB_TYPES.WRITE_AUDIT]:        handleWriteAudit,
  [JOB_TYPES.PROCESS_TRANSACTION]: handleProcessTransaction,
  [JOB_TYPES.SCHEDULED_PAYMENT]:  handleScheduledPayment,
};

async function processJobs() {
  const jobs = await claimJobs(5);
  for (const job of jobs) {
    const handler = JOB_HANDLERS[job.type];
    if (!handler) { await completeJob(job.id); continue; }
    try {
      await handler(job.payload);
      await completeJob(job.id);
    } catch(e) {
      console.error(`[Job] ${job.type} #${job.id} gagal:`, e.message);
      await failJob(job.id, e.message);
    }
  }
}

// ── Cron: scheduled transactions ──────────────────────────────────────────────

async function checkScheduledTransactions() {
  const { rows } = await db.query(
    `SELECT id FROM scheduled_transactions
     WHERE is_active=true AND next_run_at <= NOW()
     LIMIT 50`
  );
  for (const row of rows) {
    try { await handleScheduledPayment({ scheduled_id: row.id }); }
    catch(e) { console.error('[Cron] Scheduled payment error:', e.message); }
  }
}

// ── Cron: COBOL batch interest (tanggal 1 setiap bulan) ───────────────────────

async function processMonthlyInterest() {
  try {
    const { rows } = await db.query(
      `SELECT id AS account_id, balance, COALESCE(interest_rate, 0.005) AS interest_rate
       FROM bank_accounts
       WHERE is_active=true AND account_type='savings' AND balance > 0`
    );
    if (!rows.length) return;

    // ── COBOL CFBATCH: proses bunga semua rekening sekaligus ─────────────
    const accountsForCobol = rows.map(r => ({
      account_id:    r.account_id,
      balance:       parseFloat(r.balance),
      interest_rate: parseFloat(r.interest_rate),
      days:          30,
    }));

    const batchResult = await cobol.processBatchInterest(accountsForCobol);
    // ─────────────────────────────────────────────────────────────────────

    const results = batchResult.batch_results || [];
    let processed = 0;

    for (const item of results) {
      if (!item.account_id || parseFloat(item.interest||0) < 100) continue;

      const interest    = parseFloat(item.interest);
      const newBalance  = parseFloat(item.new_balance);
      const accountId   = item.account_id;

      const client = await db.connect();
      try {
        await client.query('BEGIN');
        // Ambil user_id untuk notifikasi
        const { rows:[acc] } = await client.query(
          'SELECT user_id FROM bank_accounts WHERE id=$1', [accountId]
        );
        if (!acc) { await client.query('ROLLBACK'); client.release(); continue; }

        await client.query(
          'UPDATE bank_accounts SET balance=$1, updated_at=NOW() WHERE id=$2',
          [newBalance, accountId]
        );
        await client.query(
          `INSERT INTO transactions (account_id,user_id,transaction_type,amount,balance_after,description,category)
           VALUES ($1,$2,'credit',$3,$4,'Bunga tabungan bulanan (COBOL)','interest')`,
          [accountId, acc.user_id, interest, newBalance]
        );
        await client.query('COMMIT');
        processed++;
      } catch(e) { await client.query('ROLLBACK'); }
      finally    { client.release(); }
    }

    if (processed) {
      console.log(`[Cron/COBOL] Bunga bulanan: ${processed} rekening diproses`);
    }
  } catch(e) {
    console.error('[Cron] Monthly interest (COBOL) error:', e.message);
  }
}

// ── Start ──────────────────────────────────────────────────────────────────────

export function startJobProcessor() {
  // Poll job queue setiap 5 detik
  cron.schedule('*/5 * * * * *', processJobs);

  // Cek jadwal transaksi setiap menit
  cron.schedule('* * * * *', checkScheduledTransactions);

  // Bunga bulanan: tanggal 1, jam 01:00 — COBOL CFBATCH
  cron.schedule('0 1 1 * *', processMonthlyInterest);

  // Cleanup job lama setiap hari jam 03:00
  cron.schedule('0 3 * * *', () => cleanupOldJobs(7).catch(console.error));

  console.log('[JobProcessor] Started (COBOL-powered interest engine)');
}
