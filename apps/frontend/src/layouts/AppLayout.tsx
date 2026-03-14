import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Wallet, ArrowRightLeft, BarChart3,
  Users, Calendar, Bell, Settings, LogOut, ChevronLeft,
  ChevronRight, CreditCard, Coins, Menu, X, Shield
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { notificationsAPI } from '@/lib/api';
import { authAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const financeNav = [
  { label: 'Dashboard',   icon: LayoutDashboard, to: '/' },
  { label: 'Anggaran',    icon: Wallet,           to: '/budget' },
  { label: 'Rekening',    icon: CreditCard,       to: '/accounts' },
  { label: 'Transaksi',   icon: ArrowRightLeft,   to: '/transactions' },
  { label: 'Laporan',     icon: BarChart3,        to: '/reports' },
];
const communityNav = [
  { label: 'Komunitas',   icon: Users,    to: '/communities' },
  { label: 'Dompet KOIN', icon: Coins,    to: '/wallet' },
  { label: 'Jadwal',      icon: Calendar, to: '/schedules' },
];
const bottomNav = [
  { label: 'Notifikasi',  icon: Bell,     to: '/notifications' },
  { label: 'Pengaturan',  icon: Settings, to: '/settings' },
];

// Mobile bottom bar — 5 tab utama
const mobileBottomTabs = [
  { label: 'Home',      icon: LayoutDashboard, to: '/' },
  { label: 'Rekening',  icon: CreditCard,      to: '/accounts' },
  { label: 'Transaksi', icon: ArrowRightLeft,  to: '/transactions' },
  { label: 'Komunitas', icon: Users,           to: '/communities' },
  { label: 'Notif',     icon: Bell,            to: '/notifications', badge: true },
];

function NavItem({ item, collapsed }: { item: any; collapsed: boolean }) {
  return (
    <NavLink to={item.to} end={item.to === '/'}
      className={({ isActive }) => clsx('nav-item group', isActive && 'active')}>
      <item.icon size={18} className="shrink-0" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span initial={{ opacity:0, width:0 }} animate={{ opacity:1, width:'auto' }}
            exit={{ opacity:0, width:0 }} transition={{ duration:0.2 }}
            className="overflow-hidden whitespace-nowrap">
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

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.list({ limit: 1 }),
    refetchInterval: 60_000,
  });
  const unreadCount: number = notifData?.unread_count || 0;

  const handleLogout = async () => {
    try { if (refreshToken) await authAPI.logout(refreshToken); } catch {}
    logout();
    navigate('/auth/login');
    toast.success('Berhasil keluar');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow shrink-0">
          <Shield size={16} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}>
              <p className="font-display font-bold text-sm text-slate-100 leading-none">CommunityFinance</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Platform Keuangan</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {!collapsed && <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Keuangan</p>}
        {financeNav.map(item => <NavItem key={item.to} item={item} collapsed={collapsed} />)}

        <div className="my-3 border-t border-white/[0.05]" />

        {!collapsed && <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Komunitas</p>}
        {communityNav.map(item => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
      </div>

      <div className="border-t border-white/[0.06] p-2 space-y-0.5">
        {/* Notifications with badge */}
        <NavLink to="/notifications" end
          className={({ isActive }) => clsx('nav-item group relative', isActive && 'active')}>
          <Bell size={18} className="shrink-0" />
          {unreadCount > 0 && (
            <span className="absolute left-5 top-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity:0, width:0 }} animate={{ opacity:1, width:'auto' }}
                exit={{ opacity:0, width:0 }} transition={{ duration:0.2 }}
                className="overflow-hidden whitespace-nowrap">
                Notifikasi
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>
        <NavItem item={{ label:'Pengaturan', icon:Settings, to:'/settings' }} collapsed={collapsed} />

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl hover:bg-white/[0.04] cursor-pointer group transition-all">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{user?.full_name}</p>
                <p className="text-[10px] text-slate-600 truncate capitalize">{user?.role}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={handleLogout}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-rose-400 shrink-0">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.aside animate={{ width: collapsed ? 72 : 260 }} transition={{ duration:0.25, ease:'easeInOut' }}
        className="hidden lg:flex flex-col glass border-r border-white/[0.06] relative shrink-0 overflow-hidden">
        <SidebarContent />
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full glass border border-white/[0.15] flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors z-10 shadow-lg">
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" />
            <motion.aside initial={{ x:-280 }} animate={{ x:0 }} exit={{ x:-280 }}
              transition={{ type:'spring', damping:25, stiffness:300 }}
              className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/[0.06] z-50 lg:hidden">
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] glass shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-slate-100">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Shield size={11} className="text-white" />
            </div>
            <span className="font-display font-bold text-sm">CommunityFinance</span>
          </div>
          <NavLink to="/notifications" className="relative text-slate-400 hover:text-slate-100">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.2 }} className="h-full">
            <Outlet />
          </motion.div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/[0.06] z-30 flex items-center justify-around px-2 py-1 safe-area-bottom">
          {mobileBottomTabs.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.to === '/'}
              className={({ isActive }) =>
                clsx('flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all relative',
                  isActive ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300')
              }>
              {({ isActive }) => (
                <>
                  <tab.icon size={20} className={isActive ? 'scale-110' : ''} />
                  <span className="text-[9px] font-medium">{tab.label}</span>
                  {tab.badge && unreadCount > 0 && (
                    <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-rose-500 text-[8px] font-bold text-white flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
