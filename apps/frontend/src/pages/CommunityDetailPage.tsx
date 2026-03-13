import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Coins, TrendingUp, Plus, Crown, Shield, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { communitiesAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const formatIDR = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const MOCK_DETAIL = {
  id: '1', name: 'Arisan RT 05 Kelurahan Merdeka', community_type: 'arisan',
  description: 'Arisan rutin bulanan warga RT 05 Kelurahan Merdeka. Setiap anggota wajib membayar iuran Rp 150.000 per bulan.',
  member_count: 24, total_funds: 12500000, my_role: 'admin', creator_name: 'Pak Budi',
};
const MOCK_MEMBERS = [
  { id: '1', full_name: 'Pak Budi Santoso', username: 'budi_s', role: 'admin', total_contributed: 3600000, joined_at: '2023-01-01' },
  { id: '2', full_name: 'Ibu Siti Rahayu', username: 'siti_r', role: 'treasurer', total_contributed: 3450000, joined_at: '2023-01-05' },
  { id: '3', full_name: 'Mas Andi Wijaya', username: 'andi_w', role: 'member', total_contributed: 3300000, joined_at: '2023-01-10' },
  { id: '4', full_name: 'Mbak Dewi Kusuma', username: 'dewi_k', role: 'member', total_contributed: 3150000, joined_at: '2023-02-01' },
  { id: '5', full_name: 'Pak Hendra Gunawan', username: 'hendra_g', role: 'member', total_contributed: 3000000, joined_at: '2023-02-15' },
];
const MOCK_TRANSACTIONS = [
  { id: '1', user_id: '2', full_name: 'Ibu Siti Rahayu', transaction_type: 'contribution', amount: 150000, description: 'Iuran Maret 2025', status: 'completed', created_at: '2025-03-05' },
  { id: '2', user_id: '1', full_name: 'Pak Budi Santoso', transaction_type: 'contribution', amount: 150000, description: 'Iuran Maret 2025', status: 'completed', created_at: '2025-03-04' },
  { id: '3', user_id: '3', full_name: 'Mas Andi Wijaya', transaction_type: 'distribution', amount: 3600000, description: 'Giliran Arisan Maret — Andi Wijaya', status: 'completed', created_at: '2025-03-10' },
  { id: '4', user_id: '4', full_name: 'Mbak Dewi Kusuma', transaction_type: 'contribution', amount: 150000, description: 'Iuran Februari 2025', status: 'completed', created_at: '2025-02-05' },
];

const ROLE_ICONS: Record<string, any> = { admin: Crown, treasurer: Shield, member: User };
const ROLE_COLORS: Record<string, string> = { admin: 'text-amber-400', treasurer: 'text-brand-400', member: 'text-slate-400' };
const TXN_TYPE_LABELS: Record<string, string> = { contribution: 'Iuran', withdrawal: 'Penarikan', distribution: 'Distribusi', loan: 'Pinjaman', repayment: 'Cicilan' };
const TXN_TYPE_COLORS: Record<string, string> = { contribution: 'badge-green', distribution: 'badge-yellow', withdrawal: 'badge-red', loan: 'badge-blue', repayment: 'badge-blue' };

export default function CommunityDetailPage() {
  const { id: communityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: community } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesAPI.get(communityId!),
    placeholderData: MOCK_DETAIL,
  });

  const { data: members } = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => communitiesAPI.members(communityId!),
    placeholderData: MOCK_MEMBERS,
  });

  const { data: txnsData } = useQuery({
    queryKey: ['community-transactions', communityId],
    queryFn: () => communitiesAPI.transactions(communityId!),
    placeholderData: { data: MOCK_TRANSACTIONS },
  });

  const comm = community || MOCK_DETAIL;
  const memberList = members || MOCK_MEMBERS;
  const txns = (txnsData?.data || MOCK_TRANSACTIONS);

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/communities')}
          className="w-9 h-9 rounded-xl glass flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-slate-100">{comm.name}</h1>
          <p className="text-slate-500 text-xs mt-0.5">{comm.description}</p>
        </div>
        {comm.my_role && (
          <button className="btn-primary"><Plus size={15} /> Kontribusi</button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Anggota', value: comm.member_count, icon: Users, color: 'text-brand-400 bg-brand-500/10' },
          { label: 'Dana Terkumpul', value: formatIDR(parseFloat(comm.total_funds || '12500000')), icon: Coins, color: 'text-emerald-400 bg-emerald-500/10' },
          { label: 'Peran Saya', value: comm.my_role ? (comm.my_role === 'admin' ? 'Admin' : comm.my_role === 'treasurer' ? 'Bendahara' : 'Anggota') : 'Bukan Anggota', icon: TrendingUp, color: 'text-amber-400 bg-amber-500/10' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon size={17} className={s.color.split(' ')[0]} />
            </div>
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className="text-slate-100 font-semibold text-sm">{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Members */}
        <div className="card">
          <h3 className="section-title text-base mb-4">Anggota ({memberList.length})</h3>
          <div className="space-y-2">
            {memberList.map((m: any, i: number) => {
              const RoleIcon = ROLE_ICONS[m.role] || User;
              return (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500/40 to-emerald-500/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {m.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{m.full_name}</p>
                    <p className="text-[10px] text-slate-500">@{m.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-emerald-400">{formatIDR(parseFloat(m.total_contributed))}</p>
                    <div className={`flex items-center gap-1 justify-end text-[10px] ${ROLE_COLORS[m.role]}`}>
                      <RoleIcon size={10} />
                      <span>{m.role === 'admin' ? 'Admin' : m.role === 'treasurer' ? 'Bendahara' : 'Anggota'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transactions */}
        <div className="card">
          <h3 className="section-title text-base mb-4">Riwayat Transaksi</h3>
          <div className="space-y-2">
            {txns.map((t: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${t.transaction_type === 'contribution' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  {t.transaction_type === 'contribution' ? <Coins size={14} /> : <TrendingUp size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{t.description}</p>
                  <p className="text-[10px] text-slate-500">{t.full_name} · {t.created_at ? format(parseISO(t.created_at), 'd MMM yyyy', { locale: id }) : ''}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-mono font-medium ${t.transaction_type === 'contribution' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {t.transaction_type === 'contribution' ? '+' : '-'}{formatIDR(parseFloat(t.amount))}
                  </p>
                  <span className={`badge text-[9px] ${TXN_TYPE_COLORS[t.transaction_type] || 'badge-blue'}`}>
                    {TXN_TYPE_LABELS[t.transaction_type] || t.transaction_type}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
