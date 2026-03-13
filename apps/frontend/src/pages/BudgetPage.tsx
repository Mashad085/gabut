import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';

const formatIDR = (v: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const CATEGORIES = [
  {
    name: 'Pengeluaran Rutin',
    items: [
      { name: 'Makanan', budgeted: 2000000, spent: 1450000 },
      { name: 'Restoran', budgeted: 800000, spent: 620000 },
      { name: 'Hiburan', budgeted: 500000, spent: 0 },
      { name: 'Pakaian', budgeted: 300000, spent: 0 },
      { name: 'Umum', budgeted: 1000000, spent: 731380 },
      { name: 'Hadiah', budgeted: 200000, spent: 0 },
      { name: 'Kesehatan', budgeted: 500000, spent: 53850 },
      { name: 'Tabungan', budgeted: 2000000, spent: 6164110 },
    ],
  },
  {
    name: 'Tagihan',
    items: [
      { name: 'Sewa / KPR', budgeted: 3500000, spent: 3500000 },
      { name: 'Listrik & Air', budgeted: 400000, spent: 285000 },
      { name: 'Internet', budgeted: 350000, spent: 350000 },
      { name: 'Telepon', budgeted: 150000, spent: 150000 },
    ],
  },
  {
    name: 'Transportasi',
    items: [
      { name: 'Bensin', budgeted: 500000, spent: 320000 },
      { name: 'Parkir', budgeted: 100000, spent: 45000 },
      { name: 'Ojek/Taksi', budgeted: 300000, spent: 180000 },
    ],
  },
];

function ProgressBar({ budgeted, spent }: { budgeted: number; spent: number }) {
  if (budgeted === 0) return null;
  const pct = Math.min((spent / budgeted) * 100, 100);
  const over = spent > budgeted;
  return (
    <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function BudgetPage() {
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const prev = () => setCurrentDate(d => subMonths(d, 1));
  const next = () => setCurrentDate(d => addMonths(d, 1));

  const nextMonth = addMonths(currentDate, 1);

  const availableFunds = 3261460;
  const budgeted = 0;
  const forNextMonth = 0;

  const months = [currentDate, nextMonth];

  return (
    <div className="h-full flex flex-col">
      {/* Month nav */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.05]">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronLeft size={16} />
        </button>
        {months.map((m, i) => (
          <button
            key={i}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              i === 0 ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {format(m, 'MMM', { locale: id })}
          </button>
        ))}
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Month headers */}
        <div className="grid grid-cols-[1fr_1fr_1fr] lg:grid-cols-[2fr_1fr_1fr] border-b border-white/[0.05]">
          <div className="hidden lg:block" />
          {months.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-5 border-l border-white/[0.05] ${i === 0 ? 'bg-white/[0.02]' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-slate-100">
                  {format(m, 'MMMM', { locale: id })}
                </h2>
                <button className="text-slate-500 hover:text-slate-300">
                  <MoreHorizontal size={16} />
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Dana Tersedia</span>
                  <span className="font-mono text-slate-200">{formatIDR(availableFunds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lebih dari {format(subMonths(m, 1), 'MMM', { locale: id })}</span>
                  <span className="font-mono text-slate-500">-{formatIDR(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dianggarkan</span>
                  <span className="font-mono text-slate-500">-{formatIDR(budgeted)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Untuk Bulan Depan</span>
                  <span className="font-mono text-slate-500">-{formatIDR(forNextMonth)}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06]">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-400">Untuk Dianggarkan:</span>
                </div>
                <p className="font-display text-2xl font-bold text-brand-400 mt-0.5">
                  {formatIDR(availableFunds)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Category table */}
        <div>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_repeat(6,minmax(80px,1fr))] border-b border-white/[0.05] px-5 py-2">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Kategori</div>
            {months.map((m, mi) => (
              <>
                <div key={`b${mi}`} className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Dianggarkan</div>
                <div key={`s${mi}`} className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Digunakan</div>
                <div key={`bal${mi}`} className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Saldo</div>
              </>
            ))}
          </div>

          {CATEGORIES.map((group, gi) => (
            <div key={gi}>
              {/* Group header */}
              <div className="grid grid-cols-[1fr_repeat(6,minmax(80px,1fr))] px-5 py-2 bg-white/[0.02] border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <button className="text-slate-500 hover:text-slate-300">
                    <ChevronRight size={14} />
                  </button>
                  <span className="text-sm font-semibold text-slate-300">{group.name}</span>
                  <button className="text-slate-600 hover:text-slate-400 ml-1">
                    <Plus size={12} />
                  </button>
                </div>
                {months.map((_, mi) => {
                  const totB = group.items.reduce((s, i) => s + i.budgeted, 0);
                  const totS = group.items.reduce((s, i) => s + i.spent, 0);
                  return (
                    <>
                      <div key={`gb${mi}`} className="text-right font-mono text-xs text-slate-400">{formatIDR(totB)}</div>
                      <div key={`gs${mi}`} className="text-right font-mono text-xs text-slate-400">{formatIDR(totS)}</div>
                      <div key={`gbal${mi}`} className={`text-right font-mono text-xs ${totS > totB ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatIDR(Math.abs(totB - totS))}
                      </div>
                    </>
                  );
                })}
              </div>

              {/* Items */}
              {group.items.map((item, ii) => (
                <motion.div
                  key={ii}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: ii * 0.03 }}
                  className="grid grid-cols-[1fr_repeat(6,minmax(80px,1fr))] px-5 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex items-center gap-3 pl-6">
                    <div className="flex-1">
                      <span className="text-sm text-slate-300">{item.name}</span>
                      {item.budgeted > 0 && (
                        <ProgressBar budgeted={item.budgeted} spent={item.spent} />
                      )}
                    </div>
                  </div>
                  {months.map((_, mi) => {
                    const balance = item.budgeted - item.spent;
                    return (
                      <>
                        <div key={`ib${mi}`} className="text-right font-mono text-xs text-slate-400 self-center">
                          {item.budgeted === 0 ? <span className="text-slate-700">0.00</span> : formatIDR(item.budgeted)}
                        </div>
                        <div key={`is${mi}`} className="text-right font-mono text-xs text-slate-400 self-center">
                          {item.spent === 0 ? <span className="text-slate-700">0.00</span> : formatIDR(item.spent)}
                        </div>
                        <div key={`ibal${mi}`} className={`text-right font-mono text-xs self-center ${balance < 0 ? 'text-rose-400' : balance === 0 ? 'text-slate-500' : 'text-emerald-400'}`}>
                          {formatIDR(balance)}
                        </div>
                      </>
                    );
                  })}
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
