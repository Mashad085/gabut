import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  CreditCard, Plus, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { reportsAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatIDR } from '@/lib/utils';
import LoadingSkeleton from '@/components/LoadingSkeleton';

const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6',
  '#06b6d4', '#84cc16', '#ec4899', '#14b8a6', '#f97316',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-white/[0.12] text-xs">
      <p className="text-slate-400 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-mono text-slate-100">{formatIDR(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } },
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [hideBalance, setHideBalance] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: reportsAPI.dashboard,
  });

  if (isLoading) return <LoadingSkeleton />;

  const summary = data?.summary || {};
  const accounts = data?.accounts || [];
  const cashflow = data?.monthly_cashflow || [];
  const categories = data?.category_breakdown || [];
  const recentTxns = data?.recent_transactions || [];
  const netWorthTrend = data?.net_worth_trend || [];

  const netWorthData = netWorthTrend.map((d: any) => ({
    month: format(parseISO(d.month), 'MMM', { locale: id }),
    value: parseFloat(d.net_change),
  }));

  const cashflowData = cashflow.slice(-6).map((d: any) => ({
    month: format(parseISO(d.month), 'MMM yy', { locale: id }),
    income: parseFloat(d.income),
    expenses: parseFloat(d.expenses),
  }));

  const val = (v: number) => hideBalance ? '••••••' : formatIDR(v);

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-0.5">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Selamat datang, {user?.full_name?.split(' ')[0]} 👋
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setHideBalance(!hideBalance)}
            className="btn-secondary"
          >
            {hideBalance ? <Eye size={15} /> : <EyeOff size={15} />}
            {hideBalance ? 'Tampilkan' : 'Sembunyikan'}
          </button>
          <button className="btn-primary">
            <Plus size={15} /> Transaksi Baru
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: 'Total Saldo',
            value: val(summary.total_balance),
            icon: Wallet,
            color: 'text-brand-400',
            bg: 'bg-brand-500/10',
            change: '+2.4%',
            up: true,
          },
          {
            label: 'Pendapatan Bulan Ini',
            value: val(summary.monthly_income),
            icon: TrendingUp,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            change: '+12.1%',
            up: true,
          },
          {
            label: 'Pengeluaran Bulan Ini',
            value: val(summary.monthly_expenses),
            icon: TrendingDown,
            color: 'text-rose-400',
            bg: 'bg-rose-500/10',
            change: '-3.5%',
            up: false,
          },
          {
            label: 'Tabungan Bersih',
            value: val(summary.net_savings),
            icon: CreditCard,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            change: '+8.2%',
            up: true,
          },
        ].map((card) => (
          <motion.div key={card.label} variants={stagger.item} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon size={17} className={card.color} />
              </div>
              <span className={`badge ${card.up ? 'badge-green' : 'badge-red'} text-[10px]`}>
                {card.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {card.change}
              </span>
            </div>
            <p className="text-slate-500 text-xs mb-1">{card.label}</p>
            <p className={`font-mono text-lg font-semibold ${
              hideBalance ? 'text-slate-500 tracking-widest' : 'text-slate-100'
            }`}>
              {card.value}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Net Worth Trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 card"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="section-title text-base">Tren Kekayaan Bersih</h3>
              <p className="text-slate-500 text-xs mt-0.5">12 bulan terakhir</p>
            </div>
            <button className="text-slate-500 hover:text-slate-300 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthData.length ? netWorthData : MOCK_NETWORTH}>
                <defs>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Kekayaan Bersih"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#netGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Accounts */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-base">Rekening</h3>
            <button className="text-xs text-brand-400 hover:text-brand-300">Lihat semua</button>
          </div>
          <div className="space-y-2.5">
            {(accounts.length ? accounts : MOCK_ACCOUNTS).map((acc: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer border border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold"
                    style={{ background: `${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}20`, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}>
                    {acc.account_name?.charAt(0) || 'R'}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200">{acc.account_name}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{acc.account_type}</p>
                  </div>
                </div>
                <p className={`text-xs font-mono font-medium ${parseFloat(acc.balance) >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
                  {val(parseFloat(acc.balance))}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cash Flow Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-2 card"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="section-title text-base">Arus Kas Bulanan</h3>
              <p className="text-slate-500 text-xs mt-0.5">Pendapatan vs Pengeluaran</p>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowData.length ? cashflowData : MOCK_CASHFLOW} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="income" name="Pendapatan" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Pengeluaran" fill="#f43f5e" radius={[3, 3, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Category Pie */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <h3 className="section-title text-base mb-4">Kategori Pengeluaran</h3>
          <div className="h-36 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories.length ? categories : MOCK_CATEGORIES}
                  cx="50%" cy="50%"
                  innerRadius={35} outerRadius={60}
                  dataKey="total"
                  nameKey="category"
                >
                  {(categories.length ? categories : MOCK_CATEGORIES).map((_: any, i: number) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatIDR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {(categories.length ? categories : MOCK_CATEGORIES).slice(0, 4).map((cat: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[i] }} />
                  <span className="text-slate-400">{cat.category}</span>
                </div>
                <span className="font-mono text-slate-300">{formatIDR(parseFloat(cat.total))}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title text-base">Transaksi Terbaru</h3>
          <button className="text-xs text-brand-400 hover:text-brand-300">Lihat semua</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/[0.05]">
                <th className="pb-2.5 text-left font-medium">Tanggal</th>
                <th className="pb-2.5 text-left font-medium">Deskripsi</th>
                <th className="pb-2.5 text-left font-medium">Kategori</th>
                <th className="pb-2.5 text-left font-medium">Rekening</th>
                <th className="pb-2.5 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {(recentTxns.length ? recentTxns : MOCK_TRANSACTIONS).map((txn: any, i: number) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-2.5 text-slate-500 font-mono text-xs">
                    {txn.transaction_date ? format(parseISO(txn.transaction_date), 'dd MMM', { locale: id }) : txn.date}
                  </td>
                  <td className="py-2.5 text-slate-200 text-xs">{txn.description || txn.payee || '—'}</td>
                  <td className="py-2.5">
                    <span className="badge badge-blue text-[10px]">{txn.category}</span>
                  </td>
                  <td className="py-2.5 text-slate-400 text-xs">{txn.account_name || '—'}</td>
                  <td className={`py-2.5 text-right font-mono text-xs font-medium ${
                    txn.transaction_type === 'credit' ? 'money-positive' : 'money-negative'
                  }`}>
                    {txn.transaction_type === 'credit' ? '+' : '-'}
                    {val(parseFloat(txn.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

// Mock data for demo
const MOCK_NETWORTH = [
  { month: 'Jan', value: 15000000 }, { month: 'Feb', value: 18000000 },
  { month: 'Mar', value: 16500000 }, { month: 'Apr', value: 21000000 },
  { month: 'Mei', value: 23500000 }, { month: 'Jun', value: 22000000 },
  { month: 'Jul', value: 26000000 }, { month: 'Agu', value: 28500000 },
  { month: 'Sep', value: 27000000 }, { month: 'Okt', value: 31000000 },
  { month: 'Nov', value: 34000000 }, { month: 'Des', value: 38500000 },
];

const MOCK_CASHFLOW = [
  { month: 'Agu', income: 8500000, expenses: 5200000 },
  { month: 'Sep', income: 9200000, expenses: 6100000 },
  { month: 'Okt', income: 8800000, expenses: 4900000 },
  { month: 'Nov', income: 10500000, expenses: 7200000 },
  { month: 'Des', income: 11000000, expenses: 8500000 },
  { month: 'Jan', income: 9500000, expenses: 5800000 },
];

const MOCK_CATEGORIES = [
  { category: 'Makanan', total: 2500000 },
  { category: 'Transportasi', total: 1200000 },
  { category: 'Belanja', total: 800000 },
  { category: 'Hiburan', total: 600000 },
  { category: 'Kesehatan', total: 400000 },
];

const MOCK_ACCOUNTS = [
  { account_name: 'Tabungan Utama', account_type: 'savings', balance: 25000000 },
  { account_name: 'Rekening Harian', account_type: 'checking', balance: 3500000 },
  { account_name: 'Investasi', account_type: 'investment', balance: 15000000 },
  { account_name: 'Dana Darurat', account_type: 'savings', balance: 8000000 },
];

const MOCK_TRANSACTIONS = [
  { date: '13 Mar', description: 'Gaji Bulan Maret', category: 'Income', account_name: 'Tabungan Utama', amount: 9500000, transaction_type: 'credit' },
  { date: '12 Mar', description: 'Belanja Groceries', category: 'Makanan', account_name: 'Rekening Harian', amount: 350000, transaction_type: 'debit' },
  { date: '11 Mar', description: 'Tagihan Listrik', category: 'Utilitas', account_name: 'Rekening Harian', amount: 280000, transaction_type: 'debit' },
  { date: '10 Mar', description: 'Transfer ke Investasi', category: 'Investasi', account_name: 'Tabungan Utama', amount: 2000000, transaction_type: 'debit' },
  { date: '09 Mar', description: 'Pendapatan Freelance', category: 'Income', account_name: 'Tabungan Utama', amount: 1500000, transaction_type: 'credit' },
];

// Utils
function formatIDR(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}
