'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getDebts, addDebt, settleDebt, deleteDebt } from '@/services/firestore';
import { ChevronRight, Plus, MessageCircle, Check, Trash2, Bell, X, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { Debt } from '@/types';

type Filter = 'all' | 'to-me' | 'from-me' | 'settled';

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
  return Math.round(diff / 86400000);
}

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('');
}

function buildWhatsAppMsg(debt: Debt): string {
  const dir = debt.direction === 'to-me'
    ? `تذكير ودي: لديك مبلغ ${fmt(debt.amount)} د.ع بذمتك لي`
    : `تذكير: لديّ مبلغ ${fmt(debt.amount)} د.ع بذمتي لك`;
  const reason = debt.reason ? ` (${debt.reason})` : '';
  const due = debt.dueDate ? `\nموعد الاستحقاق: ${new Date(debt.dueDate).toLocaleDateString('ar-IQ')}` : '';
  return encodeURIComponent(`${dir}${reason}.${due}`);
}

function openWhatsApp(debt: Debt) {
  const phone = debt.phone?.replace(/\D/g, '');
  const msg = buildWhatsAppMsg(debt);
  const url = phone
    ? `https://wa.me/${phone}?text=${msg}`
    : `https://wa.me/?text=${msg}`;
  window.open(url, '_blank');
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
];

function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ── Add Sheet ──────────────────────────────────────────────────
function AddSheet({ onClose, onSave }: { onClose: () => void; onSave: (data: Omit<Debt,'id'|'uid'|'createdAt'>) => void }) {
  const [direction, setDirection] = useState<'to-me' | 'from-me'>('to-me');
  const [name, setName]       = useState('');
  const [amount, setAmount]   = useState('');
  const [reason, setReason]   = useState('');
  const [dueDate, setDueDate] = useState('');
  const [phone, setPhone]     = useState('');
  const [showPhone, setShowPhone] = useState(false);

  function handleSave() {
    if (!name.trim() || !amount) return;
    onSave({
      name: name.trim(),
      amount: parseFloat(amount.replace(/,/g, '')),
      direction,
      reason: reason.trim() || undefined,
      date: new Date().toISOString().split('T')[0],
      dueDate: dueDate || undefined,
      phone: phone.trim() || undefined,
      isSettled: false,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-background rounded-t-3xl border-t border-border px-5 pt-4 pb-8 z-10">

        {/* handle */}
        <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">إضافة دين جديد</h2>
          <button onClick={onClose} className="text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* اتجاه الدين */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setDirection('to-me')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              direction === 'to-me'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                : 'bg-muted text-muted-foreground border border-transparent'
            }`}>
            ↙ لي
          </button>
          <button onClick={() => setDirection('from-me')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              direction === 'from-me'
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
                : 'bg-muted text-muted-foreground border border-transparent'
            }`}>
            ↗ علي
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">اسم الشخص *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="مثال: أحمد محمد"
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-right outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">المبلغ (د.ع) *</label>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              type="number" inputMode="numeric" placeholder="0"
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-right outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">السبب (اختياري)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="مثال: إيجار، سلفة، فاتورة..."
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-right outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">تاريخ الاستحقاق (اختياري)</label>
            <input value={dueDate} onChange={e => setDueDate(e.target.value)}
              type="date"
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </div>

          {/* واتساب */}
          <button onClick={() => setShowPhone(p => !p)}
            className="flex items-center gap-2 text-xs text-primary py-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {showPhone ? 'إخفاء رقم الواتساب' : 'إضافة رقم واتساب للتذكير'}
            <ChevronDown className={`h-3 w-3 transition-transform ${showPhone ? 'rotate-180' : ''}`} />
          </button>

          {showPhone && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">رقم الواتساب (مع رمز الدولة)</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                type="tel" placeholder="9647701234567"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" dir="ltr" />
              <p className="text-[10px] text-muted-foreground mt-1">مثال: 9647701234567 (بدون + في البداية)</p>
            </div>
          )}
        </div>

        <button onClick={handleSave}
          disabled={!name.trim() || !amount}
          className="mt-5 w-full py-3 bg-primary text-primary-foreground rounded-2xl font-semibold text-sm disabled:opacity-40 transition-opacity">
          حفظ الدين
        </button>
      </div>
    </div>
  );
}

