'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import {
  getInstallmentPlans, addInstallmentPlan,
  payInstallment, deleteInstallmentPlan,
} from '@/services/firestore';
import { ChevronRight, Plus, Check, Trash2, Bell, AlertTriangle, BookOpen, Calculator } from 'lucide-react';
import Link from 'next/link';
import type { InstallmentPlan } from '@/types';

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

function fmtInput(raw: string): string {
  const n = parseInt(raw.replace(/,/g, '') || '0');
  return n ? n.toLocaleString('en-US') : '';
}

function parseAmt(s: string): number {
  return parseInt(s.replace(/,/g, '') || '0') || 0;
}

function useAmountField() {
  const [raw, setRaw] = useState('');
  const display = fmtInput(raw);
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value.replace(/,/g, '').replace(/\D/g, ''));
  }
  return { value: parseAmt(raw), display, onChange };
}

function defaultStartDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
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

function urgencyScore(plan: InstallmentPlan): number {
  if (plan.isCompleted) return 9999;
  return daysUntil(nextPaymentDate(plan));
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
          سيتم حذف <span className="font-semibold text-foreground">{name}</span> وكل سجل مدفوعاتها نهائياً.
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
  plan: InstallmentPlan; onPay: () => void; onDelete: () => void;
}) {
  const progress  = Math.round((plan.paidCount / plan.months) * 100);
  const paidAmt   = plan.monthlyPayment * plan.paidCount + plan.downPayment;
  const remaining = plan.monthlyPayment * (plan.months - plan.paidCount);
  const nextDate  = !plan.isCompleted ? nextPaymentDate(plan) : null;
  const days      = nextDate ? daysUntil(nextDate) : null;
  const isOverdue = days !== null && days < 0;
  const isDueSoon = days !== null && days >= 0 && days <= 7;

  const borderCls = isOverdue  ? 'border-red-300 dark:border-red-700'
    : isDueSoon ? 'border-amber-300 dark:border-amber-700'
    : 'border-border';

  return (
    <div className={`bg-card border rounded-2xl px-4 py-3 ${borderCls}`}>
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

      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-muted-foreground">{plan.paidCount} من {plan.months} قسط مدفوع</span>
          <span className="text-[10px] font-semibold">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" dir="ltr">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

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
  const { user }   = useAuth();
  const { userSettings, incomes } = useAppData();
  const qc         = useQueryClient();

  const [tab, setTab]           = useState<'calc' | 'plans'>('calc');
  const [toDelete, setToDelete] = useState<InstallmentPlan | null>(null);

  // حقول النموذج — كلها في مكان واحد
  const total     = useAmountField();
  const down      = useAmountField();
  const origPrice = useAmountField();
  const [months,      setMonths]      = useState('');
  const [productName, setProductName] = useState('');
  const [startDate,   setStartDate]   = useState(defaultStartDate);

  // حسابات فورية
  const net     = Math.max(0, total.value - down.value);
  const mths    = parseInt(months) || 0;
  const monthly = net > 0 && mths > 0 ? Math.round(net / mths) : 0;
  // يوم الاستحقاق مستخرج تلقائياً من تاريخ أول قسط
  const paymentDay = new Date(startDate).getDate() || 1;

  const extraCost = origPrice.value > 0 ? Math.max(0, total.value - origPrice.value) : 0;
  const extraPct  = origPrice.value > 0 ? (extraCost / origPrice.value) * 100 : 0;

  const recurringIncome = (incomes ?? []).filter(i => i.type === 'recurring').reduce((s,i) => s + i.amount, 0);
  const monthlyIncome   = recurringIncome || (userSettings?.profile?.monthlyIncome ?? 0);
  const totalBudget     = userSettings?.budget?.totalBudget ?? 0;
  const incomePct       = monthlyIncome > 0 ? (monthly / monthlyIncome) * 100 : 0;
  const budgetPct       = totalBudget  > 0  ? (monthly / totalBudget)   * 100 : 0;

  const canSave = total.value > 0 && mths > 0 && productName.trim().length > 0;

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['installmentPlans', user?.uid],
    queryFn:  () => getInstallmentPlans(user!.uid),
    enabled:  !!user,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<InstallmentPlan,'id'|'uid'|'createdAt'>) => addInstallmentPlan(user!.uid, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['installmentPlans', user?.uid] });
      setTab('plans');
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, paid, done }: { id: string; paid: number; done: boolean }) =>
      payInstallment(user!.uid, id, paid, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installmentPlans', user?.uid] }),
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => deleteInstallmentPlan(user!.uid, id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['installmentPlans', user?.uid] }); setToDelete(null); },
  });

  function handleSave() {
    if (!canSave) return;
    addMutation.mutate({
      name: productName.trim(),
      totalAmount: total.value,
      downPayment: down.value,
      months: mths,
      monthlyPayment: monthly,
      originalPrice: origPrice.value || undefined,
      paymentDay,
      startDate,
      paidCount: 0,
      isCompleted: false,
    });
  }

  const activePlans    = plans.filter(p => !p.isCompleted).sort((a,b) => urgencyScore(a) - urgencyScore(b));
  const completedPlans = plans.filter(p => p.isCompleted);
  const totalMonthly   = activePlans.reduce((s,p) => s + p.monthlyPayment, 0);
  const totalIncomePct = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : 0;
  const urgentPlans    = activePlans.filter(p => { const d = daysUntil(nextPaymentDate(p)); return d <= 5 && d >= -30; });

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

      {/* Header */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-2 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">حاسبة التقسيط</h1>
          <p className="text-[11px] text-muted-foreground">احسب قسطك وتتبّع أقساطك</p>
        </div>
      </div>

      {/* تبويبان */}
      <div className="flex gap-1.5 px-1 mb-2 shrink-0">
        <button onClick={() => setTab('calc')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
            tab === 'calc' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
          }`}>
          <Calculator className="h-3.5 w-3.5" />
          حساب القسط
        </button>
        <button onClick={() => setTab('plans')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
            tab === 'plans' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
          }`}>
          <BookOpen className="h-3.5 w-3.5" />
          أقساطي
          {activePlans.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${tab === 'plans' ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
              {activePlans.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════ تبويب الحاسبة ══════ */}
      {tab === 'calc' && (
        <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-20">

          {/* ── بيانات التقسيط الأساسية ── */}
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground mb-3">بيانات التقسيط</p>

            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">
                إجمالي سعر التقسيط *
                <span className="mr-1 text-[10px] opacity-60">(ما ستدفعه كاملاً)</span>
              </label>
              <div className="relative">
                <input value={total.display} onChange={total.onChange} inputMode="numeric"
                  placeholder="مثال: 18,000,000"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">عدد الأقساط (شهر) *</label>
              <input value={months} onChange={e => setMonths(e.target.value.replace(/\D/g,''))}
                onFocus={e => e.target.select()}
                inputMode="numeric" placeholder="مثال: 12"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
            </div>

            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">
                الدفعة الأولى
                <span className="mr-1 text-[10px] opacity-60">(اختياري)</span>
              </label>
              <div className="relative">
                <input value={down.display} onChange={down.onChange} inputMode="numeric" placeholder="0"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                السعر نقداً
                <span className="mr-1 text-[10px] opacity-60">(اختياري — لمقارنة التكلفة)</span>
              </label>
              <div className="relative">
                <input value={origPrice.display} onChange={origPrice.onChange} inputMode="numeric"
                  placeholder="اتركه فارغاً إذا لا تعرفه"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
              </div>
            </div>
          </div>

          {/* النتائج الفورية */}
          {total.value > 0 && mths > 0 && (
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

              {/* تأثير على الدخل والميزانية */}
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
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" style={{transform:'scaleX(-1)'}}>
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
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" style={{transform:'scaleX(-1)'}}>
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
            </>
          )}

          {/* placeholder */}
          {(total.value === 0 || mths === 0) && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-4xl mb-3">🧮</p>
              <p className="text-sm text-muted-foreground">أدخل إجمالي سعر التقسيط وعدد الأشهر</p>
              <p className="text-xs text-muted-foreground/60 mt-1">ستظهر النتائج فوراً</p>
            </div>
          )}

          {/* ── قسم الحفظ — في نفس الصفحة، لا sheet ── */}
          {total.value > 0 && mths > 0 && (
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground mb-3">حفظ كخطة متتبعة</p>

              <div className="mb-3">
                <label className="text-xs text-muted-foreground mb-1 block">اسم المنتج *</label>
                <input value={productName} onChange={e => setProductName(e.target.value)}
                  placeholder="مثال: سيارة، لابتوب، ثلاجة..."
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
              </div>

              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1 block">
                  تاريخ أول قسط
                  <span className="mr-1 text-[10px] opacity-60">(يوم الاستحقاق يُحدد تلقائياً)</span>
                </label>
                <input value={startDate} onChange={e => setStartDate(e.target.value)}
                  type="date"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary" />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  يوم الاستحقاق: يوم {paymentDay} من كل شهر
                </p>
              </div>

              <button
                disabled={!canSave || addMutation.isPending}
                onClick={handleSave}
                className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                {addMutation.isPending ? 'جاري الحفظ...' : 'حفظ الخطة'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════ تبويب أقساطي ══════ */}
      {tab === 'plans' && (
        <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-20">

          {activePlans.length > 0 && (
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">إجمالي أقساطك الشهرية</p>
                {monthlyIncome > 0 && (
                  <span className={`text-xs font-bold ${textColor(totalIncomePct,20,40)}`}>
                    {totalIncomePct.toFixed(1)}% من دخلك
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">{fmt(totalMonthly)} <span className="text-sm font-normal text-muted-foreground">د.ع / شهر</span></p>
              {monthlyIncome > 0 && (
                <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden" style={{transform:'scaleX(-1)'}}>
                  <div className={`h-full rounded-full ${barColor(totalIncomePct,20,40)}`} style={{width:`${Math.min(totalIncomePct,100)}%`}} />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {activePlans.length} خطة نشطة{completedPlans.length > 0 ? ` · ${completedPlans.length} مكتملة` : ''}
              </p>
            </div>
          )}

          {urgentPlans.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 flex flex-col gap-1.5">
              {urgentPlans.map(p => {
                const d = daysUntil(nextPaymentDate(p));
                return (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <span className="font-semibold">{p.name}</span> — {dueDateLabel(d)} · {fmt(p.monthlyPayment)} د.ع
                    </p>
                  </div>
                );
              })}
            </div>
          )}

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

          {activePlans.map(plan => (
            <PlanCard key={plan.id} plan={plan}
              onPay={() => {
                const newCount = plan.paidCount + 1;
                payMutation.mutate({ id: plan.id, paid: newCount, done: newCount >= plan.months });
              }}
              onDelete={() => setToDelete(plan)} />
          ))}

          {completedPlans.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-px bg-border" />
                <p className="text-[10px] text-muted-foreground px-2">مكتملة ({completedPlans.length})</p>
                <div className="flex-1 h-px bg-border" />
              </div>
              {completedPlans.map(plan => (
                <PlanCard key={plan.id} plan={plan} onPay={() => {}} onDelete={() => setToDelete(plan)} />
              ))}
            </>
          )}
        </div>
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
