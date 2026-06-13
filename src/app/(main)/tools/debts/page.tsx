'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getDebts, addDebt, settleDebt, unsettleDebt, deleteDebt } from '@/services/firestore';
import { ChevronRight, Plus, MessageCircle, Check, Trash2, Bell, X, ChevronDown, AlertTriangle } from 'lucide-react';
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
  const due = debt.dueDate
    ? `\nموعد الاستحقاق: ${new Date(debt.dueDate).toLocaleDateString('ar-IQ')}`
    : '';
  return encodeURIComponent(`${dir}${reason}.${due}`);
}

function openWhatsApp(debt: Debt) {
  const phone = debt.phone?.replace(/\D/g, '');
  const msg   = buildWhatsAppMsg(debt);
  window.open(phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Add Sheet ──────────────────────────────────────────────────
function AddSheet({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: Omit<Debt,'id'|'uid'|'createdAt'>) => void;
}) {
  const [direction, setDirection] = useState<'to-me' | 'from-me'>('to-me');
  const [name,    setName]    = useState('');
  const [amount,  setAmount]  = useState('');
  const [reason,  setReason]  = useState('');
  const [dueDate, setDueDate] = useState('');
  const [phone,   setPhone]   = useState('');
  const [showPhone, setShowPhone] = useState(false);

  function handleSave() {
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (!name.trim() || !parsed) return;
    onSave({
      name: name.trim(),
      amount: parsed,
      direction,
      reason:  reason.trim() || undefined,
      date:    new Date().toISOString().split('T')[0],
      dueDate: dueDate || undefined,
      phone:   phone.trim() || undefined,
      isSettled: false,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end pb-16">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-background rounded-t-3xl border-t border-border z-10
                      flex flex-col max-h-[80dvh]">

        {/* handle + header — ثابتان */}
        <div className="shrink-0 px-5 pt-3 pb-2">
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">إضافة دين جديد</h2>
            <button onClick={onClose} className="text-muted-foreground p-1"><X className="h-5 w-5" /></button>
          </div>

          {/* اتجاه الدين */}
          <div className="flex gap-2 mb-1">
            <button onClick={() => setDirection('to-me')}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                direction === 'to-me'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-muted text-muted-foreground'
              }`}>
              ↙ أقرضت (لي)
            </button>
            <button onClick={() => setDirection('from-me')}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                direction === 'from-me'
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
                  : 'bg-muted text-muted-foreground'
              }`}>
              ↗ اقترضت (علي)
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mb-2">
            {direction === 'to-me'
              ? 'سلّفت شخصاً — هو مدين لك'
              : 'شخص سلّفك — أنت مدين له'}
          </p>
        </div>

        {/* حقول الإدخال — قابلة للتمرير */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          <div className="flex flex-col gap-3">

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {direction === 'to-me' ? 'اسم الشخص المدين *' : 'اسم الشخص الدائن *'}
              </label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="مثال: أحمد محمد"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">المبلغ (د.ع) *</label>
              <input
                value={amount ? parseInt(amount.replace(/,/g,'')||'0').toLocaleString('en-US') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/,/g,'').replace(/[^\d]/g,'');
                  setAmount(raw);
                }}
                inputMode="numeric" placeholder="أدخل المبلغ"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">السبب (اختياري)</label>
              <input value={reason} onChange={e => setReason(e.target.value)}
                placeholder="مثال: إيجار، سلفة، شراء..."
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">تاريخ الاستحقاق (اختياري)</label>
              <input value={dueDate} onChange={e => setDueDate(e.target.value)}
                type="date"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary" />
            </div>

            {/* واتساب */}
            <button onClick={() => setShowPhone(p => !p)}
              className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 py-1">
              <MessageCircle className="h-3.5 w-3.5" />
              إضافة رقم واتساب للتذكير
              <ChevronDown className={`h-3 w-3 transition-transform ${showPhone ? 'rotate-180' : ''}`} />
            </button>

            {showPhone && (() => {
              const digits = phone.replace(/\D/g, '');
              // رقم محلي محتمل: يبدأ بصفر أو قصير جداً (بلا رمز دولة)
              const looksLocal = digits.length > 0 && (digits.startsWith('0') || digits.length < 10);
              return (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">رقم الواتساب (مع رمز الدولة)</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)}
                    type="tel" placeholder="9647701234567"
                    className={`w-full bg-muted/50 border rounded-xl px-3 py-3 text-sm outline-none ${
                      looksLocal ? 'border-amber-400 focus:border-amber-500' : 'border-border focus:border-primary'
                    }`} dir="ltr" />
                  {looksLocal ? (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      ⚠ الرقم يبدو محلياً. أضف رمز الدولة بدل الصفر (مثال: 9647701234567) وإلا لن يعمل الرابط.
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-1">بدون + في البداية · مثال: 9647701234567</p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* زر الحفظ — ثابت في الأسفل */}
        <div className="shrink-0 px-5 pt-2 pb-4 border-t border-border bg-background">
          <button onClick={handleSave}
            disabled={!name.trim() || !amount}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-all">
            حفظ الدين
          </button>
        </div>
      </div>
    </div>
  );
}

// ── تأكيد الحذف ───────────────────────────────────────────────
function DeleteConfirm({ debt, onConfirm, onCancel }: {
  debt: Debt;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pb-16">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-background rounded-2xl border border-border px-5 py-5 w-full max-w-xs z-10">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="font-semibold text-sm">حذف الدين؟</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          سيتم حذف دين <span className="font-semibold text-foreground">{debt.name}</span> بمبلغ{' '}
          <span className="font-semibold text-foreground">{fmt(debt.amount)} د.ع</span> نهائياً.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">إلغاء</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold">حذف</button>
        </div>
      </div>
    </div>
  );
}

// ── Debt Card ──────────────────────────────────────────────────
function DebtCard({ debt, onSettle, onUnsettle, onDeleteRequest }: {
  debt: Debt;
  onSettle: (id: string) => void;
  onUnsettle: (id: string) => void;
  onDeleteRequest: (debt: Debt) => void;
}) {
  // تأكيد قبل التسوية لمنع الضغط الخاطئ
  const [confirmSettle, setConfirmSettle] = useState(false);
  const days = debt.dueDate ? daysUntil(debt.dueDate) : null;
  const isOverdue  = days !== null && days < 0;
  const isDueSoon  = days !== null && days >= 0 && days <= 7;
  const isToMe     = debt.direction === 'to-me';

  const dueBorder  = isOverdue ? 'border-red-300 dark:border-red-700'
    : isDueSoon ? 'border-amber-300 dark:border-amber-700' : 'border-border';
  const dueText    = isOverdue ? 'text-red-600 dark:text-red-400'
    : isDueSoon ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground';

  function dueDateLabel() {
    if (!debt.dueDate) return null;
    if (isOverdue)  return `متأخر ${Math.abs(days!)} يوم`;
    if (days === 0) return 'اليوم';
    if (days === 1) return 'غداً';
    if (isDueSoon)  return `بعد ${days} أيام`;
    return new Date(debt.dueDate).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (debt.isSettled) {
    return (
      <div className="bg-muted/30 border border-border rounded-2xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 opacity-50 ${avatarColor(debt.name)}`}>
            {initials(debt.name)}
          </div>
          <div>
            <p className="text-sm text-muted-foreground line-through">{debt.name}</p>
            <p className="text-[10px] text-muted-foreground">
              تمّت التسوية
              {debt.settledAt && ` · ${new Date(debt.settledAt).toLocaleDateString('ar-IQ', { day:'numeric', month:'short' })}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{fmt(debt.amount)} د.ع</span>
          <button onClick={() => onUnsettle(debt.id)}
            className="text-[10px] text-primary border border-primary/30 rounded-lg px-2 py-1 hover:bg-primary/5 transition-colors">
            تراجع
          </button>
          <button onClick={() => onDeleteRequest(debt)} className="text-muted-foreground/40 hover:text-destructive transition-colors p-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-2xl px-4 py-3 ${dueBorder}`}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(debt.name)}`}>
            {initials(debt.name)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{debt.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                isToMe
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {isToMe ? 'أقرضته' : 'اقترضت منه'}
              </span>
              {debt.reason && <span className="text-[11px] text-muted-foreground">{debt.reason}</span>}
            </div>
          </div>
        </div>
        <div className="text-left">
          <p className={`text-base font-bold ${isToMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {isToMe ? '+' : '-'}{fmt(debt.amount)}
          </p>
          <p className="text-[10px] text-muted-foreground">د.ع</p>
        </div>
      </div>

      {confirmSettle ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">
            {isToMe ? 'تأكيد استحصال المبلغ؟' : 'تأكيد سداد المبلغ؟'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setConfirmSettle(false)}
              className="text-[11px] rounded-lg px-3 py-1.5 border border-border text-muted-foreground">
              إلغاء
            </button>
            <button onClick={() => { setConfirmSettle(false); onSettle(debt.id); }}
              className="text-[11px] rounded-lg px-3 py-1.5 bg-primary text-primary-foreground font-semibold">
              تأكيد
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {debt.dueDate ? (
              <>
                <Bell className={`h-3 w-3 shrink-0 ${dueText}`} />
                <span className={`text-[11px] font-medium ${dueText}`}>{dueDateLabel()}</span>
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground/50">بدون موعد</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {debt.phone && (
              <button onClick={() => openWhatsApp(debt)}
                className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2 py-1.5 active:scale-95 transition-transform">
                <MessageCircle className="h-3 w-3" />
                واتساب
              </button>
            )}
            <button onClick={() => setConfirmSettle(true)}
              className="flex items-center gap-1 text-[11px] rounded-lg px-2 py-1.5 active:scale-95 transition-transform border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary">
              <Check className="h-3 w-3" />
              {isToMe ? 'سجّل استحصال' : 'سجّل سداد'}
            </button>
            <button onClick={() => onDeleteRequest(debt)} className="text-muted-foreground/40 hover:text-destructive transition-colors p-1">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function DebtsPage() {
  const { user }  = useAuth();
  const qc        = useQueryClient();
  const [filter,  setFilter]  = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [toDelete, setToDelete] = useState<Debt | null>(null);

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts', user?.uid],
    queryFn:  () => getDebts(user!.uid),
    enabled:  !!user,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<Debt,'id'|'uid'|'createdAt'>) => addDebt(user!.uid, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['debts', user?.uid] }); setShowAdd(false); },
  });

  const settleMutation = useMutation({
    mutationFn: (id: string) => settleDebt(user!.uid, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['debts', user?.uid] }),
  });

  const unsettleMutation = useMutation({
    mutationFn: (id: string) => unsettleDebt(user!.uid, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['debts', user?.uid] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDebt(user!.uid, id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['debts', user?.uid] }); setToDelete(null); },
  });

  const active   = debts.filter(d => !d.isSettled);
  const toMe     = active.filter(d => d.direction === 'to-me');
  const fromMe   = active.filter(d => d.direction === 'from-me');
  const settled  = debts.filter(d => d.isSettled);

  const totalToMe   = toMe.reduce((s, d)  => s + d.amount, 0);
  const totalFromMe = fromMe.reduce((s, d) => s + d.amount, 0);
  const netBalance  = totalToMe - totalFromMe;

  const urgentDebts = active.filter(d => {
    if (!d.dueDate) return false;
    const days = daysUntil(d.dueDate);
    return days <= 3 && days >= -30;
  });

  const filtered = useMemo(() => {
    if (filter === 'to-me')   return toMe;
    if (filter === 'from-me') return fromMe;
    if (filter === 'settled') return settled;
    return [
      ...active.sort((a, b) => {
        const da = a.dueDate ? daysUntil(a.dueDate) : 9999;
        const db = b.dueDate ? daysUntil(b.dueDate) : 9999;
        return da - db;
      }),
      ...settled,
    ];
  }, [filter, debts]);

  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: 'all',      label: 'الكل',   count: active.length },
    { key: 'to-me',   label: 'أقرضت',  count: toMe.length },
    { key: 'from-me', label: 'اقترضت', count: fromMe.length },
    { key: 'settled', label: 'مسوّاة',  count: settled.length },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-3 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">دفتر الديون</h1>
          <p className="text-[11px] text-muted-foreground">تتبّع ما أقرضته وما اقترضته</p>
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
          <p className="text-[10px] text-muted-foreground mb-1">أقرضت</p>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalToMe)}</p>
          <p className="text-[10px] text-muted-foreground">د.ع</p>
        </div>
        <div className="bg-card border border-border rounded-2xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">اقترضت</p>
          <p className="text-base font-bold text-red-600 dark:text-red-400">{fmt(totalFromMe)}</p>
          <p className="text-[10px] text-muted-foreground">د.ع</p>
        </div>
      </div>

      {/* ── تنبيه استحقاق ── */}
      {urgentDebts.length > 0 && (
        <div className="mx-1 mb-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 shrink-0 flex flex-col gap-1.5">
          {urgentDebts.map(d => {
            const days  = daysUntil(d.dueDate!);
            const label = days < 0 ? `متأخر ${Math.abs(days)} يوم`
              : days === 0 ? 'اليوم' : `بعد ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
            return (
              <div key={d.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 truncate">
                    {d.direction === 'from-me' ? 'ادفع لـ' : 'استحصل من'}{' '}
                    <span className="font-semibold">{d.name}</span> — {label}
                  </p>
                </div>
                {d.phone && (
                  <button onClick={() => openWhatsApp(d)}
                    className="shrink-0 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2 py-1">
                    <MessageCircle className="h-3 w-3" />
                    واتساب
                  </button>
                )}
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
            {!!f.count && (
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
              {filter === 'settled' ? 'لا توجد ديون مسوّاة بعد'
                : filter === 'to-me' ? 'لم تُقرض أحداً بعد'
                : filter === 'from-me' ? 'لم تقترض من أحد بعد'
                : 'لا توجد ديون مسجّلة'}
            </p>
          </div>
        )}

        {filtered.map(debt => (
          <DebtCard
            key={debt.id}
            debt={debt}
            onSettle={id => settleMutation.mutate(id)}
            onUnsettle={id => unsettleMutation.mutate(id)}
            onDeleteRequest={d => setToDelete(d)}
          />
        ))}
      </div>

      {/* ── Sheets & Dialogs ── */}
      {showAdd && (
        <AddSheet
          onClose={() => setShowAdd(false)}
          onSave={data => addMutation.mutate(data)}
        />
      )}

      {toDelete && (
        <DeleteConfirm
          debt={toDelete}
          onConfirm={() => deleteMutation.mutate(toDelete.id)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
