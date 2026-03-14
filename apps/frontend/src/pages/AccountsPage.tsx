import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, Plus, ArrowUpRight, Pencil, Trash2, ArrowLeftRight, Star } from 'lucide-react';
import { accountsAPI } from '@/lib/api';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import toast from 'react-hot-toast';

const idr = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const TYPE_COLORS: Record<string, string> = {
  savings: '#6366f1', checking: '#10b981', investment: '#f59e0b', loan: '#f43f5e',
};
const TYPE_LABELS: Record<string, string> = {
  savings: 'Tabungan', checking: 'Giro', investment: 'Investasi', loan: 'Pinjaman',
};

function AccountForm({ initial, onSave, loading }: { initial?: any; onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    account_name: initial?.account_name || '',
    account_type: initial?.account_type || 'savings',
    initial_balance: initial?.balance || 0,
    is_primary: initial?.is_primary || false,
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <FormField label="Nama Rekening" required>
        <input className="input-field w-full" value={form.account_name} onChange={e => set('account_name', e.target.value)} placeholder="cth. Tabungan Utama" />
      </FormField>
      <FormField label="Tipe Rekening" required>
        <select className="input-field w-full" value={form.account_type} onChange={e => set('account_type', e.target.value)}>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FormField>
      {!initial && (
        <FormField label="Saldo Awal">
          <input type="number" className="input-field w-full" value={form.initial_balance} onChange={e => set('initial_balance', parseFloat(e.target.value) || 0)} min={0} />
        </FormField>
      )}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)} className="w-4 h-4 rounded" />
        <span className="text-sm text-slate-300">Jadikan rekening utama</span>
      </label>
      <button onClick={() => onSave(form)} disabled={loading || !form.account_name} className="btn-primary w-full justify-center">
        {loading ? 'Menyimpan...' : initial ? 'Simpan Perubahan' : 'Buat Rekening'}
      </button>
    </div>
  );
}

function TransferForm({ accounts, onSave, loading }: { accounts: any[]; onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ from_account_id: accounts[0]?.id || '', to_account_number: '', amount: 0, description: '' });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const fromAcc = accounts.find(a => a.id === form.from_account_id);
  return (
    <div className="space-y-4">
      <FormField label="Dari Rekening" required>
        <select className="input-field w-full" value={form.from_account_id} onChange={e => set('from_account_id', e.target.value)}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} — {idr(a.balance)}</option>)}
        </select>
      </FormField>
      {fromAcc && <p className="text-xs text-slate-500">No. Rekening: <span className="font-mono text-slate-300">{fromAcc.account_number}</span></p>}
      <FormField label="Nomor Rekening Tujuan" required>
        <input className="input-field w-full font-mono" value={form.to_account_number} onChange={e => set('to_account_number', e.target.value)} placeholder="CF..." />
      </FormField>
      <FormField label="Jumlah" required>
        <input type="number" className="input-field w-full" value={form.amount || ''} onChange={e => set('amount', parseFloat(e.target.value) || 0)} min={1} placeholder="0" />
      </FormField>
      <FormField label="Keterangan">
        <input className="input-field w-full" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Opsional" />
      </FormField>
      <button onClick={() => onSave(form)} disabled={loading || !form.from_account_id || !form.to_account_number || !form.amount}
        className="btn-primary w-full justify-center">
        {loading ? 'Memproses...' : 'Transfer Sekarang'}
      </button>
    </div>
  );
}

export default function AccountsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'add' | 'edit' | 'transfer' | null>(null);
  const [editing, setEditing] = useState<any>(null);

  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: accountsAPI.list });
  const total = accounts.reduce((s: number, a: any) => s + parseFloat(a.balance || 0), 0);

  const createMut = useMutation({
    mutationFn: accountsAPI.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setModal(null); toast.success('Rekening dibuat'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal membuat rekening'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => accountsAPI.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setModal(null); toast.success('Rekening diperbarui'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal memperbarui'),
  });
  const deleteMut = useMutation({
    mutationFn: accountsAPI.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Rekening dihapus'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menghapus'),
  });
  const transferMut = useMutation({
    mutationFn: accountsAPI.transfer,
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['accounts'] }); setModal(null); toast.success(`Transfer berhasil — Ref: ${d.reference}`); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Transfer gagal'),
  });

  return (
    <div className="p-4 sm:p-5 lg:p-7 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">Rekening</h1>
        <div className="flex gap-2">
          <button onClick={() => setModal('transfer')} className="btn-secondary text-xs sm:text-sm px-3 py-2">
            <ArrowLeftRight size={14} /> <span className="hidden sm:inline">Transfer</span>
          </button>
          <button onClick={() => { setEditing(null); setModal('add'); }} className="btn-primary text-xs sm:text-sm px-3 py-2">
            <Plus size={14} /> <span className="hidden sm:inline">Tambah</span>
          </button>
        </div>
      </div>

      <div className="card bg-gradient-to-br from-brand-900/50 to-brand-950/50 border-brand-800/30">
        <p className="text-slate-400 text-xs mb-1">Total Saldo</p>
        <p className="font-display text-3xl sm:text-4xl font-bold text-brand-300">{idr(total)}</p>
        <p className="text-xs text-slate-500 mt-2">{accounts.length} rekening aktif</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card animate-pulse h-36" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="card text-center py-12">
          <CreditCard size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Belum ada rekening</p>
          <button onClick={() => setModal('add')} className="btn-primary mt-4 mx-auto">Buat Rekening Pertama</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc: any, i: number) => {
            const color = TYPE_COLORS[acc.account_type] || '#6366f1';
            return (
              <motion.div key={acc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="card-hover p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 pointer-events-none"
                  style={{ background: color, transform: 'translate(30%,-30%)' }} />
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20`, color }}>
                    <CreditCard size={18} />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {acc.is_primary && <Star size={12} className="text-amber-400 fill-amber-400" />}
                    <button onClick={() => { setEditing(acc); setModal('edit'); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.08]">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => { if (confirm('Hapus rekening ini?')) deleteMut.mutate(acc.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="font-semibold text-slate-200 text-sm mb-0.5">{acc.account_name}</p>
                <p className="text-xs text-slate-500 mb-3 font-mono">{acc.account_number}</p>
                <p className="font-mono text-lg font-bold" style={{ color }}>{idr(parseFloat(acc.balance))}</p>
                <span className="text-[10px] text-slate-600">{TYPE_LABELS[acc.account_type]}</span>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Tambah Rekening">
        <AccountForm onSave={(d) => createMut.mutate(d)} loading={createMut.isPending} />
      </Modal>
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Edit Rekening">
        {editing && <AccountForm initial={editing} onSave={(d) => updateMut.mutate({ id: editing.id, ...d })} loading={updateMut.isPending} />}
      </Modal>
      <Modal open={modal === 'transfer'} onClose={() => setModal(null)} title="Transfer IDR" size="lg">
        <TransferForm accounts={accounts} onSave={(d) => transferMut.mutate(d)} loading={transferMut.isPending} />
      </Modal>
    </div>
  );
}
