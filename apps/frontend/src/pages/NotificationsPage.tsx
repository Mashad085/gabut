import { motion } from 'framer-motion';
import { Bell, CheckCheck, ArrowUpRight, Shield, Users, AlertCircle } from 'lucide-react';

const NOTIFS = [
  { id: 1, type: 'transaction', icon: ArrowUpRight, color: 'text-emerald-400 bg-emerald-500/10', title: 'Transfer Diterima', message: 'Anda menerima transfer Rp 500.000 dari Budi Santoso', time: '2 menit lalu', read: false },
  { id: 2, type: 'community', icon: Users, color: 'text-brand-400 bg-brand-500/10', title: 'Anggota Baru', message: 'Siti Rahayu bergabung ke Arisan RT 05', time: '1 jam lalu', read: false },
  { id: 3, type: 'security', icon: Shield, color: 'text-amber-400 bg-amber-500/10', title: 'Login Baru Terdeteksi', message: 'Login dari perangkat baru di Jakarta', time: '3 jam lalu', read: true },
  { id: 4, type: 'system', icon: Bell, color: 'text-slate-400 bg-slate-500/10', title: 'Pengingat Tagihan', message: 'Tagihan listrik PLN jatuh tempo dalam 3 hari', time: '5 jam lalu', read: true },
  { id: 5, type: 'transaction', icon: ArrowUpRight, color: 'text-rose-400 bg-rose-500/10', title: 'Transaksi Diproses', message: 'Pembayaran Rp 280.000 ke PLN berhasil', time: '1 hari lalu', read: true },
  { id: 6, type: 'community', icon: AlertCircle, color: 'text-amber-400 bg-amber-500/10', title: 'Kontribusi Menunggu', message: 'Kontribusi arisan Anda untuk bulan ini belum dibayar', time: '2 hari lalu', read: true },
];

export default function NotificationsPage() {
  const unread = NOTIFS.filter(n => !n.read).length;

  return (
    <div className="p-5 lg:p-7 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Notifikasi</h1>
          {unread > 0 && <p className="text-xs text-brand-400 mt-0.5">{unread} notifikasi belum dibaca</p>}
        </div>
        <button className="btn-secondary"><CheckCheck size={14} /> Tandai Semua Dibaca</button>
      </div>

      <div className="space-y-2">
        {NOTIFS.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`card flex items-start gap-4 cursor-pointer hover:bg-white/[0.07] transition-all ${!n.read ? 'border-brand-500/20' : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.color}`}>
              <n.icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-medium ${n.read ? 'text-slate-300' : 'text-slate-100'}`}>{n.title}</p>
                <span className="text-[10px] text-slate-600 whitespace-nowrap">{n.time}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
            </div>
            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0 mt-1.5" />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
