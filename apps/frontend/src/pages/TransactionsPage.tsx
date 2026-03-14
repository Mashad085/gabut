import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Plus, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { transactionsAPI, accountsAPI } from '@/lib/api';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import toast from 'react-hot-toast';

const idr = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const CATEGORIES = ['Makanan','Restoran','Belanja','Hiburan','Transportasi','Kesehatan','Pendidikan','Tagihan','Gaji','Investasi','Transfer','Lainnya'];

function TxnForm({ accounts, onSave, loading }: { accounts: any[]; onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    account_id: accounts[0]?.id || '',
    transaction_type: 'debit' as 'debit'|'credit',
    amount: 0,
    description: '',
    payee: '',
    category: 'Lainnya',
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <FormField label="Rekening" required>
        <select className="input-field w-full" value={form.account_id} onChange={e => set('account_id', e.target.value)}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} — {idr(a.balance)}</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Tipe" required>
          <select className="input-field w-full" value={form.transaction_type} onChange={e => set('transaction_type', e.target.value)}>
            <option value="debit">Pengeluaran</option>
            <option value="credit">Pemasukan</option>
          </select>
        </FormField>
        <FormField label="Kategori">
          <select className="input-field w-full" value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Jumlah" required>
        <input type="number" className="input-field w-full" value={form.amount||''} onChange={e=>set('amount',parseFloat(e.target.value)||0)} min={1} />
      </FormField>
      <FormField label="Tujuan / Sumber">
        <input className="input-field w-full" value={form.payee} onChange={e=>set('payee',e.target.value)} placeholder="cth. Supermarket, Gaji" />
      </FormField>
      <FormField label="Keterangan">
        <input className="input-field w-full" value={form.description} onChange={e=>set('description',e.target.value)} />
      </FormField>
      <button onClick={()=>onSave(form)} disabled={loading||!form.account_id||!form.amount} className="btn-primary w-full justify-center">
        {loading?'Menyimpan...':'Simpan Transaksi'}
      </button>
    </div>
  );
}

const TXN_ICON: Record<string,any> = {
  credit: ArrowUpRight, debit: ArrowDownRight, transfer: ArrowLeftRight,
};
const TXN_COLOR: Record<string,string> = {
  credit: 'text-emerald-400', debit: 'text-rose-400', transfer: 'text-brand-400',
};

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsAPI.list });
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', typeFilter],
    queryFn: () => transactionsAPI.list(typeFilter ? { transaction_type: typeFilter } : undefined),
  });
  const transactions: any[] = data?.data || [];

  const createMut = useMutation({
    mutationFn: transactionsAPI.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); setModal(false); toast.success('Transaksi dicatat'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menyimpan'),
  });

  const filtered = transactions.filter((t: any) =>
    !search ||
    t.payee?.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-6 py-4 border-b border-white/[0.05] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold text-slate-100">Transaksi</h1>
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus size={14} /> <span className="hidden sm:inline">Tambah</span>
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari transaksi..." className="input-field pl-9 w-full text-sm" />
          </div>
          <div className="flex gap-1">
            {[['','Semua'],['credit','Masuk'],['debit','Keluar'],['transfer','Transfer']].map(([v,l])=>(
              <button key={v} onClick={()=>setTypeFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter===v?'bg-brand-600 text-white':'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(6)].map((_,i)=><div key={i} className="card animate-pulse h-14"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <ArrowLeftRight size={32} className="mb-3 opacity-40" />
            <p className="text-sm">Belum ada transaksi</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((t: any, i: number) => {
              const Icon = TXN_ICON[t.transaction_type] || ArrowLeftRight;
              const color = TXN_COLOR[t.transaction_type] || 'text-slate-400';
              return (
                <motion.div key={t.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: i*0.02 }}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 hover:bg-white/[0.03] transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color} bg-current/10`} style={{background:'rgba(99,102,241,0.1)'}}>
                    <Icon size={14} className={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{t.payee || t.description || 'Transaksi'}</p>
                    <p className="text-xs text-slate-500">{t.category} · {t.account_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-mono text-sm font-medium ${color}`}>
                      {t.transaction_type==='credit'?'+':'-'}{idr(parseFloat(t.amount))}
                    </p>
                    <p className="text-xs text-slate-600">
                      {t.transaction_date ? format(parseISO(t.transaction_date), 'd MMM yy', { locale: idLocale }) : ''}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="Tambah Transaksi" size="lg">
        {accounts.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">Buat rekening terlebih dahulu sebelum menambah transaksi.</p>
        ) : (
          <TxnForm accounts={accounts} onSave={d=>createMut.mutate(d)} loading={createMut.isPending} />
        )}
      </Modal>
    </div>
  );
}
