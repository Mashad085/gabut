import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel - decorative */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-surface-950 items-center justify-center p-12">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
                <Shield size={24} className="text-white" />
              </div>
              <div>
                <p className="font-display font-bold text-xl text-white">CommunityFinance</p>
                <p className="text-sm text-brand-300">Platform Keuangan Komunitas</p>
              </div>
            </div>

            <h1 className="font-display text-4xl font-bold text-white leading-tight mb-6">
              Kelola Keuangan<br />
              <span className="text-brand-400">Bersama Komunitas</span>
            </h1>

            <p className="text-slate-400 text-base leading-relaxed mb-10">
              Platform all-in-one untuk mengelola keuangan pribadi, rekening bersama,
              arisan, koperasi, dan investasi komunitas dengan keamanan tingkat enterprise.
            </p>

            {/* Feature list */}
            {[
              'Perbankan komunitas & rekening bersama',
              'Manajemen arisan & koperasi digital',
              'Laporan keuangan real-time',
              'Keamanan 2FA & enkripsi end-to-end',
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-3 mb-3"
              >
                <div className="w-5 h-5 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                </div>
                <p className="text-slate-300 text-sm">{feature}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right panel - auth form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
