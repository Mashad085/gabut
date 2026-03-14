import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { budgetsAPI } from '@/lib/api';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import toast from 'react-hot-toast';

const fmt = (v: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const COLORS = ['#6366f1','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

function ProgressBar({ budgeted, spent }: { budgeted: number; spent: number }) {
  if (budgeted === 0) return null;
  const pct = Math.min((spent / budgeted) * 100, 100);
  const over = spent > budgeted;
  return (
    <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all duration-500 ${over?'bg-rose-500':pct>80?'bg-amber-500':'bg-emerald-500'}`}
        style={{ width: `${pct}%` }} />
    </div>
  );
}

function BudgetForm({ initial, month, onSave, loading }: { initial?: any; month: Date; onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    name:         initial?.name || format(month, 'MMMM yyyy', { locale: idLocale }),
    period_type:  initial?.period_type || 'monthly',
    period_start: initial?.period_start ? initial.period_start.slice(0,10) : format(startOfMonth(month), 'yyyy-MM-dd'),
    period_end:   initial?.period_end ? initial.period_end.slice(0,10) : format(endOfMonth(month), 'yyyy-MM-dd'),
    total_income: initial?.total_income || 0,
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <FormField label="Nama Anggaran" required>
        <input className="input-field w-full" value={form.name} onChange={e=>set('name',e.target.value)} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Mulai" required>
          <input type="date" className="input-field w-full" value={form.period_start} onChange={e=>set('period_start',e.target.value)} />
        </FormField>
        <FormField label="Selesai" required>
          <input type="date" className="input-field w-full" value={form.period_end} onChange={e=>set('period_end',e.target.value)} />
        </FormField>
      </div>
      <FormField label="Estimasi Pemasukan">
        <input type="number" className="input-field w-full" value={form.total_income||''} onChange={e=>set('total_income',parseFloat(e.target.value)||0)} min={0} placeholder="0" />
      </FormField>
      <button onClick={()=>onSave(form)} disabled={loading||!form.name} className="btn-primary w-full justify-center">
        {loading?'Menyimpan...':initial?'Simpan Perubahan':'Buat Anggaran'}
      </button>
    </div>
  );
}

function CategoryForm({ budgetId, initial, onSave, loading }: { budgetId: string; initial?: any; onSave: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    name:            initial?.name || '',
    budgeted_amount: initial?.budgeted_amount || 0,
    color:           initial?.color || COLORS[0],
    is_income:       initial?.is_income || false,
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <FormField label="Nama Kategori" required>
        <input className="input-field w-full" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="cth. Makanan, Tagihan" />
      </FormField>
      <FormField label="Anggaran" required>
        <input type="number" className="input-field w-full" value={form.budgeted_amount||''} onChange={e=>set('budgeted_amount',parseFloat(e.target.value)||0)} min={0} />
      </FormField>
      <FormField label="Warna">
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} onClick={()=>set('color',c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${form.color===c?'border-white scale-110':'border-transparent'}`}
              style={{ background: c }} />
          ))}
        </div>
      </FormField>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_income} onChange={e=>set('is_income',e.target.checked)} className="w-4 h-4 rounded" />
        <span className="text-sm text-slate-300">Ini adalah kategori pemasukan</span>
      </label>
      <button onClick={()=>onSave(form)} disabled={loading||!form.name} className="btn-primary w-full justify-center">
        {loading?'Menyimpan...':initial?'Simpan':'Tambah Kategori'}
      </button>
    </div>
  );
}

