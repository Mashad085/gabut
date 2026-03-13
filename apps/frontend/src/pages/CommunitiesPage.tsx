import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Plus, Search, TrendingUp, Coins, HandHeart, Building2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { communitiesAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const formatIDR = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const TYPE_ICONS: Record<string, any> = {
  arisan: Coins,
  koperasi: Building2,
  savings_group: HandHeart,
  investment_club: TrendingUp,
  general: Users,
};

const TYPE_LABELS: Record<string, string> = {
  arisan: 'Arisan',
  koperasi: 'Koperasi',
  savings_group: 'Grup Tabungan',
  investment_club: 'Klub Investasi',
  general: 'Umum',
};

const TYPE_COLORS: Record<string, string> = {
  arisan: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  koperasi: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  savings_group: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  investment_club: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  general: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

const MOCK_COMMUNITIES = [
  { id: '1', name: 'Arisan RT 05 Kelurahan Merdeka', community_type: 'arisan', member_count: 24, total_fund: 12500000, is_member: true, description: 'Arisan rutin bulanan warga RT 05', slug: 'arisan-rt-05', creator_name: 'Pak Budi' },
  { id: '2', name: 'Koperasi Simpan Pinjam Bersama', community_type: 'koperasi', member_count: 87, total_fund: 245000000, is_member: true, description: 'Koperasi simpan pinjam resmi untuk seluruh anggota', slug: 'ksp-bersama', creator_name: 'Bu Siti' },
  { id: '3', name: 'Club Investasi Muda Indonesia', community_type: 'investment_club', member_count: 156, total_fund: 875000000, is_member: false, description: 'Komunitas belajar dan berinvestasi bersama untuk generasi muda', slug: 'investasi-muda', creator_name: 'Andi Pratama' },
  { id: '4', name: 'Grup Tabungan Bersama Keluarga', community_type: 'savings_group', member_count: 8, total_fund: 48000000, is_member: false, description: 'Dana bersama untuk kebutuhan keluarga besar', slug: 'tabungan-keluarga', creator_name: 'Sari Dewi' },
  { id: '5', name: 'Arisan Ibu PKK RW 03', community_type: 'arisan', member_count: 35, total_fund: 28000000, is_member: false, description: 'Arisan ibu-ibu PKK RW 03', slug: 'pkk-rw03', creator_name: 'Ibu Ani' },
  { id: '6', name: 'Koperasi Karyawan PT Maju Jaya', community_type: 'koperasi', member_count: 210, total_fund: 1200000000, is_member: false, description: 'Koperasi resmi karyawan PT Maju Jaya', slug: 'kopkar-maju-jaya', creator_name: 'HR Dept' },
];

export default function CommunitiesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'my'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: allComms } = useQuery({
    queryKey: ['communities', filter, search],
    queryFn: () => communitiesAPI.list({ type: filter, search }),
  });

  const { data: myComms } = useQuery({
    queryKey: ['communities', 'my'],
    queryFn: communitiesAPI.my,
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => communitiesAPI.join(id),
    onSuccess: () => {
      toast.success('Berhasil bergabung ke komunitas!');
      qc.invalidateQueries({ queryKey: ['communities'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal bergabung'),
  });

  const communities = tab === 'my'
    ? (myComms || MOCK_COMMUNITIES.filter(c => c.is_member))
    : (allComms?.data || MOCK_COMMUNITIES).filter((c: any) =>
        (!search || c.name.toLowerCase().includes(search.toLowerCase())) &&
        (!filter || c.community_type === filter)
      );

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Komunitas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Kelola dan bergabung dengan komunitas keuangan</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={15} /> Buat Komunitas
        </button>
      </div>

      {/* My Community Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 gap-4"
      >
        {[
          { label: 'Komunitas Diikuti', value: MOCK_COMMUNITIES.filter(c => c.is_member).length, icon: Users, color: 'text-brand-400 bg-brand-500/10' },
          { label: 'Total Kontribusi', value: formatIDR(18750000), icon: Coins, color: 'text-emerald-400 bg-emerald-500/10' },
          { label: 'Dana Komunitas', value: formatIDR(258250000), icon: TrendingUp, color: 'text-amber-400 bg-amber-500/10' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
              <s.icon size={17} className={s.color.split(' ')[0]} />
            </div>
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className="text-slate-100 font-semibold text-lg">{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex bg-white/[0.04] rounded-xl p-1 gap-1">
          {[['all', 'Semua'], ['my', 'Komunitas Saya']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v as any)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === v ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-48 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari komunitas..."
            className="input-field pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {[null, 'arisan', 'koperasi', 'savings_group', 'investment_club'].map(type => (
            <button
              key={type ?? 'all'}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                filter === type
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/[0.15]'
              }`}
            >
              {type ? TYPE_LABELS[type] : 'Semua'}
            </button>
          ))}
        </div>
      </div>

      {/* Community Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {communities.map((comm: any, i: number) => {
          const Icon = TYPE_ICONS[comm.community_type] || Users;
          const colorClass = TYPE_COLORS[comm.community_type] || TYPE_COLORS.general;

          return (
            <motion.div
              key={comm.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card hover:bg-white/[0.07] transition-all cursor-pointer group"
              onClick={() => navigate(`/communities/${comm.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Icon size={18} />
                </div>
                {comm.is_member && (
                  <span className="badge badge-green text-[10px]">Anggota</span>
                )}
              </div>

              <h3 className="font-semibold text-slate-100 text-sm mb-1 line-clamp-1 group-hover:text-brand-300 transition-colors">
                {comm.name}
              </h3>
              <p className="text-xs text-slate-500 mb-3 line-clamp-2">{comm.description}</p>

              <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                <div className="flex items-center gap-1">
                  <Users size={12} />
                  <span>{comm.member_count} anggota</span>
                </div>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${colorClass}`}>
                  <Icon size={10} />
                  {TYPE_LABELS[comm.community_type]}
                </div>
              </div>

              <div className="border-t border-white/[0.05] pt-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-600">Total Dana</p>
                  <p className="text-xs font-mono font-medium text-emerald-400">
                    {formatIDR(parseFloat(comm.total_fund || comm.main_fund_balance || 0))}
                  </p>
                </div>

                {!comm.is_member ? (
                  <button
                    className="btn-primary py-1.5 text-xs"
                    onClick={e => { e.stopPropagation(); joinMutation.mutate(comm.id); }}
                  >
                    Bergabung
                  </button>
                ) : (
                  <button className="text-slate-500 hover:text-slate-300 group-hover:text-brand-400 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
