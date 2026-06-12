'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import {
  getInstallmentPlans, addInstallmentPlan,
  payInstallment, deleteInstallmentPlan,
} from '@/services/firestore';
import { ChevronRight, Plus, Check, Trash2, Bell, X, AlertTriangle, BookOpen, Calculator } from 'lucide-react';
import Link from 'next/link';
import type { InstallmentPlan } from '@/types';

// ── مساعدات ───────────────────────────────────────────────────
function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

// تنسيق حقل الإدخال: يعرض فواصل ويحذف الحروف
function fmtInput(raw: string): string {
  const n = parseInt(raw.replace(/,/g, '') || '0');
  return n ? n.toLocaleString('en-US') : '';
}

function parseAmt(s: string): number {
  return parseInt(s.replace(/,/g, '') || '0') || 0;
}

function useAmountField(init = '') {
  const [raw, setRaw] = useState(init);
  const display = fmtInput(raw);
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value.replace(/,/g, '').replace(/\D/g, ''));
  }
  return { value: parseAmt(raw), display, onChange, setRaw };
}

function daysUntil(dateStr: string) {
  return Math.round((new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
}

function nextPaymentDate(plan: InstallmentPlan): string {
  const start = new Date(plan.startDate);
  const d = new Date(start.getFullYear(), start.getMonth() + plan.paidCount, plan.paymentDay);
  return d.toISOString().split('T')[0];
}

function dueDateLabel(days: number): string {
  if (days < 0)  return `متأخر ${Math.abs(days)} يوم`;
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  if (days <= 7)  return `بعد ${days} أيام`;
  return new Date(Date.now() + days * 86400000).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' });
}

// ── Sheet حفظ الخطة ──────────────────────────────────────────
function SaveSheet({ monthly, total, down, original, months, onClose, onSave }: {
  monthly: number; total: number; down: number; original: number; months: number;
  onClose: () => void;
  onSave: (name: string, day: number, startDate: string) => void;
}) {
  const [name,      setName]      = useState('');
  const [day,       setDay]       = useState(1);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end pb-16">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-background rounded-t-3xl border-t border-border z-10 flex flex-col max-h-[80dvh]">

        {/* header ثابت */}
        <div className="shrink-0 px-5 pt-3 pb-3">
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">حفظ الخطة</h2>
            <button onClick={onClose} className="p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {/* ملخص سريع */}
        <div className="shrink-0 mx-5 mb-3 bg-muted/40 rounded-xl px-4 py-2.5 flex justify-between text-sm">
          <span className="text-muted-foreground">القسط الشهري</span>
          <span className="font-bold">{fmt(monthly)} د.ع</span>
        </div>

        {/* حقول قابلة للتمرير */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          <div className="flex flex-col gap-3">

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">اسم المنتج *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="مثال: سيارة كيا، لابتوب، ثلاجة..."
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">يوم الاستحقاق من كل شهر</label>
              <select value={day} onChange={e => setDay(Number(e.target.value))}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary">
                {Array.from({length: 28}, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>اليوم {d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">تاريخ أول قسط</label>
              <input value={startDate} onChange={e => setStartDate(e.target.value)}
                type="date"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* زر الحفظ ثابت */}
        <div className="shrink-0 px-5 pt-2 pb-4 border-t border-border bg-background">
          <button
            disabled={!name.trim()}
            onClick={() => onSave(name.trim(), day, startDate)}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-all">
            حفظ الخطة
          </button>
        </div>
      </div>
    </div>
  );
}

// ── تأكيد الحذف ───────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pb-16">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-background rounded-2xl border border-border px-5 py-5 w-full max-w-xs z-10">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="font-semibold text-sm">حذف الخطة؟</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          سيتم حذف خطة <span className="font-semibold text-foreground">{name}</span> وكل سجل مدفوعاتها نهائياً.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">إلغاء</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold">حذف</button>
        </div>
      </div>
    </div>
  );
}

// ── بطاقة الخطة ───────────────────────────────────────────────
function PlanCard({ plan, onPay, onDelete }: {
  plan: InstallmentPlan;
  onPay: () => void;
  onDelete: () => void;
}) {
  const progress   = Math.round((plan.paidCount / plan.months) * 100);
  const paidAmt    = plan.monthlyPayment * plan.paidCount + plan.downPayment;
  const remaining  = plan.monthlyPayment * (plan.months - plan.paidCount);
  const nextDate   = !plan.isCompleted ? nextPaymentDate(plan) : null;
  const days       = nextDate ? daysUntil(nextDate) : null;
  const isOverdue  = days !== null && days < 0;
  const isDueSoon  = days !== null && days >= 0 && days <= 7;

  const borderCls = isOverdue ? 'border-red-300 dark:border-red-700'
    : isDueSoon ? 'border-amber-300 dark:border-amber-700' : 'border-border';

  return (
    <div className={`bg-card border rounded-2xl px-4 py-3 ${borderCls}`}>
      {/* اسم + badge */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold">{plan.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {plan.months} قسط · يوم {plan.paymentDay} من كل شهر
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {plan.isCompleted ? (
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-lg">مكتملة</span>
          ) : days !== null ? (
            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${
              isOverdue ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              : isDueSoon ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              : 'bg-muted text-muted-foreground'
            }`}>{dueDateLabel(days)}</span>
          ) : null}
          <button onClick={onDelete} className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* شريط التقدم */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-muted-foreground">{plan.paidCount} من {plan.months} قسط مدفوع</span>
          <span className="text-[10px] font-semibold">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" dir="ltr">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* أرقام */}
      <div className="grid grid-cols-3 gap-2 mb-2.5 text-center">
        <div className="bg-muted/40 rounded-xl py-2">
          <p className="text-xs font-bold">{fmt(plan.monthlyPayment)}</p>
          <p className="text-[10px] text-muted-foreground">القسط / شهر</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl py-2">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{fmt(paidAmt)}</p>
          <p className="text-[10px] text-muted-foreground">مدفوع</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl py-2">
          <p className="text-xs font-bold text-red-600 dark:text-red-400">{fmt(remaining)}</p>
          <p className="text-[10px] text-muted-foreground">متبقي</p>
        </div>
      </div>

      {/* زر الدفع */}
      {!plan.isCompleted && (
        <button onClick={onPay}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary transition-colors active:scale-[0.98]">
          <Check className="h-3.5 w-3.5" />
          سجّل دفع القسط {plan.paidCount + 1}
        </button>
      )}
    </div>
  );
}

// ── الصفحة الرئيسية ───────────────────────────────────────────
export default function InstallmentPage() {
  const { user }       = useAuth();
  const { userSettings, incomes } = useAppData();
  const qc             = useQueryClient();

  const [tab, setTab]  = useState<'calc' | 'plans'>('calc');
  const [toDelete, setToDelete] = useState<InstallmentPlan | null>(null);
  const [showSave, setShowSave] = useState(false);

  // حقول الحاسبة
  const total    = useAmountField();
  const down     = useAmountField();
  const origPrice = useAmountField();
  const [months, setMonths]  = useState('12');

  // حسابات فورية
  const net      = Math.max(0, total.value - down.value);
  const mths     = parseInt(months) || 1;
  const monthly  = net > 0 ? Math.round(net / mths) : 0;
  const extraCost = origPrice.value > 0 ? Math.max(0, total.value - origPrice.value) : 0;
  const extraPct  = origPrice.value > 0 ? ((extraCost / origPrice.value) * 100) : 0;

  // مقارنة بالدخل والميزانية
  const recurringIncome = (incomes ?? []).filter(i => i.type === 'recurring').reduce((s,i) => s + i.amount, 0);
  const monthlyIncome   = recurringIncome || (userSettings?.profile?.monthlyIncome ?? 0);
  const totalBudget     = userSettings?.budget?.totalBudget ?? 0;
  const incomePct       = monthlyIncome > 0 ? (monthly / monthlyIncome) * 100 : 0;
  const budgetPct       = totalBudget  > 0  ? (monthly / totalBudget)   * 100 : 0;

  // خطط محفوظة
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['installmentPlans', user?.uid],
    queryFn:  () => getInstallmentPlans(user!.uid),
    enabled:  !!user,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<InstallmentPlan,'id'|'uid'|'createdAt'>) => addInstallmentPlan(user!.uid, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['installmentPlans', user?.uid] }); setShowSave(false); setTab('plans'); },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, paid, done }: { id: string; paid: number; done: boolean }) =>
      payInstallment(user!.uid, id, paid, done),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['installmentPlans', user?.uid] }),
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => deleteInstallmentPlan(user!.uid, id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['installmentPlans', user?.uid] }); setToDelete(null); },
  });

  function handleSavePlan(name: string, day: number, startDate: string) {
    addMutation.mutate({
      name, totalAmount: total.value, downPayment: down.value,
      months: mths, monthlyPayment: monthly,
      originalPrice: origPrice.value || undefined,
      paymentDay: day, startDate,
      paidCount: 0, isCompleted: false,
    });
  }

  // إحصاء خطط داش بورد
  const activePlans   = plans.filter(p => !p.isCompleted);
  const totalMonthly  = activePlans.reduce((s, p) => s + p.monthlyPayment, 0);
  const totalIncomePct = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : 0;
  const urgentPlans   = activePlans.filter(p => {
    const d = daysUntil(nextPaymentDate(p));
    return d <= 5 && d >= -30;
  });

  // شريط لون المؤشر
  function barColor(pct: number, lo: number, hi: number) {
    if (pct <= lo) return 'bg-emerald-500';
    if (pct <= hi) return 'bg-amber-400';
    return 'bg-red-400';
  }
  function textColor(pct: number, lo: number, hi: number) {
    if (pct <= lo) return 'text-emerald-600 dark:text-emerald-400';
    if (pct <= hi) return 'text-amber-500';
    return 'text-red-500';
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-2 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">حاسبة التقسيط</h1>
          <p className="text-[11px] text-muted-foreground">احسب قسطك وتتبّع خططك</p>
        </div>
      </div>

      {/* ── تبويبان ── */}
      <div className="flex gap-1.5 px-1 mb-2 shrink-0">
        <button onClick={() => setTab('calc')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
            tab === 'calc' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
          }`}>
          <Calculator className="h-3.5 w-3.5" />
          الحاسبة
        </button>
        <button onClick={() => setTab('plans')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
            tab === 'plans' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
          }`}>
          <BookOpen className="h-3.5 w-3.5" />
          خططي
          {activePlans.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${tab === 'plans' ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
              {activePlans.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════ تبويب الحاسبة ══════════════ */}
      {tab === 'calc' && (
        <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-2">

          {/* المدخلات */}
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground mb-3">بيانات التقسيط</p>

            {/* إجمالي سعر التقسيط — إلزامي */}
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">
                إجمالي سعر التقسيط *
                <span className="mr-1 text-[10px] opacity-60">(ما ستدفعه كاملاً)</span>
              </label>
              <div className="relative">
                <input
                  value={total.display}
                  onChange={total.onChange}
                  inputMode="numeric"
                  placeholder="مثال: 18,000,000"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
              </div>
            </div>

            {/* عدد الأشهر — إلزامي */}
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">عدد الأقساط (شهر) *</label>
              <div className="flex gap-1.5 flex-wrap">
                {[6,12,18,24,36,48].map(m => (
                  <button key={m} onClick={() => setMonths(String(m))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      months === String(m)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                    {m}
                  </button>
                ))}
                <input
                  value={months}
                  onChange={e => setMonths(e.target.value.replace(/\D/g,''))}
                  inputMode="numeric"
                  placeholder="أخرى"
                  className="w-16 bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:border-primary" />
              </div>
            </div>

            {/* دفعة أولى — اختياري */}
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">
                الدفعة الأولى
                <span className="mr-1 text-[10px] opacity-60">(اختياري — 0 إذا لا يوجد)</span>
              </label>
              <div className="relative">
                <input
                  value={down.display}
                  onChange={down.onChange}
                  inputMode="numeric"
                  placeholder="0"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
              </div>
            </div>

            {/* السعر النقدي — اختياري للمقارنة */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                السعر نقداً
                <span className="mr-1 text-[10px] opacity-60">(اختياري — لحساب الفائدة الحقيقية)</span>
              </label>
              <div className="relative">
                <input
                  value={origPrice.display}
                  onChange={origPrice.onChange}
                  inputMode="numeric"
                  placeholder="اتركه فارغاً إذا لا تعرفه"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
              </div>
            </div>
          </div>

          {/* النتائج — تظهر فقط إذا أُدخل إجمالي */}
          {total.value > 0 && (
            <>
              {/* القسط الشهري */}
              <div className="bg-card border border-border rounded-2xl px-4 py-3">
                <p className="text-xs text-muted-foreground mb-2">القسط الشهري</p>
                <p className="text-4xl font-bold text-foreground leading-none">
                  {fmt(monthly)}
                  <span className="text-base font-normal text-muted-foreground mr-2">د.ع</span>
                </p>
                {down.value > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    بعد دفعة أولى {fmt(down.value)} د.ع · صافي التقسيط {fmt(net)} د.ع
                  </p>
                )}
              </div>

              {/* مقارنة بالدخل والميزانية */}
              {(monthlyIncome > 0 || totalBudget > 0) && (
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-3">تأثير القسط على وضعك</p>
                  <div className="flex flex-col gap-2.5">
                    {monthlyIncome > 0 && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">من الدخل الشهري</span>
                          <span className={`text-xs font-bold ${textColor(incomePct,10,30)}`}>{incomePct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" dir="ltr">
                          <div className={`h-full rounded-full ${barColor(incomePct,10,30)}`} style={{width:`${Math.min(incomePct,100)}%`}} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">دخلك: {fmt(monthlyIncome)} د.ع</p>
                      </div>
                    )}
                    {totalBudget > 0 && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">من ميزانية الشهر</span>
                          <span className={`text-xs font-bold ${textColor(budgetPct,25,75)}`}>{budgetPct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" dir="ltr">
                          <div className={`h-full rounded-full ${barColor(budgetPct,25,75)}`} style={{width:`${Math.min(budgetPct,100)}%`}} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* مقارنة نقد vs تقسيط */}
              {origPrice.value > 0 && extraCost > 0 && (
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-2">نقداً مقابل تقسيطاً</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">💵 نقداً</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmt(origPrice.value)}</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5">توفر {fmt(extraCost)} د.ع</p>
                    </div>
                    <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">📅 تقسيطاً</p>
                      <p className="text-sm font-bold text-red-700 dark:text-red-400">{fmt(total.value)}</p>
                      <p className="text-[10px] text-red-600 dark:text-red-500 mt-0.5">زيادة {extraPct.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* زر الحفظ */}
              <button onClick={() => setShowSave(true)}
                className="w-full py-3 rounded-2xl border border-primary text-primary text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                <Plus className="h-4 w-4" />
                حفظ كخطة مُتتبَّعة
              </button>
            </>
          )}

          {/* placeholder */}
          {total.value === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-4xl mb-3">🧮</p>
              <p className="text-sm text-muted-foreground">أدخل إجمالي سعر التقسيط وعدد الأشهر</p>
              <p className="text-xs text-muted-foreground/60 mt-1">ستظهر النتائج فوراً</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ تبويب الخطط ══════════════ */}
      {tab === 'plans' && (
        <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-2">

          {/* ملخص */}
          {activePlans.length > 0 && (
            <div className="flex gap-2">
              <div className="flex-1 bg-card border border-border rounded-2xl px-3 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">أقساطي الشهرية</p>
                <p className="text-base font-bold text-foreground">{fmt(totalMonthly)}</p>
                <p className="text-[10px] text-muted-foreground">د.ع / شهر</p>
              </div>
              {monthlyIncome > 0 && (
                <div className="flex-1 bg-card border border-border rounded-2xl px-3 py-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">% من دخلك</p>
                  <p className={`text-base font-bold ${textColor(totalIncomePct,20,40)}`}>{totalIncomePct.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground">من الدخل</p>
                </div>
              )}
            </div>
          )}

          {/* تنبيهات */}
          {urgentPlans.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 flex flex-col gap-1.5">
              {urgentPlans.map(p => {
                const d = daysUntil(nextPaymentDate(p));
                return (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      قسط <span className="font-semibold">{p.name}</span> — {dueDateLabel(d)} · {fmt(p.monthlyPayment)} د.ع
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* قائمة الخطط */}
          {isLoading && (
            <div className="flex flex-col gap-2 animate-pulse">
              {[1,2].map(i => <div key={i} className="h-36 bg-muted rounded-2xl" />)}
            </div>
          )}

          {!isLoading && plans.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm text-muted-foreground">لا توجد خطط محفوظة</p>
              <button onClick={() => setTab('calc')}
                className="mt-3 text-xs text-primary border border-primary/30 rounded-xl px-4 py-2">
                ابدأ بالحاسبة
              </button>
            </div>
          )}

          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onPay={() => {
                const newCount = plan.paidCount + 1;
                payMutation.mutate({ id: plan.id, paid: newCount, done: newCount >= plan.months });
              }}
              onDelete={() => setToDelete(plan)}
            />
          ))}
        </div>
      )}

      {/* ── Sheets & Dialogs ── */}
      {showSave && (
        <SaveSheet
          monthly={monthly} total={total.value} down={down.value}
          original={origPrice.value} months={mths}
          onClose={() => setShowSave(false)}
          onSave={handleSavePlan}
        />
      )}

      {toDelete && (
        <DeleteConfirm
          name={toDelete.name}
          onConfirm={() => delMutation.mutate(toDelete.id)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
