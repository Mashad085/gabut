import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Plus, Download, CheckCircle2, ArrowUpRight, ArrowDownRight, ArrowLeftRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { transactionsAPI } from '@/lib/api';

const formatIDR = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 2 }).format(v);

const MOCK_TRANSACTIONS = [
  { id: '1', transaction_date: '2023-06-05', payee: 'Deposit', category: 'Income', amount: 600960, transaction_type: 'credit', account_name: 'Ally Savings' },
  { id: '2', transaction_date: '2023-05-31', payee: 'Deposit', category: 'Income', amount: 740300, transaction_type: 'credit', account_name: 'Ally Savings' },
  { id: '3', transaction_date: '2023-05-26', payee: 'Online Store', category: 'Clothing', amount: 91980, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '4', transaction_date: '2023-05-21', payee: 'Movies', category: 'Food', amount: 77770, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '5', transaction_date: '2023-05-16', payee: 'Deposit', category: 'Income', amount: 207610, transaction_type: 'credit', account_name: 'Ally Savings' },
  { id: '6', transaction_date: '2023-05-11', payee: 'Online Store', category: 'Food', amount: 29790, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '7', transaction_date: '2023-05-06', payee: 'Kroger', category: 'Medical', amount: 58140, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '8', transaction_date: '2023-05-01', payee: 'Publix', category: 'General', amount: 62410, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '9', transaction_date: '2023-04-26', payee: 'Publix', category: 'General', amount: 70860, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '10', transaction_date: '2023-04-21', payee: 'Deposit', category: 'Income', amount: 354090, transaction_type: 'credit', account_name: 'Ally Savings' },
  { id: '11', transaction_date: '2023-04-16', payee: 'Movies', category: 'Gift', amount: 59800, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '12', transaction_date: '2023-04-11', payee: 'Online Store', category: 'Clothing', amount: 62510, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '13', transaction_date: '2023-04-06', payee: 'Deposit', category: 'Income', amount: 693730, transaction_type: 'credit', account_name: 'Ally Savings' },
  { id: '14', transaction_date: '2023-04-01', payee: 'Publix', category: 'General', amount: 53630, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '15', transaction_date: '2023-03-27', payee: 'Movies', category: 'General', amount: 41970, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '16', transaction_date: '2023-03-22', payee: 'Online Store', category: 'Gift', amount: 28670, transaction_type: 'debit', account_name: 'Ally Savings' },
  { id: '17', transaction_date: '2023-03-17', payee: 'Publix', category: 'Food', amount: 67310, transaction_type: 'debit', account_name: 'Ally Savings' },
];

const CATEGORY_COLORS: Record<string, string> = {
  Income: 'badge-green',
  Clothing: 'badge-blue',
  Food: 'badge-yellow',
  Medical: 'badge-red',
  General: 'badge-blue',
  Gift: 'badge-blue',
};

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['transactions', selectedAccount],
    queryFn: () => transactionsAPI.list({ account_id: selectedAccount }),
  });

  const transactions = data?.data || MOCK_TRANSACTIONS;

  const filtered = transactions.filter((t: any) =>
    !search ||
    t.payee?.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const accountBalance = 4985300;

  return (
    <div className="flex flex-col h-full">
      {/* Account header */}
      <div className="px-6 py-5 border-b border-white/[0.05]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-100">Tabungan Ally</h1>
            <p className="font-mono text-2xl font-semibold text-emerald-400 mt-0.5">
              {formatIDR(accountBalance)}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary">
              <Download size={14} /> Export
            </button>
            <button className="btn-secondary">
              <Filter size={14} /> Filter
            </button>
            <button className="btn-primary">
              <Plus size={14} /> Tambah Baru
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari transaksi..."
              className="input-field pl-9"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 glass border-b border-white/[0.06]">
            <tr className="text-xs text-slate-500 uppercase tracking-wider">
              <th className="py-3 pl-6 pr-3 text-left font-medium w-8">
                <input type="checkbox" className="rounded" />
              </th>
              <th className="py-3 px-3 text-left font-medium">Tanggal</th>
              <th className="py-3 px-3 text-left font-medium">Penerima</th>
              <th className="py-3 px-3 text-left font-medium">Catatan</th>
              <th className="py-3 px-3 text-left font-medium">Kategori</th>
              <th className="py-3 px-3 text-right font-medium">Pembayaran</th>
              <th className="py-3 px-3 pr-6 text-right font-medium">Deposit</th>
              <th className="py-3 pr-6 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            <AnimatePresence>
              {filtered.map((txn: any, i: number) => {
                const isCredit = txn.transaction_type === 'credit';
                const dateStr = txn.transaction_date
                  ? format(parseISO(txn.transaction_date), 'dd/MM/yyyy')
                  : txn.date;

                return (
                  <motion.tr
                    key={txn.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="py-2.5 pl-6 pr-3">
                      <input type="checkbox" className="rounded opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-400 whitespace-nowrap">{dateStr}</td>
                    <td className="py-2.5 px-3 text-sm text-slate-200">{txn.payee || txn.description || '—'}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">{txn.notes || ''}</td>
                    <td className="py-2.5 px-3">
                      <span className={`badge text-[10px] ${CATEGORY_COLORS[txn.category] || 'badge-blue'}`}>
                        {txn.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">
                      {!isCredit ? (
                        <span className="text-rose-400">{formatIDR(txn.amount)}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 pr-2 text-right font-mono text-xs">
                      {isCredit ? (
                        <span className="text-emerald-400">{formatIDR(txn.amount)}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-6">
                      <CheckCircle2 size={14} className="text-emerald-500 ml-auto" />
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
