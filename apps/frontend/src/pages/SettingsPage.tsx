import { motion } from 'framer-motion';
import { Bell, Shield, User, CreditCard, Globe, Moon, ChevronRight } from 'lucide-react';

export default function SettingsPage() {
  const sections = [
    { icon: User, label: 'Profil & Akun', desc: 'Kelola informasi pribadi Anda', color: 'text-brand-400 bg-brand-500/10' },
    { icon: Shield, label: 'Keamanan', desc: 'Password, 2FA, dan sesi aktif', color: 'text-emerald-400 bg-emerald-500/10' },
    { icon: Bell, label: 'Notifikasi', desc: 'Atur preferensi notifikasi', color: 'text-amber-400 bg-amber-500/10' },
    { icon: CreditCard, label: 'Rekening & Pembayaran', desc: 'Kelola metode pembayaran', color: 'text-cyan-400 bg-cyan-500/10' },
    { icon: Globe, label: 'Bahasa & Regional', desc: 'Bahasa, mata uang, timezone', color: 'text-rose-400 bg-rose-500/10' },
    { icon: Moon, label: 'Tampilan', desc: 'Tema dan preferensi visual', color: 'text-violet-400 bg-violet-500/10' },
  ];

  return (
    <div className="p-5 lg:p-7 max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-bold text-slate-100 mb-6">Pengaturan</h1>
      {sections.map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="card hover:bg-white/[0.07] cursor-pointer transition-all flex items-center gap-4"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
            <s.icon size={18} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-slate-200 text-sm">{s.label}</p>
            <p className="text-xs text-slate-500">{s.desc}</p>
          </div>
          <ChevronRight size={16} className="text-slate-500" />
        </motion.div>
      ))}
    </div>
  );
}
