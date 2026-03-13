import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, DollarSign, Home, BarChart3, Plus, Edit3 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { reportsAPI } from '@/lib/api';

const formatIDR = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-white/[0.12] text-xs shadow-2xl">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-mono text-slate-100 font-medium">{formatIDR(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// Stat widget (top row)
function StatWidget({ label, period, value, change, positive }: any) {
  return (
    <div className="card hover:bg-white/[0.06] transition-colors cursor-pointer">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-[10px] text-slate-600 mb-3">{period}</p>
      <p className={`font-display text-3xl font-bold ${positive ? 'text-brand-400' : value < 0 ? 'text-rose-400' : 'text-brand-400'}`}>
        {typeof value === 'number' ? formatIDR(value).replace('Rp\u00a0', '') : value}
      </p>
      {change && (
        <p className={`text-xs mt-1 font-mono ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {change}
        </p>
      )}
    </div>
  );
}

// Chart card
function ChartCard({ title, subtitle, children }: any) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-200 text-sm">{title}</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ReportsPage() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: reportsAPI.dashboard });
  const { data: costData } = useQuery({ queryKey: ['cost-of-living'], queryFn: reportsAPI.costOfLiving });

  const cashflow = (data?.monthly_cashflow || MOCK_CASHFLOW).slice(-8).map((d: any) => ({
    month: d.month ? format(parseISO(d.month), 'MMM yy', { locale: id }) : d.month,
    pendapatan: parseFloat(d.income || d.pendapatan || 0),
    pengeluaran: parseFloat(d.expenses || d.pengeluaran || 0),
  }));

  const netWorth = (data?.net_worth_trend || MOCK_NETWORTH).map((d: any, i: number) => ({
    month: d.month ? format(parseISO(d.month), 'MMM', { locale: id }) : d.month,
    nilai: MOCK_NETWORTH_ACC[i]?.nilai || parseFloat(d.net_change || 0),
  }));

  const costByMonth = MOCK_COST_MONTHLY;
  const investYearly = MOCK_INVEST_YEARLY;

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-slate-100">Laporan</h1>
        <div className="flex gap-2">
          <button className="btn-secondary"><Edit3 size={14} /> Edit Dashboard</button>
          <button className="btn-primary"><Plus size={14} /> Widget Baru</button>
        </div>
      </div>

      {/* Top stat widgets */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatWidget
          label="Rata-rata Investasi Bulanan"
          period="Mar 2015 – Mei 2025"
          value={105060000}
          positive
        />
        <StatWidget
          label="Rata-rata Premium Bond (sepanjang waktu)"
          period="Mar 2015 – Mei 2025"
          value={92860000}
          positive
        />
        <StatWidget
          label="Performa Investasi (sepanjang waktu)"
          period="Mar 2015 – Mei 2025"
          value={12857890000}
          positive
        />
        <StatWidget
          label="Bunga Bank (tahun pajak ini)"
          period="Apr 2024 – Apr 2025"
          value={345550000}
          positive
        />
      </motion.div>

      {/* Main chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Investment yearly excl pension */}
        <div className="lg:col-span-1">
          <ChartCard title="Performa Investasi – Tahunan (excl. pensiun)" subtitle="Sepanjang waktu">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={investYearly} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(0)}M`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="saham" name="Saham" stackId="a" fill="#6366f1" radius={[0,0,0,0]} />
                  <Bar dataKey="obligasi" name="Obligasi" stackId="a" fill="#10b981" radius={[0,0,0,0]} />
                  <Bar dataKey="reksa" name="Reksa Dana" stackId="a" fill="#f59e0b" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Investment yearly inc pension */}
        <div className="lg:col-span-1">
          <ChartCard title="Performa Investasi – Tahunan (inc. pensiun)" subtitle="Sepanjang waktu">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={investYearly} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(0)}M`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="saham" name="Saham" stackId="a" fill="#6366f1" />
                  <Bar dataKey="obligasi" name="Obligasi" stackId="a" fill="#10b981" />
                  <Bar dataKey="reksa" name="Reksa Dana" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="pensiun" name="Pensiun" stackId="a" fill="#f43f5e" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Net Worth */}
        <div className="lg:col-span-1">
          <ChartCard title="Kekayaan Bersih" subtitle="Mar 2015 – Mei 2025">
            <div className="flex items-end justify-between mb-2">
              <span className="font-display text-2xl font-bold text-brand-400">
                {formatIDR(data?.summary?.total_balance || 103552390)}
              </span>
              <span className="badge badge-green text-xs">+113.004,07</span>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorth}>
                  <defs>
                    <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" hide />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="nilai" name="Kekayaan Bersih" stroke="#6366f1" strokeWidth={2} fill="url(#nwGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cost of Living yearly */}
        <div className="lg:col-span-1">
          <ChartCard title="Biaya Hidup" subtitle="Sepanjang waktu">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_COST_YEARLY} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(0)}M`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="makanan" name="Makanan" stackId="a" fill="#10b981" />
                  <Bar dataKey="transportasi" name="Transport" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="hiburan" name="Hiburan" stackId="a" fill="#6366f1" />
                  <Bar dataKey="lainnya" name="Lainnya" stackId="a" fill="#f43f5e" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Cost of Living by Month */}
        <div className="lg:col-span-1">
          <ChartCard title="Biaya Hidup per Bulan" subtitle="12 bulan terakhir">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costByMonth} barGap={1}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="makanan" name="Makanan" stackId="a" fill="#10b981" />
                  <Bar dataKey="transportasi" name="Transport" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="hiburan" name="Hiburan" stackId="a" fill="#6366f1" />
                  <Bar dataKey="belanja" name="Belanja" stackId="a" fill="#06b6d4" />
                  <Bar dataKey="lainnya" name="Lainnya" stackId="a" fill="#f43f5e" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Right column — investment trend + avg cost */}
        <div className="space-y-4">
          <ChartCard title="Tren Performa Investasi (semua waktu)" subtitle="Okt 2018 – Mei 2025">
            <div className="flex items-end justify-between mb-2">
              <span className="font-display text-xl font-bold text-emerald-400">{formatIDR(12857890)}</span>
              <span className="badge badge-green text-[10px]">+12.786,58</span>
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_INVEST_TREND}>
                  <defs>
                    <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" hide />
                  <YAxis hide />
                  <Area type="monotone" dataKey="nilai" stroke="#10b981" strokeWidth={2} fill="url(#investGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="card">
            <p className="text-xs text-slate-400 mb-0.5">Rata-rata Biaya Hidup Bulanan</p>
            <p className="text-[10px] text-slate-600 mb-3">Jun 2024 – Mei 2025</p>
            <p className="font-display text-4xl font-bold text-rose-400">
              1.104,52
            </p>
          </div>
        </div>
      </div>

      {/* Cash Flow Full Width */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="section-title text-base">Arus Kas Bulanan</h3>
            <p className="text-slate-500 text-xs mt-0.5">Pendapatan vs Pengeluaran — 12 bulan terakhir</p>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashflow.length ? cashflow : MOCK_CASHFLOW} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="pendapatan" name="Pendapatan" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#f43f5e" radius={[3,3,0,0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const MOCK_CASHFLOW = [
  { month: 'Agu', pendapatan: 8500000, pengeluaran: 5200000 },
  { month: 'Sep', pendapatan: 9200000, pengeluaran: 6100000 },
  { month: 'Okt', pendapatan: 8800000, pengeluaran: 4900000 },
  { month: 'Nov', pendapatan: 10500000, pengeluaran: 7200000 },
  { month: 'Des', pendapatan: 11000000, pengeluaran: 8500000 },
  { month: 'Jan', pendapatan: 9500000, pengeluaran: 5800000 },
  { month: 'Feb', pendapatan: 10200000, pengeluaran: 6400000 },
  { month: 'Mar', pendapatan: 11500000, pengeluaran: 7100000 },
];

