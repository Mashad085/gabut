import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Coins, ArrowUpRight, ArrowDownRight, Plus, Search, Send, CreditCard } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { walletAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import toast from 'react-hot-toast';

function TransferForm({ onSave, loading }: { onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ to_user_id:'', amount:0, note:'' });
  const [search, setSearch] = useState('');
  const set = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const { data: users = [] } = useQuery({
    queryKey: ['wallet-users', search],
    queryFn: () => walletAPI.users(search||undefined),
    enabled: search.length >= 1,
  });

  const selectedUser = (users as any[]).find((u: any) => u.id === form.to_user_id);

  return (
    <div className="space-y-4">
      <FormField label="Cari Penerima" required>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="input-field w-full pl-9" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Ketik nama atau email..." />
        </div>
      </FormField>

      {(users as any[]).length > 0 && !selectedUser && (
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          {(users as any[]).map((u: any) => (
            <button key={u.id} onClick={()=>{set('to_user_id',u.id);setSearch(u.full_name);}}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.05] text-left transition-colors">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {u.full_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{u.full_name}</p>
                <p className="text-xs text-slate-500">@{u.username}</p>
              </div>
              <span className="text-xs text-amber-400 font-mono shrink-0">{u.balance} KOIN</span>
            </button>
          ))}
        </div>
      )}

      {selectedUser && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-brand-500/10 border border-brand-800/30">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {selectedUser.full_name?.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-200">{selectedUser.full_name}</p>
            <p className="text-xs text-slate-500">@{selectedUser.username}</p>
          </div>
          <button onClick={()=>{set('to_user_id','');setSearch('');}} className="text-xs text-slate-500 hover:text-slate-300">×</button>
        </div>
      )}

      <FormField label="Jumlah KOIN" required>
        <input type="number" className="input-field w-full" value={form.amount||''} onChange={e=>set('amount',parseFloat(e.target.value)||0)} min={1} placeholder="0" />
      </FormField>
      <FormField label="Catatan">
        <input className="input-field w-full" value={form.note} onChange={e=>set('note',e.target.value)} placeholder="Opsional" />
      </FormField>
      <button onClick={()=>onSave(form)} disabled={loading||!form.to_user_id||!form.amount}
        className="btn-primary w-full justify-center">
        {loading?'Memproses...':'Kirim KOIN'}
      </button>
    </div>
  );
}

