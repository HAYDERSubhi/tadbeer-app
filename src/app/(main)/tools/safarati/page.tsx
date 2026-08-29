'use client';

// ═══════════════════════ سفراتي — ميزانية سفراتك ═══════════════════════
// النمط المرجعي: tools/silftna (قائمة + لوحة تفصيلية بنفس الصفحة، بلا مسارات
// ديناميكية). كل الأصناف منسوخة من نظام تصميم تدبير القائم — بلا أكواد Hex،
// وبخصائص RTL منطقية (ms/me/ps/pe/start/end) حصراً.
//
// مصروف السفرة سجل Expense واحد بالمسار النشط لمصاريف تدبير (شخصي أو عائلي)،
// بحقلي tripId و tripCategory. لا كيان منفصل ولا منطق مزامنة.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { differenceInCalendarDays, format } from 'date-fns';
import {
  AlertTriangle, ChevronDown, ChevronRight, Loader2, Luggage, Pencil, Plus, Trash2,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import {
  addExpense, addTrip, deleteExpense, getExpensesForTrips, getTrip, getTripExpenses,
  getTrips, setTripExpensesBudgetFlag, updateExpense, updateTrip,
} from '@/services/firestore';
import { arIQ } from '@/lib/arabic-date';
import { normalizeDigits } from '@/lib/normalize-digits';
import { TRAVEL_CATEGORY_ID } from '@/lib/constants';
import { findDuplicateExpense } from '@/lib/duplicate-check';
import type { Expense, Trip, TripCategory, TripType } from '@/types';

import {
  actualTripDays, categoryBreakdown, dayCounter, effectiveStatus, fmt, initialStatus,
  inputValueFromDate, localDateFromInput, localDateTimeFromInput, localDateTimeInputValue,
  splitByPhase, startOfLocalDay, todaysExpenses, topSpendingDay, tripTotals,
  TRIP_CATEGORIES, TRIP_CATEGORY_LABEL, TRIP_TYPES, TRIP_TYPE_LABEL, tripTypeLabel,
} from './calc';
import { TRIP_CATEGORY_ICON, TRIP_TYPE_ICON, tripTypeIcon } from './icons';

// ── مساعدات عرض ───────────────────────────────────────────────────────────
const fmtDay = (iso: string) => format(new Date(iso), 'd MMMM', { locale: arIQ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const parseAmt = (s: string) =>
  parseInt(normalizeDigits(s).replace(/,/g, '').replace(/\D/g, '') || '0') || 0;
const fmtInput = (n: number) => (n ? n.toLocaleString('en-US') : '');

/** مبلغ بوحدته — ملفوف بـ<bdi> حتى لا تنقلب «5,000 د.ع» إلى «د.ع 5,000». */
function Money({ value, className }: { value: number; className?: string }) {
  return <bdi className={className}>{fmt(value)} د.ع</bdi>;
}

/**
 * شريط التقدّم — يمتلئ **من اليمين**.
 * قاعدة مقفلة — ممنوع `flex justify-end`: الصفحة `dir="rtl"` فمحور الـflex يسير يمين←يسار،
 * و`justify-end` = نهاية المحور = **اليسار**، فيمتلئ الشريط معكوساً.
 * المرجع الصحيح: شريط ميزانية الشهر (`dashboard/budget-summary-card.tsx`) —
 * تعبئة مطلَقة الموضع مثبّتة على بداية السطر، مطابقةً لقاعدة `start-0` لا `left-0`.
 */
function ProgressBar({ percent, over, thin }: { percent: number; over: boolean; thin?: boolean }) {
  return (
    <div className={`relative w-full ${thin ? 'h-1.5' : 'h-2'} bg-muted rounded-full overflow-hidden`}>
      <div
        className={`absolute inset-y-0 start-0 rounded-full ${over ? 'bg-destructive' : 'bg-primary'}`}
        style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
      />
    </div>
  );
}

/** علامة صح خطّية للمربع — SVG بسيط بلا إيموجي. */
function CheckMark() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pb-16">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-background rounded-2xl border border-border px-5 py-5 w-full max-w-xs z-10">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className={`h-5 w-5 shrink-0 ${danger ? 'text-destructive' : 'text-muted-foreground'}`} />
          <p className="font-semibold text-sm">{title}</p>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{body}</p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground active:scale-[0.98]">
            إلغاء
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
              danger ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** رأس موحّد لكل شاشات الأداة — سهم الرجوع يمين (اتجاه الصفحة RTL). */
function ToolHeader({ title, subtitle, onBack, backHref, action }: {
  title: string; subtitle?: React.ReactNode; onBack?: () => void; backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-1 pt-1 pb-3 shrink-0">
      {backHref ? (
        <Link href={backHref} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
      ) : (
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ═══════════════════════ الصفحة ═══════════════════════
type View =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'detail'; id: string }
  | { name: 'edit'; id: string }
  // تعديل فقط — الإضافة تتم من شاشات تدبير حصراً، لا من الأداة.
  | { name: 'expense'; tripId: string; expenseId: string }
  | { name: 'summary'; id: string };

export default function SafaratiPage() {
  const [view, setView] = useState<View>({ name: 'list' });

  switch (view.name) {
    case 'create':
      return <CreateView onDone={(id) => setView(id ? { name: 'detail', id } : { name: 'list' })}
                         onCancel={() => setView({ name: 'list' })} />;
    case 'edit':
      return <EditTripView id={view.id} onDone={() => setView({ name: 'detail', id: view.id })} />;
    case 'expense':
      return <ExpenseView tripId={view.tripId} expenseId={view.expenseId}
                          onDone={() => setView({ name: 'detail', id: view.tripId })} />;
    case 'summary':
      return <SummaryView id={view.id} onDone={() => setView({ name: 'list' })} />;
    case 'detail':
      return <DetailView id={view.id}
                         onBack={() => setView({ name: 'list' })}
                         onEdit={() => setView({ name: 'edit', id: view.id })}
                         onEditExpense={(eid) => setView({ name: 'expense', tripId: view.id, expenseId: eid })}
                         onSummary={() => setView({ name: 'summary', id: view.id })} />;
    default:
      return <ListView onOpen={(id) => setView({ name: 'detail', id })}
                       onCreate={() => setView({ name: 'create' })} />;
  }
}

/** إبطال موحّد: مصاريف تدبير الرئيسية أيضاً، وإلا تأخّر ظهور المصروف بالشاشة الرئيسية. */
function useInvalidateAll() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return () => {
    qc.invalidateQueries({ queryKey: ['expenses', user?.uid] });
    qc.invalidateQueries({ queryKey: ['tripExpenses', user?.uid] });
    qc.invalidateQueries({ queryKey: ['trips', user?.uid] });
    qc.invalidateQueries({ queryKey: ['trip', user?.uid] });
  };
}

// ═══════════════════════ شاشة 1 — قائمة السفرات ═══════════════════════
function ListView({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const { user } = useAuth();
  const { householdId } = useAppData();
  const [showArchive, setShowArchive] = useState(false);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips', user?.uid],
    queryFn: () => getTrips(user!.uid),
    enabled: !!user,
  });

  const tripIds = useMemo(() => trips.map(t => t.id), [trips]);

  const { data: allTripExpenses = [] } = useQuery({
    queryKey: ['tripExpenses', user?.uid, householdId, 'all', tripIds.join(',')],
    queryFn: () => getExpensesForTrips(user!.uid, tripIds, householdId),
    enabled: !!user && tripIds.length > 0,
  });

  const byTrip = useMemo(() => {
    const m = new Map<string, Expense[]>();
    allTripExpenses.forEach(e => {
      if (!e.tripId) return;
      m.set(e.tripId, [...(m.get(e.tripId) || []), e]);
    });
    return m;
  }, [allTripExpenses]);

  const live = trips.filter(t => effectiveStatus(t) !== 'COMPLETED');
  const archived = trips.filter(t => effectiveStatus(t) === 'COMPLETED');

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">
      <ToolHeader
        title="سفراتي"
        subtitle="ميزانية سفراتك"
        backHref="/tools"
        action={
          // بالحالة الفارغة، زر المنتصف هو الوحيد — زرّان لنفس الفعل بشاشة
          // واحدة تكرار. يظهر زر الأعلى فقط حين توجد سفرات فعلاً.
          trips.length > 0 ? (
            <button onClick={onCreate}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform shrink-0">
              <Plus className="h-4 w-4" /> سفرة جديدة
            </button>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-4">
        {isLoading && [1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}

        {!isLoading && trips.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Luggage className="h-14 w-14 text-muted-foreground/40 mb-4" strokeWidth={1.25} />
            <p className="text-sm font-semibold">سفرتك الأولى تنتظرك</p>
            <p className="text-xs text-muted-foreground mt-1">حدّد ميزانيتها وتابع مصاريفها أولاً بأول</p>
            <button onClick={onCreate}
              className="mt-4 flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-5 py-3 rounded-2xl active:scale-[0.98] transition-all">
              <Plus className="h-4 w-4" /> سفرة جديدة
            </button>
          </div>
        )}

        {live.map(t => (
          <TripCard key={t.id} trip={t} expenses={byTrip.get(t.id) || []} onClick={() => onOpen(t.id)} />
        ))}

        {archived.length > 0 && (
          <div className="mt-2">
            <button onClick={() => setShowArchive(v => !v)}
              className="flex items-center gap-2 w-full text-xs text-muted-foreground py-2">
              {showArchive ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <span>السفرات المنتهية (<bdi>{archived.length}</bdi>)</span>
            </button>
            {showArchive && (
              <div className="flex flex-col gap-2">
                {archived.map(t => (
                  <TripCard key={t.id} trip={t} expenses={byTrip.get(t.id) || []} onClick={() => onOpen(t.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TripCard({ trip, expenses, onClick }: { trip: Trip; expenses: Expense[]; onClick: () => void }) {
  const status = effectiveStatus(trip);
  const totals = tripTotals(trip, expenses);
  const days = dayCounter(trip);
  const TypeIcon = tripTypeIcon(trip.type);

  return (
    <button onClick={onClick}
      className={`bg-card border rounded-2xl px-4 py-3 text-start active:scale-[0.99] transition-transform ${
        totals.isOverBudget ? 'border-destructive' : 'border-border'
      }`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm font-semibold truncate">{trip.name}</p>
          {totals.isOverBudget && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-lg shrink-0 ${
          status === 'COMPLETED' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
        }`}>
          {status === 'COMPLETED' ? 'منتهية' : status === 'PLANNED' ? 'مخطَّطة' : 'نشطة'}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 gap-2">
        <span className="truncate">
          {status === 'PLANNED'
            ? <>تبدأ <bdi>{fmtDay(trip.startDate)}</bdi></>
            : <>اليوم <bdi>{days.current}</bdi> من <bdi>{days.total}</bdi></>}
        </span>
        <span className="shrink-0">
          {totals.isOverBudget
            ? <>تجاوز <Money value={totals.overBy} className="text-destructive" /></>
            : <>متبقّي <Money value={totals.remaining} /></>}
        </span>
      </div>

      <ProgressBar percent={totals.percent} over={totals.isOverBudget} thin />

      {!trip.countsInBudget && (
        <p className="text-xs text-muted-foreground mt-2">خارج ميزانية الشهر</p>
      )}
    </button>
  );
}

// ═══════════════ نموذج بيانات السفرة (مشترك بين الإنشاء والتعديل) ═══════════════
function TripForm({ value, onChange, error }: {
  value: { name: string; type: TripType; startDate: string; endDate: string; budget: number; countsInBudget: boolean };
  onChange: (patch: Partial<typeof value>) => void;
  error: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-col gap-3">
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">اسم السفرة *</label>
        <input value={value.name} onChange={e => onChange({ name: e.target.value })} placeholder="مثال: أنطاليا 2026"
          className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-base text-start outline-none focus:border-primary" />
      </div>

      <div>
        {/* بلا نجمة: الحقل معبّأ مسبقاً ولا يمكن أن يكون فارغاً (القرار ١٥). */}
        <label className="text-sm text-muted-foreground mb-1 block">نوع السفرة</label>
        <div className="grid grid-cols-3 gap-1.5">
          {TRIP_TYPES.map(t => {
            const Icon = TRIP_TYPE_ICON[t];
            return (
              <button key={t} onClick={() => onChange({ type: t })}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-lg text-sm font-medium transition-all ${
                  value.type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate max-w-full">{TRIP_TYPE_LABEL[t]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <label className="text-sm text-muted-foreground mb-1 block">تاريخ البداية *</label>
          <input type="date" value={value.startDate} onChange={e => onChange({ startDate: e.target.value })}
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-base outline-none focus:border-primary" />
        </div>
        <div className="min-w-0">
          <label className="text-sm text-muted-foreground mb-1 block">تاريخ النهاية *</label>
          <input type="date" value={value.endDate} onChange={e => onChange({ endDate: e.target.value })}
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-base outline-none focus:border-primary" />
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">الميزانية الإجمالية *</label>
        <div className="relative">
          <input value={fmtInput(value.budget)} onChange={e => onChange({ budget: parseAmt(e.target.value) })}
            inputMode="numeric" placeholder="مثال: 2,500,000"
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-base text-start outline-none focus:border-primary" />
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
        </div>
      </div>

      <button onClick={() => onChange({ countsInBudget: !value.countsInBudget })}
              className="flex items-start gap-2.5 text-start pt-1">
        <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
          value.countsInBudget ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-muted/50'
        }`}>
          {value.countsInBudget && <CheckMark />}
        </span>
        <span className="min-w-0">
          <span className="text-xs font-medium block">احتسب مصاريف هذي السفرة ضمن ميزانية تدبير الشهرية</span>
          <span className="text-xs text-muted-foreground block mt-0.5 leading-relaxed">
            إذا شلت التأشير، مصاريف السفرة راح تظهر بتدبير مثل أي مصروف، بس ما تنحسب من ميزانية شهرك.
          </span>
        </span>
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** تحقّق مشترك — رسائل حرفية كما بالمواصفة. */
function validateTrip(v: { name: string; startDate: string; endDate: string; budget: number }): string {
  if (!v.name.trim()) return 'أدخل اسماً للسفرة';
  const start = localDateFromInput(v.startDate);
  const end = localDateFromInput(v.endDate);
  if (!start) return 'اختر تاريخ بداية السفرة';
  if (!end || end <= start) return 'تاريخ النهاية لازم يكون بعد تاريخ البداية';
  if (v.budget <= 0) return 'أدخل مبلغ ميزانية أكبر من صفر';
  return '';
}

// ═══════════════════════ شاشة 2 — إنشاء سفرة جديدة ═══════════════════════
function CreateView({ onDone, onCancel }: { onDone: (id: string | null) => void; onCancel: () => void }) {
  const { user } = useAuth();
  const invalidate = useInvalidateAll();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', type: 'abroad' as TripType,
    startDate: inputValueFromDate(new Date()), endDate: '',
    budget: 0, countsInBudget: true, // الافتراضي: تُحتسب
  });
  const patch = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }));

  const save = useMutation({
    mutationFn: async () => {
      const start = localDateFromInput(form.startDate)!;
      const end = localDateFromInput(form.endDate)!;
      return addTrip(user!.uid, {
        name: form.name.trim(), type: form.type,
        startDate: start.toISOString(), endDate: end.toISOString(),
        totalBudget: form.budget, countsInBudget: form.countsInBudget,
        currency: 'IQD', status: initialStatus(start), closedAt: null,
      });
    },
    onSuccess: (id) => { invalidate(); onDone(id); },
    onError: () => setError('تعذّر حفظ السفرة. تحقّق من الاتصال وحاول مرة ثانية.'),
  });

  function submit() {
    const msg = validateTrip(form);
    setError(msg);
    if (!msg) save.mutate();
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">
      <ToolHeader title="سفرة جديدة" subtitle="حدّد ميزانيتها قبل ما تبدأ" onBack={onCancel} />
      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-3 min-h-0 pb-4">
        <TripForm value={form} onChange={patch} error={error} />
        <button onClick={submit} disabled={save.isPending}
          className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-60">
          {save.isPending
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...</span>
            : 'إنشاء السفرة'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════ شاشة 3.5 — تعديل السفرة ═══════════════════════
function EditTripView({ id, onDone }: { id: string; onDone: () => void }) {
  const { user } = useAuth();
  const { householdId } = useAppData();
  const invalidate = useInvalidateAll();
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [form, setForm] = useState<null | {
    name: string; type: TripType; startDate: string; endDate: string; budget: number; countsInBudget: boolean;
  }>(null);

  const { data: trip } = useQuery({
    queryKey: ['trip', user?.uid, id],
    queryFn: () => getTrip(user!.uid, id),
    enabled: !!user,
  });

  // تعبئة مسبقة مرة واحدة عند وصول السفرة.
  if (trip && !form) {
    setForm({
      name: trip.name, type: trip.type,
      startDate: inputValueFromDate(new Date(trip.startDate)),
      endDate: inputValueFromDate(new Date(trip.endDate)),
      budget: trip.totalBudget, countsInBudget: trip.countsInBudget,
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const f = form!;
      const flagChanged = f.countsInBudget !== trip!.countsInBudget;
      await updateTrip(user!.uid, id, {
        name: f.name.trim(), type: f.type,
        startDate: localDateFromInput(f.startDate)!.toISOString(),
        endDate: localDateFromInput(f.endDate)!.toISOString(),
        totalBudget: f.budget, countsInBudget: f.countsInBudget,
      });
      // تغيير خيار الاحتساب يُعيد وسم كل مصاريف السفرة دفعةً واحدة.
      if (flagChanged) {
        return setTripExpensesBudgetFlag(user!.uid, id, !f.countsInBudget, householdId);
      }
      return -1;
    },
    onSuccess: (count) => {
      invalidate();
      if (count >= 0) setNote(`تم تحديث ${fmt(count)} مصروف`);
      onDone();
    },
    onError: () => setError('تعذّر حفظ التعديلات. تحقّق من الاتصال وحاول مرة ثانية.'),
  });

  function submit() {
    if (!form) return;
    const msg = validateTrip(form);
    setError(msg);
    if (!msg) save.mutate();
  }

  if (!trip || !form) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto">
        <ToolHeader title="تعديل السفرة" onBack={onDone} />
        <div className="h-64 bg-muted rounded-2xl animate-pulse mx-1" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">
      <ToolHeader title="تعديل السفرة" subtitle={trip.name} onBack={onDone} />
      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-3 min-h-0 pb-4">
        <TripForm value={form} onChange={(p) => setForm(f => ({ ...f!, ...p }))} error={error} />
        {note && <p className="text-xs text-primary px-1">{note}</p>}
        <button onClick={submit} disabled={save.isPending}
          className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-60">
          {save.isPending
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...</span>
            : 'حفظ التعديلات'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════ شاشة 4 — إضافة / تعديل مصروف ═══════════════════════
/**
 * شاشة تعديل مصروف سفرة — **تعديل وحذف فقط، لا إضافة**.
 * الإضافة تتم من شاشات تدبير الاعتيادية حصراً (يدوي/صوت/فاتورة): فعل متكرر
 * تُبنى عادته هناك. أمّا التعديل فنادر وتصحيحي، فلا يبني عادة منافسة —
 * ولأنه سجل واحد، أي تعديل هنا يظهر بتدبير فوراً بلا مزامنة.
 */
function ExpenseView({ tripId, expenseId, onDone }: {
  tripId: string; expenseId: string; onDone: () => void;
}) {
  const { user } = useAuth();
  const { householdId } = useAppData();
  const invalidate = useInvalidateAll();

  const { data: trip } = useQuery({
    queryKey: ['trip', user?.uid, tripId],
    queryFn: () => getTrip(user!.uid, tripId),
    enabled: !!user,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['tripExpenses', user?.uid, householdId, tripId],
    queryFn: () => getTripExpenses(user!.uid, tripId, householdId),
    enabled: !!user,
  });

  const existing = expenses.find(e => e.id === expenseId);

  const [form, setForm] = useState<null | {
    amount: number; category: TripCategory; description: string; when: string;
  }>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<string | null>(null);

  if (!form && existing) {
    setForm({
      amount: existing.amount,
      category: (existing.tripCategory ?? 'other') as TripCategory,
      description: existing.title,
      when: localDateTimeInputValue(new Date(existing.date)),
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const f = form!;
      const payload = {
        title: f.description.trim(),
        amount: f.amount,
        // الفئة العامة مقفولة برمجياً على «سفر» — لا يختارها المستخدم أبداً.
        category: TRAVEL_CATEGORY_ID,
        date: localDateTimeFromInput(f.when)!.toISOString(),
        // مشتق آلياً من إعداد السفرة، لا من اختيار مستقل بهذه الشاشة.
        isOutOfBudget: !trip!.countsInBudget,
        tripId,
        tripCategory: f.category,
      };
      return updateExpense(user!.uid, expenseId, payload, householdId);
    },
    onSuccess: () => { invalidate(); onDone(); },
    onError: () => setError('تعذّر حفظ المصروف. تحقّق من الاتصال وحاول مرة ثانية.'),
  });

  const remove = useMutation({
    mutationFn: () => deleteExpense(user!.uid, expenseId, householdId),
    onSuccess: () => { invalidate(); onDone(); },
    onError: () => { setConfirmDelete(false); setError('تعذّر حذف المصروف. حاول مرة ثانية.'); },
  });

  function submit() {
    const f = form!;
    if (f.amount <= 0) return setError('أدخل مبلغ المصروف');
    if (!f.description.trim()) return setError('أدخل وصفاً للمصروف');
    setError('');

    // كاشف التكرار المركزي يُستدعى كما هو، بلا أي استثناء للأداة.
    const others = expenses.filter(e => e.id !== expenseId);
    const dup = findDuplicateExpense(others, {
      title: f.description.trim(), amount: f.amount,
      category: TRAVEL_CATEGORY_ID, date: localDateTimeFromInput(f.when)!.toISOString(),
    });
    if (dup) return setPendingDuplicate(dup.title);
    save.mutate();
  }

  if (!trip || !form) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto">
        <ToolHeader title='تعديل مصروف' onBack={onDone} />
        <div className="h-64 bg-muted rounded-2xl animate-pulse mx-1" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">
      <ToolHeader title='تعديل مصروف' subtitle={trip.name} onBack={onDone} />

      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-3 min-h-0 pb-4">
        <div className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-col gap-3">

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">المبلغ *</label>
            <div className="relative">
              <input value={fmtInput(form.amount)} inputMode="numeric" placeholder="مثال: 25,000"
                onChange={e => setForm(f => ({ ...f!, amount: parseAmt(e.target.value) }))}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-base text-start outline-none focus:border-primary" />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">الفئة *</label>
            <div className="grid grid-cols-2 gap-2">
              {TRIP_CATEGORIES.map(c => {
                const Icon = TRIP_CATEGORY_ICON[c];
                const on = form.category === c;
                return (
                  <button key={c} onClick={() => setForm(f => ({ ...f!, category: c }))}
                    className={`flex items-center gap-2 py-2.5 px-2.5 rounded-lg transition-all text-start ${
                      on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm leading-tight truncate">{TRIP_CATEGORY_LABEL[c]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {/* إلزامي: يُخزَّن كعنوان المصروف بتدبير، وكاشف التكرار يعتمد عليه. */}
            <label className="text-sm text-muted-foreground mb-1 block">الوصف *</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f!, description: e.target.value }))}
              placeholder="مثال: عشاء"
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-base text-start outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">التاريخ والوقت *</label>
            <input type="datetime-local" value={form.when}
              onChange={e => setForm(f => ({ ...f!, when: e.target.value }))}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-base outline-none focus:border-primary" />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <button onClick={submit} disabled={save.isPending}
          className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-60">
          {save.isPending
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...</span>
            : 'حفظ التعديلات'}
        </button>

                  {(
          <button onClick={() => setConfirmDelete(true)}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold flex items-center justify-center gap-2">
            <Trash2 className="h-4 w-4" /> حذف المصروف
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="حذف المصروف؟"
          body="سيتم حذف هذا المصروف من سفرتك ومصاريف تدبير أيضاً."
          confirmLabel="حذف" danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate()}
        />
      )}

      {pendingDuplicate && (
        <ConfirmDialog
          title="مصروف مكرر محتمل"
          body={`يوجد مصروف مسجَّل بنفس اليوم بنفس الوصف والمبلغ والفئة ("${pendingDuplicate}"). تريد الحفظ على أي حال؟`}
          confirmLabel="احفظ على أي حال"
          onCancel={() => setPendingDuplicate(null)}
          onConfirm={() => { setPendingDuplicate(null); save.mutate(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════ شاشة 3 — لوحة السفرة ═══════════════════════
function DetailView({ id, onBack, onEdit, onEditExpense, onSummary }: {
  id: string; onBack: () => void; onEdit: () => void;
  onEditExpense: (expenseId: string) => void; onSummary: () => void;
}) {
  const { user } = useAuth();
  const { householdId } = useAppData();
  const invalidate = useInvalidateAll();
  const [confirmClose, setConfirmClose] = useState(false);

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', user?.uid, id],
    queryFn: () => getTrip(user!.uid, id),
    enabled: !!user,
  });

  // استعلام مستقل بـ tripId — لا من سياق تدبير العام المحدود بستة أشهر،
  // وإلا عرضت سفرة قديمة من الأرشيف صفراً.
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['tripExpenses', user?.uid, householdId, id],
    queryFn: () => getTripExpenses(user!.uid, id, householdId),
    enabled: !!user,
  });

  const close = useMutation({
    mutationFn: () => updateTrip(user!.uid, id, {
      status: 'COMPLETED', closedAt: new Date().toISOString(),
    }),
    onSuccess: () => { invalidate(); setConfirmClose(false); onSummary(); },
  });

  if (isLoading || !trip) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto">
        <ToolHeader title="سفراتي" onBack={onBack} />
        <div className="h-32 bg-muted rounded-2xl animate-pulse mx-1" />
      </div>
    );
  }

  const status = effectiveStatus(trip);
  const isClosed = status === 'COMPLETED';
  const totals = tripTotals(trip, expenses);
  const days = dayCounter(trip);
  const breakdown = categoryBreakdown(expenses);
  const TypeIcon = tripTypeIcon(trip.type);
  // قبل يوم البداية نعرض الحجوزات (كل ما وُسم)، وبعده مصاريف اليوم فقط.
  const isBeforeStart = status === 'PLANNED';
  const shownExpenses = isBeforeStart ? expenses : todaysExpenses(expenses);

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">
      <div className="flex items-center gap-3 px-1 pt-1 pb-2 shrink-0">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-6 w-6" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <h1 className="text-lg font-bold truncate">{trip.name}</h1>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {tripTypeLabel(trip.type)} · {trip.countsInBudget ? 'تُحتسب ضمن ميزانية تدبير' : 'خارج ميزانية الشهر'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-3 min-h-0 pb-4">

        {/* ── القسم الأول: رأس اللوحة ── */}
        <div className="bg-card border border-border rounded-2xl px-4 py-3">
          <p className="text-xs text-muted-foreground mb-2">
            {isClosed
              ? 'سفرة منتهية'
              : status === 'PLANNED'
                ? <>تبدأ <bdi>{fmtDay(trip.startDate)}</bdi></>
                : <>اليوم <bdi>{days.current}</bdi> من <bdi>{days.total}</bdi></>}
          </p>

          {/* الرقم البطل: «المتبقي» — السؤال المتكرر أثناء السفر «كم باقي عندي؟»
              لا «كم صرفت» (القرار ١٦). عند التجاوز يصير المبلغ الفائض بالأحمر. */}
          <div className="mb-3">
            <p className="text-xs text-muted-foreground">
              {totals.isOverBudget ? 'تجاوزت الميزانية بـ' : 'المتبقي'}
            </p>
            <p className={`text-3xl font-bold leading-tight ${totals.isOverBudget ? 'text-destructive' : 'text-primary'}`}>
              <Money value={totals.isOverBudget ? totals.overBy : totals.remaining} />
            </p>
          </div>

          <ProgressBar percent={totals.percent} over={totals.isOverBudget} />

          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground gap-2">
            <span className="truncate">
              الميزانية <Money value={trip.totalBudget} className="font-semibold" />
              {' · '}
              المصروف <Money value={totals.spent} className="font-semibold" />
            </span>
            <bdi className="shrink-0">{Math.round(totals.percent)}%</bdi>
          </div>
        </div>

        {/* بانر التجاوز — هادئ، ولا يمنع إضافة أي مصروف جديد */}
        {totals.isOverBudget && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              تجاوزت ميزانية السفرة بـ<Money value={totals.overBy} />
            </p>
          </div>
        )}

        {/* ── القسم الثاني: أين ذهبت ميزانيتي؟ ── */}
        {breakdown.length > 0 && (
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-sm font-semibold mb-3">أين ذهبت ميزانيتي؟</p>
            <div className="flex flex-col gap-2.5">
              {breakdown.map(row => {
                const Icon = TRIP_CATEGORY_ICON[row.key];
                return (
                  <div key={row.key} className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs truncate">{TRIP_CATEGORY_LABEL[row.key]}</span>
                        <Money value={row.amount} className="text-xs font-semibold shrink-0" />
                      </div>
                      <div className="relative w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div className="absolute inset-y-0 start-0 bg-primary rounded-full" style={{ width: `${row.share}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── القسم الثالث: يتغيّر حسب طور السفرة ──
            قبل بداية السفرة يعرض «الحجوزات» (كل ما وُسم لحد الآن: تذكرة، تأشيرة)،
            لا «مصاريف اليوم» — وإلا وسم المستخدم تذكرة طيران ثم فتح السفرة فوجد
            «لسّه ما سجّلت مصروفاً»، وهي رسالة مقلقة وغلط. بهذا تصير السفرة مفيدة
            من يوم إنشائها لا من يوم انطلاقها. */}
        <div className="bg-card border border-border rounded-2xl px-4 py-3">
          <p className="text-sm font-semibold mb-3">{isBeforeStart ? 'الحجوزات' : 'مصاريف اليوم'}</p>

          {expensesLoading && <div className="h-12 bg-muted rounded-xl animate-pulse" />}

          {/* نص خبري بحت — التسجيل كله يتم من شاشة تدبير (السطر الإرشادي أدناه). */}
          {!expensesLoading && expenses.length === 0 && (
            <p className="text-sm text-muted-foreground py-3 text-center">لسّه ما سجّلت مصروفاً</p>
          )}

          {!expensesLoading && expenses.length > 0 && shownExpenses.length === 0 && (
            <p className="text-sm text-muted-foreground py-3 text-center">ما أكو مصروف مسجَّل اليوم</p>
          )}

          {shownExpenses.map(e => {
            const Icon = TRIP_CATEGORY_ICON[e.tripCategory || 'other'];
            const row = (
              <>
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 text-start">
                  <p className="text-xs font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    <bdi>{fmtTime(e.date)}</bdi> · {TRIP_CATEGORY_LABEL[e.tripCategory || 'other']}
                  </p>
                </div>
                <Money value={e.amount} className="text-xs font-semibold shrink-0" />
              </>
            );
            return isClosed ? (
              <div key={e.id} className="flex items-center gap-2.5 py-2 border-b border-border last:border-b-0">{row}</div>
            ) : (
              <button key={e.id} onClick={() => onEditExpense(e.id)}
                className="w-full flex items-center gap-2.5 py-2 border-b border-border last:border-b-0 active:scale-[0.99] transition-transform">
                {row}
              </button>
            );
          })}
        </div>

        {/* ── الأزرار ── */}
        {isClosed ? (
          <button onClick={onSummary}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-all">
            عرض ملخص السفرة
          </button>
        ) : (
          <>
            {/* سطر إرشادي بلا زر — مقصود.
                زر إضافة هنا (حتى لو فتح شاشة تدبير) يعلّم المستخدم أن مسار
                التسجيل يبدأ من الأداة، فيترسّخ مسار أطول وينشأ حاجز كسل عند
                كل مصروف. النص يرفع الحيرة بلا أن ينشئ عادة منافسة. */}
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                سجّل مصاريفك من شاشة تدبير مثل أي مصروف — تظهر هنا تلقائياً.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={onEdit}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground active:scale-[0.98] flex items-center justify-center gap-2">
                <Pencil className="h-3.5 w-3.5" /> تعديل السفرة
              </button>
              <button onClick={() => setConfirmClose(true)}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold">
                إنهاء السفرة
              </button>
            </div>
          </>
        )}
      </div>

      {confirmClose && (
        <ConfirmDialog
          title="إنهاء السفرة؟"
          body="متأكد تريد تنهي هذي السفرة؟ بعدها ما تقدر تضيف أو تعدّل مصاريفها ولا تعدّل بياناتها"
          confirmLabel="إنهاء" danger
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => close.mutate()}
        />
      )}
    </div>
  );
}

// ═══════════════════════ شاشة 5 — ملخص وإغلاق السفرة ═══════════════════════
function SummaryView({ id, onDone }: { id: string; onDone: () => void }) {
  const { user } = useAuth();
  const { householdId } = useAppData();
  const invalidate = useInvalidateAll();
  const [note, setNote] = useState('');

  const { data: trip } = useQuery({
    queryKey: ['trip', user?.uid, id],
    queryFn: () => getTrip(user!.uid, id),
    enabled: !!user,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['tripExpenses', user?.uid, householdId, id],
    queryFn: () => getTripExpenses(user!.uid, id, householdId),
    enabled: !!user,
  });

  // الفعل الوحيد المسموح على سفرة منتهية: قلب حالة العرض لنفس السجلات.
  // لا يُنشئ ولا يحذف أي سجل — ولذلك لا يُعدّ خرقاً لقاعدة «للقراءة فقط».
  const toggleBudget = useMutation({
    mutationFn: async () => {
      const next = !trip!.countsInBudget;
      await updateTrip(user!.uid, id, { countsInBudget: next });
      return setTripExpensesBudgetFlag(user!.uid, id, !next, householdId);
    },
    onSuccess: (count) => { invalidate(); setNote(`تم تحديث ${fmt(count)} مصروف`); },
  });

  if (!trip) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto">
        <ToolHeader title="ملخص السفرة" onBack={onDone} />
        <div className="h-64 bg-muted rounded-2xl animate-pulse mx-1" />
      </div>
    );
  }

  const totals = tripTotals(trip, expenses);
  const hasExpenses = expenses.length > 0;
  const breakdown = categoryBreakdown(expenses);
  const topCategory = breakdown[0];
  const phases = splitByPhase(trip, expenses);
  // «أعلى يوم إنفاقاً» يُحسب من مصاريف **أيام السفرة فقط**، لا من الحجوزات:
  // ١) يوم الحجز سابق لبداية السفرة فيعطي رقم يوم سالباً («اليوم -1»).
  // ٢) تذكرة الطيران غالباً أكبر مبلغ مفرد، فيصير الجواب دائماً «يوم شراء
  //    التذكرة» — معلومة بلا فائدة. الحجوزات مغطّاة بقسم «قبل السفر» أعلاه.
  const topDay = topSpendingDay(phases.during);
  const days = actualTripDays(trip);
  const dailyAverage = totals.spent / days;
  const topDayIndex = topDay
    ? differenceInCalendarDays(topDay.date, startOfLocalDay(new Date(trip.startDate))) + 1
    : 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">
      <ToolHeader title="ملخص السفرة" subtitle={trip.name} onBack={onDone} />

      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-3 min-h-0 pb-4">

        {!hasExpenses ? (
          <div className="bg-card border border-border rounded-2xl px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">ما سجّلت أي مصروف بهذي السفرة</p>
          </div>
        ) : (
          <>
            {/* القسم الأول: الملخص المالي */}
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {totals.remaining >= 0 ? 'وفّرت' : 'تجاوزت الميزانية بـ'}
              </p>
              <p className={`text-3xl font-bold leading-tight mb-3 ${
                totals.remaining >= 0 ? 'text-primary' : 'text-destructive'
              }`}>
                <Money value={Math.abs(totals.remaining)} />
              </p>

              <ProgressBar percent={totals.percent} over={totals.isOverBudget} />

              <div className="flex flex-col gap-1.5 mt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الميزانية</span>
                  <Money value={trip.totalBudget} className="font-semibold" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">المصروف الفعلي</span>
                  <Money value={totals.spent} className="font-semibold" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">نسبة الاستخدام النهائية</span>
                  <bdi className="font-semibold">{totals.percent.toFixed(1)}%</bdi>
                </div>
              </div>
            </div>

            {/* قبل السفر / أثناء السفر — الحجوزات (تذكرة، تأشيرة) تُدفع قبل
                الانطلاق وقد تكون أكبر بنود السفرة. فصلها يجيب على سؤال يغيّر
                تخطيط السفرة القادمة: كم من كلفتي انصرف قبل ما أطلع من البيت؟ */}
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <p className="text-sm font-semibold mb-3">وين انصرفت الفلوس؟</p>

              <div className="flex flex-col gap-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm">قبل السفر (حجوزات)</span>
                    <Money value={phases.beforeTotal} className="text-sm font-semibold shrink-0" />
                  </div>
                  <ProgressBar percent={phases.beforeShare} over={false} thin />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm">أثناء السفر</span>
                    <Money value={phases.duringTotal} className="text-sm font-semibold shrink-0" />
                  </div>
                  <ProgressBar percent={100 - phases.beforeShare} over={false} thin />
                </div>
              </div>

              {phases.before.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  <bdi>{Math.round(phases.beforeShare)}%</bdi> من كلفة سفرتك انصرفت قبل ما تطلع من البيت
                  (<bdi>{phases.before.length}</bdi> حجز).
                </p>
              )}
            </div>

            {/* القسم الثالث: تحليلات ما بعد السفرة */}
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <p className="text-sm font-semibold mb-3">بعد ما رجعت</p>
              <div className="flex flex-col gap-2.5 text-xs">
                {topCategory && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">أعلى فئة إنفاقاً</span>
                    <span className="font-semibold truncate">{TRIP_CATEGORY_LABEL[topCategory.key]}</span>
                  </div>
                )}
                {topDay && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">أعلى يوم إنفاقاً</span>
                    <span className="font-semibold truncate">
                      اليوم <bdi>{topDayIndex}</bdi> (<bdi>{fmtDay(topDay.date.toISOString())}</bdi>)
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">متوسط الإنفاق اليومي</span>
                  <Money value={dailyAverage} className="font-semibold" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* القسم الثالث: زر الاحتساب — يظهر حسب حالة السفرة الحالية */}
        {hasExpenses && (
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            {trip.countsInBudget ? (
              <>
                <p className="text-xs font-medium mb-1">مصاريف هذي السفرة محتسبة ضمن ميزانية تدبير</p>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  تقدر ترجّعها خارج الميزانية — تبقى ظاهرة بمصاريفك بس ما تنحسب من ميزانية شهرك.
                </p>
                <button onClick={() => toggleBudget.mutate()} disabled={toggleBudget.isPending}
                  className="flex-1 w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground active:scale-[0.98] disabled:opacity-60">
                  {toggleBudget.isPending ? 'جاري التحديث...' : 'أرجعها خارج الميزانية'}
                </button>
              </>
            ) : (
              <>
                <p className="text-xs font-medium mb-1">احتسب مصاريف هذي السفرة ضمن ميزانية تدبير</p>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  راح تنضاف لميزانية الأشهر اللي صرفتها بيها.
                </p>
                <button onClick={() => toggleBudget.mutate()} disabled={toggleBudget.isPending}
                  className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-60">
                  {toggleBudget.isPending ? 'جاري التحديث...' : 'احتسبها ضمن ميزانية تدبير'}
                </button>
              </>
            )}
            {note && <p className="text-xs text-primary mt-2">{note}</p>}
          </div>
        )}

        <button onClick={onDone}
          className="w-full py-3 rounded-2xl border border-border text-sm text-muted-foreground active:scale-[0.98]">
          تم
        </button>
      </div>
    </div>
  );
}