const MOCK_NETWORTH = Array.from({ length: 12 }, (_, i) => ({ month: `M${i + 1}`, net_change: 0 }));
const MOCK_NETWORTH_ACC = [
  { month: 'Jan', nilai: 45000000 }, { month: 'Feb', nilai: 52000000 },
  { month: 'Mar', nilai: 58000000 }, { month: 'Apr', nilai: 65000000 },
  { month: 'Mei', nilai: 71000000 }, { month: 'Jun', nilai: 68000000 },
  { month: 'Jul', nilai: 79000000 }, { month: 'Agu', nilai: 88000000 },
  { month: 'Sep', nilai: 85000000 }, { month: 'Okt', nilai: 95000000 },
  { month: 'Nov', nilai: 102000000 }, { month: 'Des', nilai: 115000000 },
];

const MOCK_INVEST_YEARLY = [
  { year: '2015', saham: 0, obligasi: 0, reksa: 500000, pensiun: 200000 },
  { year: '2016', saham: 200000, obligasi: 100000, reksa: 800000, pensiun: 350000 },
  { year: '2017', saham: 400000, obligasi: 200000, reksa: 1200000, pensiun: 500000 },
  { year: '2018', saham: 800000, obligasi: 300000, reksa: 1500000, pensiun: 700000 },
  { year: '2019', saham: 2000000, obligasi: 500000, reksa: 2000000, pensiun: 900000 },
  { year: '2020', saham: 1500000, obligasi: 800000, reksa: 1800000, pensiun: 1100000 },
  { year: '2021', saham: 3000000, obligasi: 600000, reksa: 2500000, pensiun: 1200000 },
  { year: '2022', saham: 2800000, obligasi: 900000, reksa: 2200000, pensiun: 1400000 },
  { year: '2023', saham: 5000000, obligasi: 1200000, reksa: 3500000, pensiun: 1600000 },
  { year: '2024', saham: 8000000, obligasi: 1800000, reksa: 5000000, pensiun: 2000000 },
  { year: '2025', saham: 3000000, obligasi: 800000, reksa: 2000000, pensiun: 900000 },
];

