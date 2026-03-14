import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, Clock, Repeat, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { schedulesAPI, accountsAPI } from '@/lib/api';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import toast from 'react-hot-toast';

const idr = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const FREQ_LABELS: Record<string, string> = {
  daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan', once: 'Sekali',
};
const FREQ_COLORS: Record<string, string> = {
  daily: '#f43f5e', weekly: '#f59e0b', monthly: '#6366f1', yearly: '#8b5cf6', once: '#10b981',
};

const CATEGORIES = ['Utilitas','Tagihan','Komunitas','Asuransi','Rumah','Tabungan','Transportasi','Kesehatan','Lainnya'];

function ScheduleForm({ initial, accounts, onSave, loading }: { initial?: any; accounts: any[]; onSave: (d: any) => void; loading: boolean }) {
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState({
    account_id:       initial?.account_id || accounts[0]?.id || '',
    transaction_type: initial?.transaction_type || 'debit',
    amount:           initial?.amount || 0,
    description:      initial?.description || '',
    payee:            initial?.payee || '',
    category:         initial?.category || 'Lainnya',
    frequency:        initial?.frequency || 'monthly',
    next_run_at:      initial?.next_run_at ? initial.next_run_at.slice(0,10) : today,
    end_date:         initial?.end_date ? initial.end_date.slice(0,10) : '',
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <FormField label="Rekening" required>
        <select className="input-field w-full" value={form.account_id} onChange={e => set('account_id', e.target.value)}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Tipe" required>
          <select className="input-field w-full" value={form.transaction_type} onChange={e => set('transaction_type', e.target.value)}>
            <option value="debit">Keluar</option>
            <option value="credit">Masuk</option>
          </select>
        </FormField>
        <FormField label="Frekuensi" required>
          <select className="input-field w-full" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            {Object.entries(FREQ_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Jumlah" required>
        <input type="number" className="input-field w-full" value={form.amount || ''} onChange={e => set('amount', parseFloat(e.target.value)||0)} min={1} />
      </FormField>
      <FormField label="Nama / Tujuan">
        <input className="input-field w-full" value={form.payee} onChange={e => set('payee', e.target.value)} placeholder="cth. PLN, Arisan RT" />
      </FormField>
      <FormField label="Keterangan">
        <input className="input-field w-full" value={form.description} onChange={e => set('description', e.target.value)} />
      </FormField>
      <FormField label="Kategori">
        <select className="input-field w-full" value={form.category} onChange={e => set('category', e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Mulai / Berikutnya" required>
          <input type="date" className="input-field w-full" value={form.next_run_at} onChange={e => set('next_run_at', e.target.value)} />
        </FormField>
        <FormField label="Berakhir (opsional)">
          <input type="date" className="input-field w-full" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </FormField>
      </div>
      <button onClick={() => onSave(form)} disabled={loading || !form.account_id || !form.amount}
        className="btn-primary w-full justify-center">
        {loading ? 'Menyimpan...' : initial ? 'Simpan Perubahan' : 'Buat Jadwal'}
      </button>
    </div>
  );
}

export default function SchedulesPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<any>(null);

  const { data: schedules = [], isLoading } = useQuery({ queryKey: ['schedules'], queryFn: schedulesAPI.list });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsAPI.list });

  const createMut = useMutation({
    mutationFn: schedulesAPI.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); setModal(null); toast.success('Jadwal dibuat'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal membuat jadwal'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => schedulesAPI.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); setModal(null); toast.success('Jadwal diperbarui'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal memperbarui'),
  });
  const deleteMut = useMutation({
    mutationFn: schedulesAPI.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); toast.success('Jadwal dihapus'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menghapus'),
  });

  const totalMonthly = schedules
    .filter((s: any) => s.frequency === 'monthly' && s.transaction_type === 'debit')
    .reduce((sum: number, s: any) => sum + parseFloat(s.amount), 0);
  const nextSchedule = schedules.length > 0 ? schedules[0] : null;

  return (
    <div className="p-4 sm:p-5 lg:p-7 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">Jadwal Transaksi</h1>
        <button onClick={() => { setEditing(null); setModal('add'); }} className="btn-primary">
          <Plus size={15} /> <span className="hidden sm:inline">Jadwal Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Jadwal Aktif', value: schedules.length, icon: Repeat, color: 'text-brand-400' },
          { label: 'Total Bulanan', value: idr(totalMonthly), icon: Calendar, color: 'text-emerald-400' },
          { label: 'Berikutnya', value: nextSchedule ? format(parseISO(nextSchedule.next_run_at), 'd MMM', { locale: idLocale }) : '-', icon: Clock, color: 'text-amber-400' },
        ].map((s, i) => (
          <div key={i} className="card p-3 sm:p-4">
            <s.icon size={16} className={`${s.color} mb-2`} />
            <p className="text-slate-500 text-[10px] sm:text-xs mb-0.5">{s.label}</p>
            <p className="text-slate-100 font-semibold text-xs sm:text-sm">{s.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_,i)=><div key={i} className="card animate-pulse h-16"/>)}</div>
      ) : schedules.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Belum ada jadwal transaksi</p>
          <button onClick={() => setModal('add')} className="btn-primary mt-4 mx-auto">Buat Jadwal Pertama</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {schedules.map((s: any, i: number) => {
            const color = FREQ_COLORS[s.frequency] || '#6366f1';
            return (
              <motion.div key={s.id} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.04 }}
                className="card hover:bg-white/[0.07] transition-all flex items-center gap-3 sm:gap-4 group">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}20`, color }}>
                  <Repeat size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-200 text-sm truncate">{s.payee || s.description || 'Jadwal'}</p>
                  <p className="text-xs text-slate-500">{FREQ_LABELS[s.frequency]} · {s.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-mono text-sm font-medium ${s.transaction_type==='debit'?'text-rose-400':'text-emerald-400'}`}>
                    {s.transaction_type==='debit'?'-':'+'}{ idr(parseFloat(s.amount)) }
                  </p>
                  <p className="text-xs text-slate-500">{format(parseISO(s.next_run_at), 'd MMM yyyy', { locale: idLocale })}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => { setEditing(s); setModal('edit'); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.08]">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => { if (confirm('Hapus jadwal ini?')) deleteMut.mutate(s.id); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10">
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={modal==='add'} onClose={()=>setModal(null)} title="Jadwal Baru" size="lg">
        <ScheduleForm accounts={accounts} onSave={d => createMut.mutate(d)} loading={createMut.isPending} />
      </Modal>
      <Modal open={modal==='edit'} onClose={()=>setModal(null)} title="Edit Jadwal" size="lg">
        {editing && <ScheduleForm initial={editing} accounts={accounts} onSave={d=>updateMut.mutate({id:editing.id,...d})} loading={updateMut.isPending} />}
      </Modal>
    </div>
  );
}