// ── Debt Card ──────────────────────────────────────────────────
function DebtCard({ debt, onSettle, onDelete }: {
  debt: Debt;
  onSettle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const days = debt.dueDate ? daysUntil(debt.dueDate) : null;
  const isOverdue = days !== null && days < 0;
  const isDueSoon = days !== null && days >= 0 && days <= 7;
  const isToMe    = debt.direction === 'to-me';

  let dueBorderClass = 'border-border';
  if (isOverdue)  dueBorderClass = 'border-red-300 dark:border-red-700';
  else if (isDueSoon) dueBorderClass = 'border-amber-300 dark:border-amber-700';

  let dueTextClass = 'text-muted-foreground';
  if (isOverdue)  dueTextClass = 'text-red-600 dark:text-red-400';
  else if (isDueSoon) dueTextClass = 'text-amber-600 dark:text-amber-400';

  function dueDateLabel() {
    if (!debt.dueDate) return null;
    if (isOverdue)  return `متأخر ${Math.abs(days!)} يوم`;
    if (days === 0) return 'اليوم';
    if (days === 1) return 'غداً';
    if (isDueSoon)  return `بعد ${days} أيام`;
    return new Date(debt.dueDate).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' });
  }

  if (debt.isSettled) {
    return (
      <div className="bg-muted/30 border border-border rounded-2xl px-4 py-3 flex items-center justify-between opacity-60">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(debt.name)}`}>
            {initials(debt.name)}
          </div>
          <div>
            <p className="text-sm text-muted-foreground line-through">{debt.name}</p>
            <p className="text-[10px] text-muted-foreground">تمّت التسوية</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{fmt(debt.amount)} د.ع</span>
          <Check className="h-4 w-4 text-emerald-500" />
          <button onClick={() => onDelete(debt.id)} className="text-muted-foreground/50 hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-2xl px-4 py-3 ${dueBorderClass}`}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(debt.name)}`}>
            {initials(debt.name)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{debt.name}</p>
            {debt.reason && <p className="text-[11px] text-muted-foreground">{debt.reason}</p>}
          </div>
        </div>
        <div className="text-left">
          <p className={`text-base font-bold ${isToMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {isToMe ? '+' : '-'}{fmt(debt.amount)}
          </p>
          <p className="text-[10px] text-muted-foreground">{isToMe ? 'لي' : 'علي'} · د.ع</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* موعد الاستحقاق */}
        <div className="flex items-center gap-1.5">
          {debt.dueDate ? (
            <>
              <Bell className={`h-3 w-3 ${dueTextClass}`} />
              <span className={`text-[11px] font-medium ${dueTextClass}`}>{dueDateLabel()}</span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">بدون موعد</span>
          )}
        </div>

        {/* أزرار */}
        <div className="flex items-center gap-2">
          {debt.phone && (
            <button onClick={() => openWhatsApp(debt)}
              className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2 py-1.5 active:scale-95 transition-transform">
              <MessageCircle className="h-3 w-3" />
              واتساب
            </button>
          )}
          <button onClick={() => onSettle(debt.id)}
            className={`flex items-center gap-1 text-[11px] rounded-lg px-2 py-1.5 active:scale-95 transition-transform ${
              isToMe
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800'
                : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
            }`}>
            <Check className="h-3 w-3" />
            {isToMe ? 'استحصلت' : 'سدّدت'}
          </button>
          <button onClick={() => onDelete(debt.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors p-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function DebtsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter]     = useState<Filter>('all');
  const [showAdd, setShowAdd]   = useState(false);

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts', user?.uid],
    queryFn: () => getDebts(user!.uid),
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<Debt,'id'|'uid'|'createdAt'>) => addDebt(user!.uid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts', user?.uid] }); setShowAdd(false); },
  });

  const settleMutation = useMutation({
    mutationFn: (id: string) => settleDebt(user!.uid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts', user?.uid] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDebt(user!.uid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts', user?.uid] }),
  });

  const active   = debts.filter(d => !d.isSettled);
  const toMe     = active.filter(d => d.direction === 'to-me');
  const fromMe   = active.filter(d => d.direction === 'from-me');
  const settled  = debts.filter(d => d.isSettled);

  const totalToMe   = toMe.reduce((s, d) => s + d.amount, 0);
  const totalFromMe = fromMe.reduce((s, d) => s + d.amount, 0);
  const netBalance  = totalToMe - totalFromMe;

  // تنبيهات الاستحقاق القريب
  const urgentDebts = active.filter(d => {
    if (!d.dueDate) return false;
    const days = daysUntil(d.dueDate);
    return days <= 3 && days >= -30;
  });

  const filtered = useMemo(() => {
    if (filter === 'to-me')   return toMe;
    if (filter === 'from-me') return fromMe;
    if (filter === 'settled') return settled;
    return [...active.sort((a,b) => {
      // الديون المستحقة قريباً أولاً
      const da = a.dueDate ? daysUntil(a.dueDate) : 9999;
      const db = b.dueDate ? daysUntil(b.dueDate) : 9999;
      return da - db;
    }), ...settled];
  }, [filter, debts]);

  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: 'all',      label: 'الكل',    count: active.length },
    { key: 'to-me',   label: 'لي',      count: toMe.length },
    { key: 'from-me', label: 'علي',     count: fromMe.length },
    { key: 'settled', label: 'مسدّدة',  count: settled.length },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-3 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">مدير الديون</h1>
          <p className="text-[11px] text-muted-foreground">تتبّع ما لك وما عليك</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform">
          <Plus className="h-3.5 w-3.5" />
          إضافة
        </button>
      </div>

      {/* ── ملخص ── */}
      <div className="grid grid-cols-3 gap-2 px-1 mb-3 shrink-0">
        <div className="bg-card border border-border rounded-2xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">صافي وضعك</p>
          <p className={`text-base font-bold ${netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {netBalance >= 0 ? '+' : ''}{fmt(netBalance)}
          </p>
          <p className="text-[10px] text-muted-foreground">د.ع</p>
        </div>
        <div className="bg-card border border-border rounded-2xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">لي</p>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalToMe)}</p>
          <p className="text-[10px] text-muted-foreground">د.ع</p>
        </div>
        <div className="bg-card border border-border rounded-2xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">علي</p>
          <p className="text-base font-bold text-red-600 dark:text-red-400">{fmt(totalFromMe)}</p>
          <p className="text-[10px] text-muted-foreground">د.ع</p>
        </div>
      </div>

      {/* ── تنبيه استحقاق ── */}
      {urgentDebts.length > 0 && (
        <div className="mx-1 mb-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5 shrink-0">
          {urgentDebts.map(d => {
            const days = daysUntil(d.dueDate!);
            const label = days < 0 ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? 'اليوم' : `بعد ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
            return (
              <div key={d.id} className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {d.direction === 'from-me' ? `دين علي لـ` : `دين لك من`} <span className="font-semibold">{d.name}</span> — {label}
                  {d.phone && (
                    <button onClick={() => openWhatsApp(d)} className="mr-2 underline text-emerald-600 dark:text-emerald-400">
                      إرسال واتساب
                    </button>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── فلترة ── */}
      <div className="flex gap-1.5 px-1 mb-2 shrink-0">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground'
            }`}>
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`mr-1 text-[10px] ${filter === f.key ? 'opacity-70' : 'text-muted-foreground/60'}`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── قائمة الديون ── */}
      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-2">
        {isLoading && (
          <div className="flex flex-col gap-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl" />)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-4xl mb-3">🤝</p>
            <p className="text-sm text-muted-foreground">
              {filter === 'settled' ? 'لا توجد ديون مسوّاة بعد' : 'لا توجد ديون مسجّلة'}
            </p>
            {filter === 'all' && (
              <button onClick={() => setShowAdd(true)}
                className="mt-3 text-xs text-primary border border-primary/30 rounded-xl px-4 py-2">
                سجّل أول دين
              </button>
            )}
          </div>
        )}

        {filtered.map(debt => (
          <DebtCard
            key={debt.id}
            debt={debt}
            onSettle={id => settleMutation.mutate(id)}
            onDelete={id => deleteMutation.mutate(id)}
          />
        ))}
      </div>

      {/* ── Sheet الإضافة ── */}
      {showAdd && (
        <AddSheet
          onClose={() => setShowAdd(false)}
          onSave={data => addMutation.mutate(data)}
        />
      )}
    </div>
  );
}