function TopupForm({ onSave, loading }: { onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ user_id:'', amount:0, note:'' });
  const [search, setSearch] = useState('');
  const set = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const { data: allWallets = [] } = useQuery({ queryKey: ['wallet-all'], queryFn: walletAPI.all });
  const filtered = (allWallets as any[]).filter((u: any) =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <FormField label="Cari Member">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="input-field w-full pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama atau username..." />
        </div>
      </FormField>
      <div className="max-h-40 overflow-y-auto rounded-xl border border-white/[0.08] divide-y divide-white/[0.04]">
        {filtered.map((u: any) => (
          <button key={u.id} onClick={()=>{set('user_id',u.id);setSearch(u.full_name);}}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${form.user_id===u.id?'bg-brand-600/20':'hover:bg-white/[0.04]'}`}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {u.full_name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">{u.full_name}</p>
              <p className="text-xs text-slate-500">@{u.username}</p>
            </div>
            <span className="text-xs text-amber-400 font-mono shrink-0">{u.balance} KOIN</span>
          </button>
        ))}
      </div>
      <FormField label="Jumlah KOIN" required>
        <input type="number" className="input-field w-full" value={form.amount||''} onChange={e=>set('amount',parseFloat(e.target.value)||0)} min={1} />
      </FormField>
      <FormField label="Catatan">
        <input className="input-field w-full" value={form.note} onChange={e=>set('note',e.target.value)} />
      </FormField>
      <button onClick={()=>onSave(form)} disabled={loading||!form.user_id||!form.amount}
        className="btn-primary w-full justify-center">
        {loading?'Memproses...':'Top-up KOIN'}
      </button>
    </div>
  );
}

export default function WalletPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [modal, setModal] = useState<'transfer'|'topup'|null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['wallet-me'], queryFn: walletAPI.me });
  const wallet = data?.wallet;
  const history: any[] = data?.transactions || [];

  const transferMut = useMutation({
    mutationFn: walletAPI.transfer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet-me'] }); setModal(null); toast.success('Transfer KOIN berhasil'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Transfer gagal'),
  });
  const topupMut = useMutation({
    mutationFn: walletAPI.topup,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet-me'] }); qc.invalidateQueries({ queryKey: ['wallet-all'] }); setModal(null); toast.success('Top-up berhasil'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Top-up gagal'),
  });

  return (
    <div className="p-4 sm:p-5 lg:p-7 space-y-5 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">Dompet KOIN</h1>
        {isAdmin && (
          <button onClick={()=>setModal('topup')} className="btn-secondary text-xs px-3 py-2">
            <Plus size={13}/> Top-up Member
          </button>
        )}
      </div>

      {/* Wallet card */}
      {isLoading ? (
        <div className="card animate-pulse h-40"/>
      ) : (
        <div className="card bg-gradient-to-br from-amber-900/30 to-amber-950/40 border-amber-800/20 text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <Coins size={28} className="text-amber-400"/>
          </div>
          <p className="text-slate-400 text-xs mb-1">Saldo KOIN Kamu</p>
          <p className="font-display text-5xl font-bold text-amber-300">{wallet?.balance || 0}</p>
          <p className="text-amber-600 text-sm mt-1">KOIN</p>
          <p className="text-slate-500 text-xs mt-3">Mata uang internal komunitas · Hanya bisa ditambah oleh admin</p>
          <button onClick={()=>setModal('transfer')} className="mt-5 btn-primary mx-auto px-6">
            <Send size={14}/> Transfer KOIN
          </button>
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        <p className="font-semibold text-sm text-slate-300">Riwayat Transaksi</p>
        {history.length === 0 ? (
          <div className="card text-center py-8 text-slate-500 text-sm">Belum ada transaksi KOIN</div>
        ) : history.map((t: any, i: number) => {
          const isOut = t.type === 'transfer' && t.from_wallet_id === wallet?.id && t.to_wallet_id !== wallet?.id;
          const isTopup = t.type === 'topup';
          return (
            <motion.div key={t.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}}
              className="card flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isTopup?'bg-emerald-500/15 text-emerald-400':isOut?'bg-rose-500/15 text-rose-400':'bg-brand-500/15 text-brand-400'}`}>
                {isTopup ? <ArrowUpRight size={15}/> : isOut ? <ArrowDownRight size={15}/> : <Coins size={15}/>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">
                  {isTopup ? 'Top-up dari Admin' : isOut ? `Kirim ke ${t.to_name||'?'}` : `Dari ${t.from_name||'Admin'}`}
                </p>
                <p className="text-xs text-slate-500">
                  {t.note} · {t.created_at ? format(parseISO(t.created_at),'d MMM yyyy, HH:mm',{locale:idLocale}) : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-mono text-sm font-bold ${isOut?'text-rose-400':'text-emerald-400'}`}>
                  {isOut?'-':'+'}{t.amount} KOIN
                </p>
                <p className="text-xs text-slate-600 font-mono">{t.balance_after} KOIN</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Modal open={modal==='transfer'} onClose={()=>setModal(null)} title="Transfer KOIN" size="md">
        <TransferForm onSave={d=>transferMut.mutate(d)} loading={transferMut.isPending}/>
      </Modal>
      <Modal open={modal==='topup'} onClose={()=>setModal(null)} title="Top-up KOIN Member" size="md">
        <TopupForm onSave={d=>topupMut.mutate(d)} loading={topupMut.isPending}/>
      </Modal>
    </div>
  );
}
