import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Wallet, ArrowRightLeft, BarChart3,
  Users, Calendar, Bell, Settings, LogOut, ChevronLeft,
  ChevronRight, CreditCard, TrendingUp, Menu, X, Shield
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Anggaran', icon: Wallet, to: '/budget' },
  { label: 'Rekening', icon: CreditCard, to: '/accounts' },
  { label: 'Transaksi', icon: ArrowRightLeft, to: '/transactions' },
  { label: 'Laporan', icon: BarChart3, to: '/reports' },
  { label: 'Investasi', icon: TrendingUp, to: '/investment' },
];

const communityItems = [
  { label: 'Komunitas', icon: Users, to: '/communities' },
  { label: 'Jadwal', icon: Calendar, to: '/schedules' },
];

const bottomItems = [
  { label: 'Notifikasi', icon: Bell, to: '/notifications' },
  { label: 'Pengaturan', icon: Settings, to: '/settings' },
];

function NavItem({ item, collapsed }: { item: any; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        clsx('nav-item group', isActive && 'active')
      }
    >
      <item.icon size={18} className="shrink-0" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </NavLink>
  );
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (refreshToken) await authAPI.logout(refreshToken);
    } catch {}
    logout();
    navigate('/auth/login');
    toast.success('Berhasil keluar');
  };

  const sidebarWidth = collapsed ? 72 : 260;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow shrink-0">
          <Shield size={16} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <p className="font-display font-bold text-sm text-slate-100 leading-none">CommunityFinance</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Platform Keuangan</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Keuangan</p>
        )}
        {navItems.map(item => <NavItem key={item.to} item={item} collapsed={collapsed} />)}

        <div className="my-3 border-t border-white/[0.05]" />

        {!collapsed && (
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Komunitas</p>
        )}
        {communityItems.map(item => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
      </div>

      {/* Bottom */}
      <div className="border-t border-white/[0.06] p-2 space-y-0.5">
        {bottomItems.map(item => <NavItem key={item.to} item={item} collapsed={collapsed} />)}

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl hover:bg-white/[0.04] cursor-pointer group transition-all">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-medium text-slate-300 truncate">{user?.full_name}</p>
                <p className="text-[10px] text-slate-600 truncate">{user?.role}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleLogout}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-rose-400 shrink-0"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col glass border-r border-white/[0.06] relative shrink-0 overflow-hidden"
      >
        <SidebarContent />

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full glass border border-white/[0.15] flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors z-10 shadow-lg"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/[0.06] z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] glass">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-slate-100">
            <Menu size={20} />
          </button>
          <span className="font-display font-bold text-sm">CommunityFinance</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
