import dotenv from 'dotenv';
dotenv.config();

import amqplib from 'amqplib';
import pg from 'pg';
import Redis from 'ioredis';
import cron from 'node-cron';

const { Pool } = pg;

// ── Connections ───────────────────────────────────────────────────────────────
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

let connection = null;
let channel = null;

const QUEUES = {
  NOTIFICATIONS: 'notifications',
  TRANSACTIONS: 'transactions.process',
  EMAILS: 'emails.send',
  SCHEDULED: 'scheduled.jobs',
  AUDIT: 'audit.logs',
};

// ── Logger ────────────────────────────────────────────────────────────────────
const log = {
  info: (msg, data = {}) => console.log(JSON.stringify({ level: 'info', msg, ...data, ts: new Date().toISOString() })),
  error: (msg, data = {}) => console.error(JSON.stringify({ level: 'error', msg, ...data, ts: new Date().toISOString() })),
  warn: (msg, data = {}) => console.warn(JSON.stringify({ level: 'warn', msg, ...data, ts: new Date().toISOString() })),
};

// ── Message Handlers ──────────────────────────────────────────────────────────
async function handleNotification(msg) {
  log.info('Processing notification', { type: msg.type });

  switch (msg.type) {
    case 'community.member_joined': {
      // Notify community admins
      const admins = await db.query(
        `SELECT cm.user_id FROM community_members cm WHERE cm.community_id = $1 AND cm.role = 'admin'`,
        [msg.communityId]
      );
      const joiner = await db.query('SELECT full_name FROM users WHERE id = $1', [msg.userId]);

      for (const admin of admins.rows) {
        await db.query(
          `INSERT INTO notifications (user_id, title, message, type, metadata)
           VALUES ($1, $2, $3, 'community', $4)`,
          [
            admin.user_id,
            'Anggota Baru Bergabung',
            `${joiner.rows[0]?.full_name || 'Seseorang'} telah bergabung ke komunitas Anda`,
            JSON.stringify({ communityId: msg.communityId, userId: msg.userId }),
          ]
        );
      }
      break;
    }

    case 'transaction.created': {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, metadata)
         VALUES ($1, $2, $3, 'transaction', $4)`,
        [
          msg.userId,
          'Transaksi Berhasil',
          `Transaksi sebesar Rp ${parseInt(msg.transaction?.amount || 0).toLocaleString('id-ID')} telah diproses`,
          JSON.stringify({ transactionId: msg.transaction?.id }),
        ]
      );
      break;
    }

    default:
      log.warn('Unknown notification type', { type: msg.type });
  }
}

async function handleEmail(msg) {
  log.info('Processing email', { type: msg.type, email: msg.email });

  // In production: integrate with SMTP / SendGrid / SES
  switch (msg.type) {
    case 'welcome':
      log.info('Would send welcome email', { to: msg.email, name: msg.name });
      break;
    case 'transaction_confirm':
      log.info('Would send transaction confirmation', { to: msg.email });
      break;
    case 'security_alert':
      log.info('Would send security alert', { to: msg.email });
      break;
  }
}

async function handleAuditLog(msg) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [msg.userId, msg.action, msg.resourceType, msg.resourceId, msg.ipAddress, JSON.stringify(msg.metadata || {})]
    );
  } catch (err) {
    log.error('Failed to write audit log', { error: err.message });
  }
}

async function handleScheduledJob(msg) {
  log.info('Processing scheduled job', { jobType: msg.jobType });

  switch (msg.jobType) {
    case 'process_scheduled_transactions':
      await processScheduledTransactions();
      break;
    case 'calculate_interest':
      await calculateInterest();
      break;
  }
}

// ── Scheduled Tasks ───────────────────────────────────────────────────────────
async function processScheduledTransactions() {
  const due = await db.query(
    `SELECT * FROM scheduled_transactions
     WHERE next_run_at <= NOW() AND is_active = true AND (end_date IS NULL OR end_date > NOW())`,
  );

  log.info(`Processing ${due.rows.length} scheduled transactions`);

  for (const sched of due.rows) {
    try {
      const account = await db.query(
        'SELECT * FROM bank_accounts WHERE id = $1 AND is_active = true FOR UPDATE',
        [sched.account_id]
      );

      if (!account.rows[0]) continue;

      const acc = account.rows[0];
      let newBalance = parseFloat(acc.balance);

      if (sched.transaction_type === 'debit') {
        if (newBalance < sched.amount) {
          // Send insufficient funds notification
          await db.query(
            `INSERT INTO notifications (user_id, title, message, type)
             VALUES ($1, 'Saldo Tidak Cukup', $2, 'system')`,
            [acc.user_id, `Transaksi terjadwal "${sched.description}" gagal karena saldo tidak cukup`]
          );
          continue;
        }
        newBalance -= parseFloat(sched.amount);
      } else {
        newBalance += parseFloat(sched.amount);
      }

      // Execute transaction
      await db.query('UPDATE bank_accounts SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, acc.id]);

      const ref = `SCH${Date.now()}`;
      await db.query(
        `INSERT INTO transactions (account_id, transaction_type, amount, balance_after, description, payee, category, reference_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [sched.account_id, sched.transaction_type, sched.amount, newBalance, sched.description, sched.payee, sched.category, ref]
      );

      // Calculate next run
      let nextRun = new Date(sched.next_run_at);
      switch (sched.frequency) {
        case 'daily': nextRun.setDate(nextRun.getDate() + 1); break;
        case 'weekly': nextRun.setDate(nextRun.getDate() + 7); break;
        case 'monthly': nextRun.setMonth(nextRun.getMonth() + 1); break;
        case 'yearly': nextRun.setFullYear(nextRun.getFullYear() + 1); break;
        case 'once':
          await db.query('UPDATE scheduled_transactions SET is_active = false WHERE id = $1', [sched.id]);
          continue;
      }

      await db.query('UPDATE scheduled_transactions SET next_run_at = $1 WHERE id = $2', [nextRun, sched.id]);

      log.info('Scheduled transaction executed', { schedId: sched.id, amount: sched.amount });
    } catch (err) {
      log.error('Failed to process scheduled transaction', { schedId: sched.id, error: err.message });
    }
  }
}

