# Hapus 3 baris terakhir (export default + financial-report block)
# lalu tambahkan versi yang benar
python3 << 'EOF'
with open('apps/backend/src/routes/reports.js', 'r') as f:
    content = f.read()

# Potong di export default router
cut = content.index('\nexport default router;')
content = content[:cut]

# Tambah import di baris ke-5
content = content.replace(
    "import { authenticate } from '../middleware/authenticate.js';",
    "import { authenticate } from '../middleware/authenticate.js';\nimport cobol from '../services/cobol-bridge.js';"
)

# Tambah route + export di akhir
content += """
// GET /reports/financial-report — laporan keuangan via COBOL CFREPORT
router.get('/financial-report', async (ctx) => {
  const userId = ctx.state.user.sub;
  const { rows: accounts } = await db.query(
    `SELECT ba.account_name, ba.balance,
       COALESCE(SUM(CASE WHEN t.transaction_type='debit'  THEN t.amount ELSE 0 END), 0) AS total_debit,
       COALESCE(SUM(CASE WHEN t.transaction_type='credit' THEN t.amount ELSE 0 END), 0) AS total_credit
     FROM bank_accounts ba
     LEFT JOIN transactions t ON t.account_id=ba.id
       AND t.transaction_date >= DATE_TRUNC('month', NOW())
     WHERE ba.user_id=$1 AND ba.is_active=true
     GROUP BY ba.id ORDER BY ba.is_primary DESC`,
    [userId]
  );
  if (accounts.length === 0) {
    ctx.body = { report: 'Belum ada rekening', raw: '' };
    return;
  }
  const reportText = await cobol.generateFinancialReport(accounts);
  ctx.set('Content-Type', 'text/plain; charset=utf-8');
  ctx.body = reportText;
});

export default router;
"""

with open('apps/backend/src/routes/reports.js', 'w') as f:
    f.write(content)

print("Done")
EOF
