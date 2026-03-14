import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Trash2, BellOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { notificationsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const TYPE_COLOR: Record<string,string> = {
  transaction:'text-emerald-400 bg-emerald-500/10',
  community:'text-brand-400 bg-brand-500/10',
  system:'text-amber-400 bg-amber-500/10',
  alert:'text-rose-400 bg-rose-500/10',
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.list({ limit: 50 }),
  });
  const notifications: any[] = data?.data || [];
  const unreadCount: number = data?.unread_count || 0;

  const readMut = useMutation({
    mutationFn: notificationsAPI.read,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAllMut = useMutation({
    mutationFn: notificationsAPI.readAll,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast.success('Semua ditandai dibaca'); },
  });
  const deleteMut = useMutation({
    mutationFn: notificationsAPI.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="p-4 sm:p-5 lg:p-7 space-y-5 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">Notifikasi</h1>
          {unreadCount > 0 && <p className="text-xs text-slate-500 mt-0.5">{unreadCount} belum dibaca</p>}
        </div>
        {unreadCount > 0 && (
          <button onClick={()=>readAllMut.mutate()} disabled={readAllMut.isPending} className="btn-secondary text-xs px-3 py-2">
            <CheckCheck size={13}/> Tandai Semua Dibaca
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="card animate-pulse h-16"/>)}</div>
      ) : notifications.length === 0 ? (
        <div className="card text-center py-16">
          <BellOff size={32} className="text-slate-600 mx-auto mb-3"/>
          <p className="text-slate-400 text-sm">Tidak ada notifikasi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any, i: number) => {
            const colorClass = TYPE_COLOR[n.type] || TYPE_COLOR.system;
            return (
              <motion.div key={n.id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.03}}
                className={`card flex items-start gap-3 group transition-all cursor-pointer ${!n.is_read?'border-brand-800/40 bg-brand-950/20':''}`}
                onClick={()=>{ if(!n.is_read) readMut.mutate(n.id); }}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                  <Bell size={14}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium truncate ${n.is_read?'text-slate-400':'text-slate-200'}`}>{n.title}</p>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-brand-400 shrink-0 mt-1.5"/>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {n.created_at ? format(parseISO(n.created_at), 'd MMM yyyy, HH:mm', { locale: idLocale }) : ''}
                  </p>
                </div>
                <button onClick={e=>{e.stopPropagation();deleteMut.mutate(n.id);}}
                  className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0">
                  <Trash2 size={13}/>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
