import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Coins, Plus, Crown, UserMinus, Shield, UserPlus, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { communitiesAPI, accountsAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import toast from 'react-hot-toast';

const idr = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const TYPE_COLORS: Record<string,string> = {
  arisan:'#6366f1', koperasi:'#10b981', savings_group:'#f59e0b',
  investment_club:'#f43f5e', general:'#8b5cf6',
};

function ContributeForm({ communityId, accounts, onSave, loading }: { communityId: string; accounts: any[]; onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ from_account_id: accounts[0]?.id||'', amount:0, description:'' });
  const set = (k:string,v:any) => setForm(p=>({...p,[k]:v}));
  const acc = accounts.find(a=>a.id===form.from_account_id);
  return (
    <div className="space-y-4">
      <FormField label="Dari Rekening" required>
        <select className="input-field w-full" value={form.from_account_id} onChange={e=>set('from_account_id',e.target.value)}>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.account_name} — {idr(a.balance)}</option>)}
        </select>
      </FormField>
      <FormField label="Jumlah Kontribusi" required>
        <input type="number" className="input-field w-full" value={form.amount||''} onChange={e=>set('amount',parseFloat(e.target.value)||0)} min={1} />
      </FormField>
      <FormField label="Keterangan">
        <input className="input-field w-full" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Opsional" />
      </FormField>
      {acc && parseFloat(acc.balance) < form.amount && (
        <p className="text-xs text-rose-400">⚠ Saldo rekening tidak mencukupi ({idr(acc.balance)})</p>
      )}
      <button onClick={()=>onSave(form)} disabled={loading||!form.amount||!form.from_account_id} className="btn-primary w-full justify-center">
        {loading?'Memproses...':'Kirim Kontribusi'}
      </button>
    </div>
  );
}

function AddMemberForm({ communityId, onSave, loading }: { communityId: string; onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ identifier:'', role:'member' });
  const set = (k:string,v:any) => setForm(p=>({...p,[k]:v}));
  return (
    <div className="space-y-4">
      <FormField label="Email atau Username" required hint="Masukkan email atau username anggota yang ingin ditambahkan">
        <input className="input-field w-full" value={form.identifier} onChange={e=>set('identifier',e.target.value)} placeholder="email@domain.com atau @username" />
      </FormField>
      <FormField label="Role">
        <select className="input-field w-full" value={form.role} onChange={e=>set('role',e.target.value)}>
          <option value="member">Anggota</option>
          <option value="admin">Admin</option>
        </select>
      </FormField>
      <button onClick={()=>onSave(form)} disabled={loading||!form.identifier} className="btn-primary w-full justify-center">
        {loading?'Menambahkan...':'Tambah Anggota'}
      </button>
    </div>
  );
}

