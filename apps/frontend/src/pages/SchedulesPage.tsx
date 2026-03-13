import { motion } from 'framer-motion';
import { Calendar, Clock, Repeat, Plus } from 'lucide-react';

const formatIDR = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const SCHEDULES = [
  { name: 'Tagihan Listrik PLN', amount: 280000, frequency: 'Bulanan', next: '1 Apr 2025', category: 'Utilitas', color: '#f59e0b' },
  { name: 'Iuran Arisan RT 05', amount: 150000, frequency: 'Bulanan', next: '5 Apr 2025', category: 'Komunitas', color: '#6366f1' },
  { name: 'Internet Indihome', amount: 350000, frequency: 'Bulanan', next: '10 Apr 2025', category: 'Tagihan', color: '#10b981' },
  { name: 'Premi Asuransi Jiwa', amount: 500000, frequency: 'Bulanan', next: '15 Apr 2025', category: 'Asuransi', color: '#f43f5e' },
  { name: 'Cicilan KPR', amount: 3500000, frequency: 'Bulanan', next: '20 Apr 2025', category: 'Rumah', color: '#8b5cf6' },
  { name: 'Tabungan Pendidikan', amount: 1000000, frequency: 'Bulanan', next: '25 Apr 2025', category: 'Tabungan', color: '#06b6d4' },
];

export default function SchedulesPage() {
  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-slate-100">Jadwal Transaksi</h1>
        <button className="btn-primary"><Plus size={15} /> Jadwal Baru</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Jadwal Aktif', value: SCHEDULES.length, icon: Repeat },
          { label: 'Total Bulanan', value: formatIDR(SCHEDULES.reduce((s,x) => s + x.amount, 0)), icon: Calendar },
          { label: 'Jatuh Tempo Berikutnya', value: '1 Apr 2025', icon: Clock },
        ].map((s, i) => (
          <div key={i} className="card">
            <s.icon size={18} className="text-brand-400 mb-3" />
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className="text-slate-100 font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {SCHEDULES.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="card hover:bg-white/[0.07] transition-all flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.color}20`, color: s.color }}>
              <Repeat size={16} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-200 text-sm">{s.name}</p>
              <p className="text-xs text-slate-500">{s.frequency} · {s.category}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-rose-400">-{formatIDR(s.amount)}</p>
              <p className="text-xs text-slate-500">{s.next}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