export default function BudgetPage() {
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [modal, setModal] = useState<'budget'|'editBudget'|'category'|'editCategory'|null>(null);
  const [activeBudget, setActiveBudget] = useState<any>(null);
  const [editingCat, setEditingCat] = useState<any>(null);

  const { data: budgets = [] } = useQuery({ queryKey: ['budgets'], queryFn: budgetsAPI.list });

  // Cari budget untuk bulan ini
  const monthKey = format(currentMonth, 'yyyy-MM');
  const currentBudget = budgets.find((b: any) => b.period_start?.slice(0,7) === monthKey);

  const { data: budgetDetail } = useQuery({
    queryKey: ['budget', currentBudget?.id],
    queryFn: () => budgetsAPI.get(currentBudget.id),
    enabled: !!currentBudget?.id,
  });

  const categories: any[] = budgetDetail?.categories || [];
  const expenses = categories.filter(c => !c.is_income);
  const incomes  = categories.filter(c => c.is_income);
  const totalBudgeted = expenses.reduce((s: number, c: any) => s + parseFloat(c.budgeted_amount||0), 0);
  const totalSpent    = expenses.reduce((s: number, c: any) => s + parseFloat(c.spent_amount||0), 0);

  const createBudget = useMutation({
    mutationFn: budgetsAPI.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); setModal(null); toast.success('Anggaran dibuat'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });
  const updateBudget = useMutation({
    mutationFn: ({ id, ...d }: any) => budgetsAPI.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); setModal(null); toast.success('Anggaran diperbarui'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });
  const deleteBudget = useMutation({
    mutationFn: budgetsAPI.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); qc.invalidateQueries({ queryKey: ['budget'] }); toast.success('Anggaran dihapus'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });
  const addCategory = useMutation({
    mutationFn: ({ budgetId, ...d }: any) => budgetsAPI.addCategory(budgetId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); setModal(null); toast.success('Kategori ditambahkan'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });
  const updateCategory = useMutation({
    mutationFn: ({ budgetId, catId, ...d }: any) => budgetsAPI.updateCategory(budgetId, catId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); setModal(null); toast.success('Kategori diperbarui'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });
  const deleteCategory = useMutation({
    mutationFn: ({ budgetId, catId }: any) => budgetsAPI.deleteCategory(budgetId, catId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); toast.success('Kategori dihapus'); },
    onError: (e: any) => toast.error(e.response?.data?.error||'Gagal'),
  });

  const renderCategoryRow = (cat: any) => {
    const budgeted = parseFloat(cat.budgeted_amount||0);
    const spent    = parseFloat(cat.spent_amount||0);
    const balance  = budgeted - spent;
    return (
      <motion.div key={cat.id} initial={{opacity:0}} animate={{opacity:1}}
        className="grid grid-cols-[1fr_auto_auto_auto_auto] sm:grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-2 px-4 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] group">
        <div className="flex items-center gap-2 pl-2 min-w-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color||'#6366f1' }} />
          <span className="text-sm text-slate-300 truncate">{cat.name}</span>
        </div>
        <div className="text-right font-mono text-xs text-slate-400 hidden sm:block">{fmt(budgeted)}</div>
        <div className="text-right font-mono text-xs text-slate-500 hidden sm:block">{fmt(spent)}</div>
        <div className={`text-right font-mono text-xs ${balance<0?'text-rose-400':balance===0?'text-slate-500':'text-emerald-400'}`}>
          {fmt(Math.abs(balance))}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={()=>{setEditingCat(cat);setActiveBudget(currentBudget);setModal('editCategory');}}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:text-slate-200">
            <Pencil size={11}/>
          </button>
          <button onClick={()=>{if(confirm('Hapus kategori?')) deleteCategory.mutate({budgetId:currentBudget.id,catId:cat.id});}}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:text-rose-400">
            <Trash2 size={11}/>
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Month nav */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-white/[0.05]">
        <button onClick={()=>setCurrentMonth(m=>subMonths(m,1))} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400">
          <ChevronLeft size={16}/>
        </button>
        <span className="font-display font-semibold text-slate-200 flex-1 text-center text-sm sm:text-base">
          {format(currentMonth, 'MMMM yyyy', { locale: idLocale })}
        </span>
        <button onClick={()=>setCurrentMonth(m=>addMonths(m,1))} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400">
          <ChevronRight size={16}/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {!currentBudget ? (
          <div className="card text-center py-12">
            <Wallet size={32} className="text-slate-600 mx-auto mb-3"/>
            <p className="text-slate-400 text-sm mb-1">Belum ada anggaran untuk {format(currentMonth,'MMMM yyyy',{locale:idLocale})}</p>
            <button onClick={()=>setModal('budget')} className="btn-primary mt-4 mx-auto">Buat Anggaran</button>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="card bg-gradient-to-br from-brand-900/40 to-brand-950/40 border-brand-800/30">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Anggaran</p>
                  <p className="font-display text-lg font-bold text-slate-100">{currentBudget.name}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>setModal('budget')} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.08]">
                    <Pencil size={13}/>
                  </button>
                  <button onClick={()=>{if(confirm('Hapus anggaran ini?')) deleteBudget.mutate(currentBudget.id);}}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">Dianggarkan</p>
                  <p className="font-mono text-sm font-semibold text-slate-200">{fmt(totalBudgeted)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">Digunakan</p>
                  <p className="font-mono text-sm font-semibold text-rose-400">{fmt(totalSpent)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">Sisa</p>
                  <p className={`font-mono text-sm font-semibold ${totalBudgeted-totalSpent>=0?'text-emerald-400':'text-rose-400'}`}>
                    {fmt(Math.abs(totalBudgeted-totalSpent))}
                  </p>
                </div>
              </div>
              {totalBudgeted > 0 && (
                <div className="mt-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${totalSpent>totalBudgeted?'bg-rose-500':'bg-emerald-500'}`}
                    style={{ width:`${Math.min((totalSpent/totalBudgeted)*100,100)}%` }} />
                </div>
              )}
            </div>

            {/* Pengeluaran */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                <p className="font-semibold text-sm text-slate-200">Pengeluaran</p>
                <button onClick={()=>{setActiveBudget(currentBudget);setModal('category');}} className="btn-secondary text-xs px-2.5 py-1.5">
                  <Plus size={12}/> Kategori
                </button>
              </div>
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] sm:grid-cols-[2fr_1fr_1fr_1fr_auto] px-4 py-2 border-b border-white/[0.04]">
                <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">Kategori</span>
                <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider text-right hidden sm:block">Anggaran</span>
                <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider text-right hidden sm:block">Digunakan</span>
                <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider text-right">Sisa</span>
                <span/>
              </div>
              {expenses.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-6">Belum ada kategori</p>
              ) : expenses.map(renderCategoryRow)}
            </div>

            {/* Pemasukan */}
            {incomes.length > 0 && (
              <div className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                  <p className="font-semibold text-sm text-slate-200">Pemasukan</p>
                </div>
                {incomes.map(renderCategoryRow)}
              </div>
            )}
          </>
        )}

        {budgets.length > 0 && !currentBudget && (
          <div className="card">
            <p className="text-xs text-slate-500 mb-2">Anggaran lainnya</p>
            <div className="space-y-2">
              {budgets.slice(0,5).map((b: any) => (
                <button key={b.id} onClick={()=>setCurrentMonth(startOfMonth(new Date(b.period_start)))}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.05] text-left transition-colors">
                  <span className="text-sm text-slate-300">{b.name}</span>
                  <span className="text-xs text-slate-500">{format(new Date(b.period_start),'MMM yyyy',{locale:idLocale})}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FAB add budget */}
      {!currentBudget && (
        <button onClick={()=>setModal('budget')}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-12 h-12 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white shadow-lg flex items-center justify-center transition-all active:scale-95 z-30">
          <Plus size={22}/>
        </button>
      )}

      <Modal open={modal==='budget'||modal==='editBudget'} onClose={()=>setModal(null)} title={currentBudget&&modal==='budget'?'Edit Anggaran':'Buat Anggaran'} size="md">
        <BudgetForm month={currentMonth} initial={modal==='budget'&&currentBudget?currentBudget:undefined}
          onSave={d => currentBudget && modal==='budget' ? updateBudget.mutate({id:currentBudget.id,...d}) : createBudget.mutate(d)}
          loading={createBudget.isPending||updateBudget.isPending} />
      </Modal>
      <Modal open={modal==='category'} onClose={()=>setModal(null)} title="Tambah Kategori">
        <CategoryForm budgetId={activeBudget?.id} onSave={d=>addCategory.mutate({budgetId:activeBudget?.id,...d})} loading={addCategory.isPending} />
      </Modal>
      <Modal open={modal==='editCategory'} onClose={()=>setModal(null)} title="Edit Kategori">
        {editingCat && <CategoryForm budgetId={activeBudget?.id} initial={editingCat}
          onSave={d=>updateCategory.mutate({budgetId:activeBudget?.id,catId:editingCat.id,...d})} loading={updateCategory.isPending} />}
      </Modal>
    </div>
  );
}
