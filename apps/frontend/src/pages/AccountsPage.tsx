// AccountsPage
import { motion } from 'framer-motion';
import { CreditCard, Plus, TrendingUp, ArrowUpRight } from 'lucide-react';

const formatIDR = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const ACCOUNTS = [
  { name: 'Tabungan Utama', type: 'savings', number: 'CF***4521', balance: 25000000, bank: 'BCA', color: '#6366f1' },
  { name: 'Rekening Harian', type: 'checking', number: 'CF***8873', balance: 3500000, bank: 'Mandiri', color: '#10b981' },
  { name: 'Investasi Saham', type: 'investment', number: 'CF***2210', balance: 15000000, bank: 'BNI Sekuritas', color: '#f59e0b' },
  { name: 'Dana Darurat', type: 'savings', number: 'CF***7755', balance: 8000000, bank: 'BRI', color: '#f43f5e' },
  { name: 'Tabungan Anak', type: 'savings', number: 'CF***3391', balance: 5500000, bank: 'BTN', color: '#8b5cf6' },
];

export default function AccountsPage() {
  const total = ACCOUNTS.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-slate-100">Rekening</h1>
        <button className="btn-primary"><Plus size={15} /> Tambah Rekening</button>
      </div>

      <div className="card bg-gradient-to-br from-brand-900/50 to-brand-950/50 border-brand-800/30">
        <p className="text-slate-400 text-xs mb-1">Total Saldo Semua Rekening</p>
        <p className="font-display text-4xl font-bold text-brand-300">{formatIDR(total)}</p>
        <div className="flex gap-4 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><ArrowUpRight size={12} className="text-emerald-400" /> +2.4% bulan ini</span>
          <span>{ACCOUNTS.length} rekening aktif</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACCOUNTS.map((acc, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="card-hover p-5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5"
              style={{ background: acc.color, transform: 'translate(30%, -30%)' }} />
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${acc.color}20`, color: acc.color }}>
                <CreditCard size={18} />
              </div>
              <span className="badge badge-green text-[10px]">{acc.type}</span>
            </div>
            <p className="font-semibold text-slate-200 mb-0.5">{acc.name}</p>
            <p className="text-xs text-slate-500 mb-3">{acc.bank} · {acc.number}</p>
            <p className="font-mono text-lg font-semibold" style={{ color: acc.color }}>{formatIDR(acc.balance)}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
