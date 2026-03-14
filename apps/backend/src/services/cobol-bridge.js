/**
 * cobol-bridge.js — Jembatan antara Node.js dan COBOL business logic
 *
 * Semua business logic keuangan dieksekusi oleh COBOL binary.
 * Node.js hanya menangani HTTP, database I/O, dan auth.
 *
 * Arsitektur:
 *   HTTP Request → Node.js (Koa) → COBOL binary (child_process)
 *                                         ↓
 *   Database ←→ Node.js ←── JSON result ──┘
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';
import os from 'os';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Path ke COBOL binaries (relatif dari src/services/)
const COBOL_BIN_DIR = join(__dirname, '../../../cobol/bin');

/**
 * Jalankan COBOL program dengan args key=value
 * Timeout default: 10 detik
 */
async function runCobol(program, args = [], timeoutMs = 10000) {
  const binPath = join(COBOL_BIN_DIR, program);
  const argStrings = args.map(([k, v]) => `${k}=${v}`);

  try {
    const { stdout, stderr } = await execFileAsync(binPath, argStrings, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024, // 1MB
      env: { ...process.env, COB_DISABLE_WARNINGS: '1' },
    });

    const output = stdout.trim();
    if (!output) {
      throw new Error(`COBOL ${program} returned empty output`);
    }

    // Parse JSON output dari COBOL
    const result = JSON.parse(output);
    return result;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`COBOL binary tidak ditemukan: ${binPath}. Jalankan 'make' di folder cobol/`);
    }
    if (err.code === 'ETIMEDOUT') {
      throw new Error(`COBOL ${program} timeout setelah ${timeoutMs}ms`);
    }
    // JSON parse error — kembalikan raw output sebagai error
    if (err instanceof SyntaxError) {
      throw new Error(`COBOL ${program} output bukan JSON valid: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Jalankan COBOL program yang butuh input file (CFBATCH, CFREPORT)
 */
async function runCobolWithFile(program, lines, timeoutMs = 30000) {
  const tmpFile = join(os.tmpdir(), `cf_${randomBytes(8).toString('hex')}.tmp`);
  try {
    await writeFile(tmpFile, lines.join('\n') + '\n', 'utf8');
    const binPath = join(COBOL_BIN_DIR, program);
    const { stdout } = await execFileAsync(binPath, [tmpFile], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, COB_DISABLE_WARNINGS: '1' },
    });
    return stdout.trim();
  } finally {
    unlink(tmpFile).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// CFTRXVAL — Validasi & kalkulasi transaksi
// ═══════════════════════════════════════════════════════════════

/**
 * Validasi transaksi sebelum disimpan ke DB
 * @returns {status, balance, message}
 */
export async function validateTransaction({ amount, balance, txn_type }) {
  return runCobol('cftrxval', [
    ['action', 'VALIDATE'],
    ['amount', amount.toFixed(2)],
    ['balance', balance.toFixed(2)],
    ['txn_type', txn_type.toUpperCase()],
  ]);
}

/**
 * Hitung saldo baru setelah transaksi
 * @returns {status, balance (saldo baru), message}
 */
export async function calcBalance({ amount, balance, txn_type }) {
  return runCobol('cftrxval', [
    ['action', 'CALC-BALANCE'],
    ['amount', amount.toFixed(2)],
    ['balance', balance.toFixed(2)],
    ['txn_type', txn_type.toUpperCase()],
  ]);
}

/**
 * Hitung bunga tabungan
 * @param {number} balance - saldo rekening
 * @param {number} interest_rate - bunga tahunan (e.g. 0.025 = 2.5%)
 * @param {number} days - jumlah hari
 * @returns {status, balance (saldo+bunga), interest, message}
 */
export async function calcInterest({ balance, interest_rate, days }) {
  return runCobol('cftrxval', [
    ['action', 'CALC-INTEREST'],
    ['balance', balance.toFixed(2)],
    ['interest_rate', interest_rate.toFixed(6)],
    ['days', String(days)],
  ]);
}

// ═══════════════════════════════════════════════════════════════
// CFWALLET — Logika dompet KOIN
// ═══════════════════════════════════════════════════════════════

/**
 * Validasi transfer KOIN sebelum eksekusi
 */
export async function validateKoinTransfer({ from_balance, amount }) {
  return runCobol('cfwallet', [
    ['action', 'VALIDATE-TRANSFER'],
    ['from_balance', from_balance.toFixed(2)],
    ['to_balance', '0.00'],
    ['amount', amount.toFixed(2)],
  ]);
}

/**
 * Hitung saldo KOIN baru setelah transfer (kedua pihak)
 * @returns {status, from_balance (baru), to_balance (baru), message}
 */
export async function calcKoinTransfer({ from_balance, to_balance, amount }) {
  return runCobol('cfwallet', [
    ['action', 'CALC-TRANSFER'],
    ['from_balance', from_balance.toFixed(2)],
    ['to_balance', to_balance.toFixed(2)],
    ['amount', amount.toFixed(2)],
  ]);
}

/**
 * Hitung saldo KOIN setelah top-up
 */
export async function calcKoinTopup({ to_balance, amount }) {
  return runCobol('cfwallet', [
    ['action', 'TOPUP'],
    ['from_balance', '0.00'],
    ['to_balance', to_balance.toFixed(2)],
    ['amount', amount.toFixed(2)],
  ]);
}

// ═══════════════════════════════════════════════════════════════
// CFBUDGET — Logika anggaran
// ═══════════════════════════════════════════════════════════════

/**
 * Validasi pengeluaran terhadap anggaran kategori
 */
export async function validateBudgetSpend({ budgeted, spent, amount }) {
  return runCobol('cfbudget', [
    ['action', 'VALIDATE-SPEND'],
    ['budgeted', budgeted.toFixed(2)],
    ['spent', spent.toFixed(2)],
    ['amount', amount.toFixed(2)],
  ]);
}

/**
 * Hitung sisa anggaran kategori
 */
export async function calcBudgetRemaining({ budgeted, spent, amount = 0 }) {
  return runCobol('cfbudget', [
    ['action', 'CALC-REMAINING'],
    ['budgeted', budgeted.toFixed(2)],
    ['spent', spent.toFixed(2)],
    ['amount', amount.toFixed(2)],
  ]);
}

/**
 * Analisis kesehatan anggaran bulanan
 * @returns {status, health (GOOD/FAIR/WARNING/DANGER), remaining, pct_used, message}
 */
export async function analyzeBudgetHealth({ total_income, total_budgeted }) {
  return runCobol('cfbudget', [
    ['action', 'ANALYZE'],
    ['total_income', total_income.toFixed(2)],
    ['total_budgeted', total_budgeted.toFixed(2)],
  ]);
}

// ═══════════════════════════════════════════════════════════════
// CFBATCH — Batch interest processor
// ═══════════════════════════════════════════════════════════════

/**
 * Proses bunga tabungan untuk banyak rekening sekaligus (batch)
 * @param {Array} accounts - [{account_id, balance, rate, days}]
 * @returns parsed JSON batch results
 */
export async function processBatchInterest(accounts) {
  const lines = accounts.map(a =>
    `action=INTEREST account_id=${a.account_id} ` +
    `balance=${parseFloat(a.balance).toFixed(2)} ` +
    `rate=${parseFloat(a.interest_rate || 0.005).toFixed(6)} ` +
    `days=${a.days || 30}`
  );

  const raw = await runCobolWithFile('cfbatch', lines, 60000);

  // COBOL batch output mungkin multi-line — ambil baris yang berisi JSON
  // Format: {"batch_results":[...]}
  try {
    // Cari baris JSON utama
    const jsonLines = raw.split('\n').filter(l => l.trim().startsWith('{') || l.trim().startsWith('['));
    if (jsonLines.length === 0) return { batch_results: [], summary: {} };

    // Gabung semua baris output menjadi satu JSON (COBOL output bisa multi-line)
    const combined = raw.replace(/\n/g, '').replace(/,\s*\]/g, ']');
    // Coba parse langsung dulu
    return JSON.parse(combined);
  } catch {
    // Jika gagal parse, kembalikan raw sebagai string
    return { raw_output: raw };
  }
}

// ═══════════════════════════════════════════════════════════════
// CFREPORT — Text report generator
// ═══════════════════════════════════════════════════════════════

/**
 * Generate laporan keuangan terformat dari data rekening
 * @param {Array} accounts - [{account_name, balance, total_debit, total_credit}]
 * @returns {string} formatted report text
 */
export async function generateFinancialReport(accounts) {
  const lines = accounts.map(a => {
    const name = (a.account_name || 'Rekening').padEnd(24).substring(0, 24);
    const bal  = parseFloat(a.balance || 0).toFixed(2);
    const deb  = parseFloat(a.total_debit || 0).toFixed(2);
    const cre  = parseFloat(a.total_credit || 0).toFixed(2);
    return `R|${name}|${bal}|${deb}|${cre}`;
  });

  return runCobolWithFile('cfreport', lines, 15000);
}

// ═══════════════════════════════════════════════════════════════
// Health check — verifikasi semua COBOL binaries tersedia
// ═══════════════════════════════════════════════════════════════

export async function cobolHealthCheck() {
  const programs = ['cftrxval', 'cfwallet', 'cfbudget', 'cfbatch', 'cfreport'];
  const results = {};

  for (const prog of programs) {
    try {
      const result = await runCobol(prog, [
        ['action', 'VALIDATE'],
        ['amount', '1.00'],
        ['balance', '1000.00'],
        ['txn_type', 'CREDIT'],
      ], 3000);
      results[prog] = result.status ? 'ok' : 'error';
    } catch {
      results[prog] = 'missing';
    }
  }

  return results;
}

export default {
  validateTransaction,
  calcBalance,
  calcInterest,
  validateKoinTransfer,
  calcKoinTransfer,
  calcKoinTopup,
  validateBudgetSpend,
  calcBudgetRemaining,
  analyzeBudgetHealth,
  processBatchInterest,
  generateFinancialReport,
  cobolHealthCheck,
};
