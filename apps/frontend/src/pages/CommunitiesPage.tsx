import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Plus, Search, Globe, Lock, Coins, TrendingUp } from 'lucide-react';
import { communitiesAPI } from '@/lib/api';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import toast from 'react-hot-toast';

const idr = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const TYPE_LABELS: Record<string,string> = {
  arisan:'Arisan', koperasi:'Koperasi', savings_group:'Kelompok Tabungan',
  investment_club:'Klub Investasi', general:'Umum',
};
const TYPE_COLORS: Record<string,string> = {
  arisan:'#6366f1', koperasi:'#10b981', savings_group:'#f59e0b',
  investment_club:'#f43f5e', general:'#8b5cf6',
};

function CreateCommunityForm({ onSave, loading }: { onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    name:'', description:'', community_type:'general', is_public:true,
    max_members:'', contribution_amount:'',
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <FormField label="Nama Komunitas" required>
        <input className="input-field w-full" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="cth. Arisan RT 05" />
      </FormField>
      <FormField label="Deskripsi">
        <textarea className="input-field w-full h-20 resize-none" value={form.description} onChange={e=>set('description',e.target.value)} />
      </FormField>
      <FormField label="Tipe" required>
        <select className="input-field w-full" value={form.community_type} onChange={e=>set('community_type',e.target.value)}>
          {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Maks. Anggota">
          <input type="number" className="input-field w-full" value={form.max_members} onChange={e=>set('max_members',e.target.value)} placeholder="Tidak terbatas" min={2} />
        </FormField>
        <FormField label="Iuran (IDR)">
          <input type="number" className="input-field w-full" value={form.contribution_amount} onChange={e=>set('contribution_amount',e.target.value)} placeholder="0" min={0} />
        </FormField>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_public} onChange={e=>set('is_public',e.target.checked)} className="w-4 h-4 rounded" />
        <span className="text-sm text-slate-300">Komunitas publik (bisa ditemukan semua orang)</span>
      </label>
      <button onClick={()=>onSave({
        ...form,
        max_members: form.max_members ? parseInt(form.max_members) : undefined,
        contribution_amount: form.contribution_amount ? parseFloat(form.contribution_amount) : undefined,
      })} disabled={loading||!form.name} className="btn-primary w-full justify-center">
        {loading?'Membuat...':'Buat Komunitas'}
      </button>
    </div>
  );
}

export default function CommunitiesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState<'discover'|'my'>('my');
  const [search, setSearch] = useState('');

  const { data: myCommunities = [] } = useQuery({ queryKey: ['communities-my'], queryFn: communitiesAPI.my });
  const { data: discover } = useQuery({
    queryKey: ['communities-discover', search],
    queryFn: () => communitiesAPI.list({ search: search || undefined }),
  });
  const discoverList: any[] = discover?.data || [];

  const createMut = useMutation({
    mutationFn: communitiesAPI.create,
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['communities'] }); setModal(false); toast.success('Komunitas dibuat'); navigate(`/communities/${d.id}`); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });
  const joinMut = useMutation({
    mutationFn: communitiesAPI.join,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['communities'] }); toast.success('Berhasil bergabung'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal bergabung'),
  });

  const renderCard = (c: any) => {
    const color = TYPE_COLORS[c.community_type] || '#6366f1';
    return (
      <motion.div key={c.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
        className="card-hover p-4 sm:p-5 cursor-pointer relative overflow-hidden"
        onClick={() => navigate(`/communities/${c.id}`)}>
        <div className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-5 pointer-events-none"
          style={{ background: color, transform:'translate(30%,-30%)' }} />
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:`${color}20`,color}}>
            <Users size={18}/>
          </div>
          <div className="flex items-center gap-1.5">
            {c.is_public ? <Globe size={12} className="text-slate-500"/> : <Lock size={12} className="text-slate-500"/>}
            <span className="text-[10px] text-slate-500 capitalize">{TYPE_LABELS[c.community_type]||c.community_type}</span>
          </div>
        </div>
        <p className="font-semibold text-slate-200 text-sm mb-1 truncate">{c.name}</p>
        {c.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{c.description}</p>}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Users size={11}/>
            <span>{c.member_count} anggota</span>
          </div>
          {tab==='my' ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{borderColor:`${color}40`,color,background:`${color}15`}}>
              {c.my_role==='admin'?'Admin':'Anggota'}
            </span>
          ) : c.is_member ? (
            <span className="text-[10px] text-emerald-400">✓ Bergabung</span>
          ) : (
            <button onClick={e=>{e.stopPropagation();joinMut.mutate(c.id);}}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-brand-600/20 text-brand-300 hover:bg-brand-600/40 transition-colors">
              Gabung
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="p-4 sm:p-5 lg:p-7 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">Komunitas</h1>
        <button onClick={()=>setModal(true)} className="btn-primary">
          <Plus size={15}/> <span className="hidden sm:inline">Buat</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label:'Komunitas Saya', value:myCommunities.length, icon:Users, color:'text-brand-400' },
          { label:'Total Kontribusi', value:idr(myCommunities.reduce((s:number,c:any)=>s+parseFloat(c.total_contributed||0),0)), icon:Coins, color:'text-emerald-400' },
        ].map((s,i)=>(
          <div key={i} className="card p-3 sm:p-4">
            <s.icon size={16} className={`${s.color} mb-2`}/>
            <p className="text-slate-500 text-[10px] sm:text-xs mb-0.5">{s.label}</p>
            <p className="text-slate-100 font-semibold text-xs sm:text-sm">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl w-fit">
        {[['my','Komunitas Saya'],['discover','Temukan']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab===v?'bg-brand-600 text-white shadow-sm':'text-slate-400 hover:text-slate-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab==='discover' && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari komunitas..." className="input-field pl-9 w-full text-sm"/>
        </div>
      )}

      {tab==='my' ? (
        myCommunities.length===0 ? (
          <div className="card text-center py-12">
            <Users size={32} className="text-slate-600 mx-auto mb-3"/>
            <p className="text-slate-400 text-sm">Belum bergabung dengan komunitas</p>
            <button onClick={()=>setTab('discover')} className="btn-secondary mt-4 mx-auto">Temukan Komunitas</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myCommunities.map(renderCard)}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {discoverList.map(renderCard)}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title="Buat Komunitas Baru" size="lg">
        <CreateCommunityForm onSave={d=>createMut.mutate(d)} loading={createMut.isPending}/>
      </Modal>
    </div>
  );
}