const MOCK_COST_YEARLY = [
  { year: '2015', makanan: 1800000, transportasi: 600000, hiburan: 300000, lainnya: 200000 },
  { year: '2016', makanan: 1900000, transportasi: 700000, hiburan: 350000, lainnya: 250000 },
  { year: '2017', makanan: 2000000, transportasi: 750000, hiburan: 400000, lainnya: 300000 },
  { year: '2018', makanan: 5500000, transportasi: 2000000, hiburan: 1000000, lainnya: 800000 },
  { year: '2019', makanan: 2200000, transportasi: 800000, hiburan: 450000, lainnya: 350000 },
  { year: '2020', makanan: 1500000, transportasi: 400000, hiburan: 200000, lainnya: 300000 },
  { year: '2021', makanan: 2000000, transportasi: 600000, hiburan: 300000, lainnya: 400000 },
  { year: '2022', makanan: 2500000, transportasi: 900000, hiburan: 500000, lainnya: 500000 },
  { year: '2023', makanan: 2800000, transportasi: 1000000, hiburan: 600000, lainnya: 600000 },
  { year: '2024', makanan: 3000000, transportasi: 1200000, hiburan: 700000, lainnya: 700000 },
  { year: '2025', makanan: 1200000, transportasi: 500000, hiburan: 280000, lainnya: 300000 },
];

const MONTHS_SHORT = ['Jul\'24','Agu','Sep','Okt','Nov','Des','Jan\'25','Feb','Mar','Apr','Mei','Jun'];
const MOCK_COST_MONTHLY = MONTHS_SHORT.map((month, i) => ({
  month,
  makanan: 1800000 + Math.random() * 800000,
  transportasi: 600000 + Math.random() * 400000,
  hiburan: 300000 + Math.random() * 300000,
  belanja: 200000 + Math.random() * 500000,
  lainnya: 100000 + Math.random() * 300000,
}));

const MOCK_INVEST_TREND = Array.from({ length: 20 }, (_, i) => ({
  month: i,
  nilai: 2000000 + i * 600000 + Math.random() * 500000,
}));