async function calculateInterest() {
  const accounts = await db.query(
    "SELECT * FROM bank_accounts WHERE account_type IN ('savings', 'investment') AND interest_rate > 0 AND is_active = true"
  );

  for (const acc of accounts.rows) {
    const monthlyRate = parseFloat(acc.interest_rate) / 12;
    const interest = parseFloat(acc.balance) * monthlyRate;

    if (interest <= 0) continue;

    const newBalance = parseFloat(acc.balance) + interest;
    await db.query('UPDATE bank_accounts SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, acc.id]);
    await db.query(
      `INSERT INTO transactions (account_id, transaction_type, amount, balance_after, description, category)
       VALUES ($1, 'credit', $2, $3, 'Bunga Tabungan', 'Interest')`,
      [acc.id, interest, newBalance]
    );

    log.info('Interest calculated', { accountId: acc.id, interest });
  }
}

// ── RabbitMQ Consumer ─────────────────────────────────────────────────────────
async function startConsuming() {
  try {
    connection = await amqplib.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.prefetch(5);

    const handlers = {
      [QUEUES.NOTIFICATIONS]: handleNotification,
      [QUEUES.EMAILS]: handleEmail,
      [QUEUES.AUDIT]: handleAuditLog,
      [QUEUES.SCHEDULED]: handleScheduledJob,
    };

    for (const [queue, handler] of Object.entries(handlers)) {
      await channel.assertQueue(queue, { durable: true });
      await channel.consume(queue, async (msg) => {
        if (!msg) return;
        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          channel.ack(msg);
        } catch (err) {
          log.error(`Error in queue ${queue}`, { error: err.message });
          channel.nack(msg, false, !msg.fields.redelivered);
        }
      });

      log.info(`Consuming queue: ${queue}`);
    }

    connection.on('error', (err) => {
      log.error('RabbitMQ connection error', { error: err.message });
      setTimeout(startConsuming, 5000);
    });

    log.info('Worker started successfully');
  } catch (err) {
    log.error('Failed to connect to RabbitMQ', { error: err.message });
    setTimeout(startConsuming, 5000);
  }
}

// ── Cron Jobs ─────────────────────────────────────────────────────────────────
// Every 5 minutes: process scheduled transactions
cron.schedule('*/5 * * * *', async () => {
  log.info('Running scheduled transaction processor');
  await processScheduledTransactions();
});

// Every 1st of month at midnight: calculate interest
cron.schedule('0 0 1 * *', async () => {
  log.info('Running monthly interest calculation');
  await calculateInterest();
});

// Daily at 9am: send daily digest
cron.schedule('0 9 * * *', async () => {
  log.info('Running daily digest');
  // Could send email digests to users
});

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await db.query('SELECT 1');
  log.info('PostgreSQL connected');

  await redis.ping();
  log.info('Redis connected');

  await startConsuming();
};

start().catch((err) => {
  log.error('Worker startup failed', { error: err.message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  log.info('Shutting down worker...');
  if (channel) await channel.close();
  if (connection) await connection.close();
  await db.end();
  await redis.quit();
  process.exit(0);
});