export default function CommunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'members'|'transactions'>('members');
  const [modal, setModal] = useState<'contribute'|'addMember'|null>(null);

  const { data: comm, isLoading } = useQuery({ queryKey: ['community', id], queryFn: () => communitiesAPI.get(id!) });
  const { data: members = [] } = useQuery({ queryKey: ['community-members', id], queryFn: () => communitiesAPI.members(id!) });
  const { data: txnData } = useQuery({ queryKey: ['community-txns', id], queryFn: () => communitiesAPI.transactions(id!) });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsAPI.list });

  const txns: any[] = txnData?.data || [];
  const isAdmin = comm?.my_role === 'admin' || user?.role === 'admin';
  const color = TYPE_COLORS[comm?.community_type] || '#6366f1';

  const contributeMut = useMutation({
    mutationFn: (d: any) => communitiesAPI.contribute(id!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community', id] }); qc.invalidateQueries({ queryKey: ['community-txns', id] }); setModal(null); toast.success('Kontribusi berhasil'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });
  const addMemberMut = useMutation({
    mutationFn: (d: any) => communitiesAPI.addMember(id!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-members', id] }); setModal(null); toast.success('Anggota ditambahkan'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });
  const removeMemberMut = useMutation({
    mutationFn: (uid: string) => communitiesAPI.removeMember(id!, uid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-members', id] }); toast.success('Anggota dikeluarkan'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });
  const updateRoleMut = useMutation({
    mutationFn: ({ uid, role }: any) => communitiesAPI.updateRole(id!, uid, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-members', id] }); toast.success('Role diperbarui'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });

  if (isLoading) return (
    <div className="p-5 space-y-4">
      <div className="card animate-pulse h-36"/>
      <div className="card animate-pulse h-48"/>
    </div>
  );
  if (!comm) return (
    <div className="p-5 text-center text-slate-400">
      <p>Komunitas tidak ditemukan</p>
      <button onClick={()=>navigate('/communities')} className="btn-secondary mt-4">Kembali</button>
    </div>
  );

  return (
    <div className="p-4 sm:p-5 lg:p-7 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={()=>navigate('/communities')} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/[0.07] text-slate-400">
          <ArrowLeft size={18}/>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-100 truncate">{comm.name}</h1>
          <p className="text-xs text-slate-500 capitalize">{comm.community_type?.replace('_',' ')}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={()=>setModal('addMember')} className="btn-secondary text-xs px-3 py-2">
              <UserPlus size={13}/> <span className="hidden sm:inline">Anggota</span>
            </button>
          )}
          {comm.my_role && (
            <button onClick={()=>setModal('contribute')} className="btn-primary text-xs px-3 py-2">
              <Coins size={13}/> <span className="hidden sm:inline">Kontribusi</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Dana Terkumpul', value:idr(parseFloat(comm.total_funds||0)), color:'text-emerald-400' },
          { label:'Total Anggota', value:`${comm.member_count} orang`, color:'text-brand-400' },
          { label:'Kontribusi Saya', value:idr(parseFloat(comm.total_contributed||0)), color:'text-amber-400' },
          { label:'Role Saya', value:comm.my_role==='admin'?'Admin':comm.my_role?'Anggota':'Bukan Anggota', color:'text-slate-300' },
        ].map((s,i)=>(
          <div key={i} className="card p-3 sm:p-4">
            <p className="text-[10px] text-slate-500 mb-1">{s.label}</p>
            <p className={`font-semibold text-xs sm:text-sm ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl w-fit">
        {[['members','Anggota'],['transactions','Transaksi']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab===v?'bg-brand-600 text-white':'text-slate-400 hover:text-slate-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Members */}
      {tab==='members' && (
        <div className="space-y-2">
          {members.map((m: any) => (
            <motion.div key={m.user_id} initial={{opacity:0}} animate={{opacity:1}}
              className="card flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-emerald-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {m.full_name?.charAt(0)||'?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-200 truncate">{m.full_name}</p>
                  {m.role==='admin' && <Crown size={12} className="text-amber-400 shrink-0"/>}
                </div>
                <p className="text-xs text-slate-500">@{m.username} · Kontribusi: {idr(parseFloat(m.total_contributed||0))}</p>
              </div>
              {isAdmin && m.user_id !== user?.id && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={()=>updateRoleMut.mutate({uid:m.user_id,role:m.role==='admin'?'member':'admin'})}
                    title={m.role==='admin'?'Turunkan jadi member':'Jadikan admin'}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-400 hover:bg-amber-500/10">
                    {m.role==='admin' ? <Shield size={12}/> : <Crown size={12}/>}
                  </button>
                  <button onClick={()=>{if(confirm(`Keluarkan ${m.full_name}?`)) removeMemberMut.mutate(m.user_id);}}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10">
                    <UserMinus size={12}/>
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Transactions */}
      {tab==='transactions' && (
        <div className="space-y-2">
          {txns.length===0 ? (
            <div className="card text-center py-8 text-slate-500 text-sm">Belum ada transaksi</div>
          ) : txns.map((t: any, i: number) => (
            <motion.div key={t.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.03}}
              className="card flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:`${color}20`,color}}>
                <Coins size={14}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{t.description||t.transaction_type}</p>
                <p className="text-xs text-slate-500">{t.full_name} · {t.created_at?format(parseISO(t.created_at),'d MMM yyyy',{locale:idLocale}):''}</p>
              </div>
              <p className="font-mono text-sm font-medium text-emerald-400 shrink-0">{idr(parseFloat(t.amount))}</p>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={modal==='contribute'} onClose={()=>setModal(null)} title="Kontribusi ke Komunitas" size="md">
        {accounts.length===0 ? (
          <p className="text-slate-400 text-sm text-center py-4">Buat rekening terlebih dahulu.</p>
        ) : (
          <ContributeForm communityId={id!} accounts={accounts} onSave={d=>contributeMut.mutate(d)} loading={contributeMut.isPending}/>
        )}
      </Modal>
      <Modal open={modal==='addMember'} onClose={()=>setModal(null)} title="Tambah Anggota" size="sm">
        <AddMemberForm communityId={id!} onSave={d=>addMemberMut.mutate(d)} loading={addMemberMut.isPending}/>
      </Modal>
    </div>
  );
}
