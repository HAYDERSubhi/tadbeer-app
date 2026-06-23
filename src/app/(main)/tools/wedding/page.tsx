'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { getWeddingPlan, saveWeddingPlan } from '@/services/firestore';
import { ChevronRight, ListChecks, PieChart, Share2, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type { WeddingPlan, WeddingResponsibility, WeddingTier } from '@/types';

// ── الكتالوج: البنود بمبالغ عراقية تقريبية (قابلة للتعديل لاحقاً) ──
type CatalogItem = { id: string; label: string; e: number; m: number; l: number; resp: WeddingResponsibility };
type CatalogGroup = { id: string; title: string; items: CatalogItem[] };

const GROUPS: CatalogGroup[] = [
  { id: 'mahr', title: 'المهر والذهب', items: [
    { id: 'mahr_adv', label: 'المهر المقدّم',   e: 5000000,  m: 10000000, l: 25000000, resp: 'groom' },
    { id: 'gold',     label: 'الصيغة (الذهب)',  e: 3000000,  m: 8000000,  l: 20000000, resp: 'groom' },
  ]},
  { id: 'ceremony', title: 'المراسم والحفلات', items: [
    { id: 'fatiha',  label: 'الفاتحة/الخطوبة',    e: 500000,  m: 1500000, l: 4000000,  resp: 'groom' },
    { id: 'malja',   label: 'عقد القران (الملجة)', e: 250000,  m: 750000,  l: 2000000,  resp: 'groom' },
    { id: 'henna',   label: 'ليلة الحنّة',         e: 500000,  m: 2000000, l: 6000000,  resp: 'bride' },
    { id: 'hall',    label: 'القاعة',              e: 1500000, m: 5000000, l: 15000000, resp: 'groom' },
    { id: 'photo',   label: 'التصوير',             e: 750000,  m: 2500000, l: 7000000,  resp: 'groom' },
    { id: 'kosha',   label: 'الكوشة والديكور',     e: 500000,  m: 2000000, l: 6000000,  resp: 'groom' },
    { id: 'band',    label: 'الفرقة/المطرب',       e: 500000,  m: 2500000, l: 10000000, resp: 'groom' },
    { id: 'zaffa',   label: 'الزفّة',              e: 250000,  m: 750000,  l: 2500000,  resp: 'groom' },
    { id: 'dress',   label: 'فستان العروس',        e: 750000,  m: 2000000, l: 6000000,  resp: 'bride' },
    { id: 'suit',    label: 'بدلة العريس',         e: 400000,  m: 1000000, l: 3000000,  resp: 'groom' },
    { id: 'makeup',  label: 'الكوافير والتجميل',   e: 400000,  m: 1000000, l: 3000000,  resp: 'bride' },
    { id: 'cars',    label: 'المواكب/السيارات',    e: 300000,  m: 1000000, l: 4000000,  resp: 'groom' },
    { id: 'invites', label: 'الدعوات',             e: 200000,  m: 600000,  l: 1500000,  resp: 'groom' },
  ]},
  { id: 'dazza', title: 'الدزّة والسكن', items: [
    { id: 'housing',     label: 'السكن (تجهيز/إيجار)', e: 5000000, m: 15000000, l: 40000000, resp: 'shared' },
    { id: 'furniture',   label: 'الأثاث',              e: 4000000, m: 10000000, l: 25000000, resp: 'bride' },
    { id: 'appliances',  label: 'الأجهزة الكهربائية',  e: 3000000, m: 7000000,  l: 15000000, resp: 'bride' },
    { id: 'furnishings', label: 'المفروشات والأواني',  e: 1500000, m: 4000000,  l: 10000000, resp: 'bride' },
  ]},
  { id: 'misc', title: 'شهر العسل والطوارئ', items: [
    { id: 'honeymoon', label: 'شهر العسل',     e: 1000000, m: 5000000, l: 15000000, resp: 'groom' },
    { id: 'emergency', label: 'متفرقات/طوارئ', e: 1000000, m: 3000000, l: 7000000,  resp: 'shared' },
  ]},
];

const ALL_ITEMS = GROUPS.flatMap(g => g.items);
const TIER_KEY: Record<WeddingTier, 'e'|'m'|'l'> = { economy: 'e', medium: 'm', luxury: 'l' };
const BUFFET = {
  guests:   { economy: 200,   medium: 350,   luxury: 600 } as Record<WeddingTier, number>,
  perGuest: { economy: 15000, medium: 30000, luxury: 60000 } as Record<WeddingTier, number>,
};
const TIER_LABEL: Record<WeddingTier, string> = { economy: 'اقتصادي', medium: 'متوسط', luxury: 'فخم' };

// الإجمالي التقريبي لكل مستوى — يُعرض على المستخدم ليختار بوعي ويقارنه بميزانيته
const TIER_TOTAL: Record<WeddingTier, number> = (() => {
  const out = {} as Record<WeddingTier, number>;
  for (const tier of ['economy','medium','luxury'] as WeddingTier[]) {
    const k = TIER_KEY[tier];
    const items = ALL_ITEMS.reduce((s, it) => s + it[k], 0);
    out[tier] = items + BUFFET.guests[tier] * BUFFET.perGuest[tier];
  }
  return out;
})();

const RESP_META: Record<WeddingResponsibility, { label: string; cls: string; dot: string }> = {
  groom:  { label: 'العريس',     cls: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30',     dot: 'bg-blue-500' },
  bride:  { label: 'أهل العروس', cls: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30',     dot: 'bg-rose-500' },
  shared: { label: 'مشترك',      cls: 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30', dot: 'bg-violet-500' },
};
const RESP_CYCLE: WeddingResponsibility[] = ['groom', 'bride', 'shared'];

function fmt(n: number) { return Math.round(n).toLocaleString('en-US'); }
function fmtInput(raw: number) { return raw ? raw.toLocaleString('en-US') : ''; }
function parseAmt(s: string) { return parseInt(s.replace(/,/g, '').replace(/\D/g, '') || '0') || 0; }

function buildPlan(tier: WeddingTier, budget?: number): WeddingPlan {
  const k = TIER_KEY[tier];
  const amounts: Record<string, number> = {};
  const responsibilities: Record<string, WeddingResponsibility> = {};
  for (const it of ALL_ITEMS) { amounts[it.id] = it[k]; responsibilities[it.id] = it.resp; }
  responsibilities['buffet'] = 'groom';
  return {
    amounts, responsibilities, disabled: {},
    guests: BUFFET.guests[tier], perGuest: BUFFET.perGuest[tier],
    budget, tier, updatedAt: new Date().toISOString(),
  };
}

// يقترح أقرب مستوى لميزانية المستخدم
function suggestTier(budget: number): WeddingTier {
  if (budget <= 0) return 'medium';
  let best: WeddingTier = 'economy'; let bestDiff = Infinity;
  for (const tier of ['economy','medium','luxury'] as WeddingTier[]) {
    const diff = Math.abs(TIER_TOTAL[tier] - budget);
    if (diff < bestDiff) { bestDiff = diff; best = tier; }
  }
  return best;
}

// ── حوار تأكيد تطبيق المستوى ──────────────────────────────────
function TierConfirm({ tier, onConfirm, onCancel }: {
  tier: WeddingTier; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pb-16">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-background rounded-2xl border border-border px-5 py-5 w-full max-w-xs z-10">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="font-semibold text-sm">تطبيق مستوى «{TIER_LABEL[tier]}»؟</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          سيُستبدل كل المبالغ الحالية بأرقام المستوى «{TIER_LABEL[tier]}». تعديلاتك السابقة ستُفقد.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">إلغاء</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">تطبيق</button>
        </div>
      </div>
    </div>
  );
}

// ── شارة المسؤولية (تتبدّل بالنقر) ────────────────────────────
function RespChip({ value, onChange }: { value: WeddingResponsibility; onChange: (v: WeddingResponsibility) => void }) {
  const meta = RESP_META[value];
  return (
    <button onClick={() => onChange(RESP_CYCLE[(RESP_CYCLE.indexOf(value) + 1) % 3])}
      className={`text-[10px] font-medium px-2 py-1 rounded-lg shrink-0 ${meta.cls}`}>
      {meta.label}
    </button>
  );
}

export default function WeddingPage() {
  const { user } = useAuth();
  const { userSettings, incomes } = useAppData();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'items' | 'summary'>('items');
  const [plan, setPlan] = useState<WeddingPlan | null>(null);
  const [tierToApply, setTierToApply] = useState<WeddingTier | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftBudget, setDraftBudget] = useState(0); // الميزانية في شاشة البداية (قبل بناء الخطة)
  const [forceGate, setForceGate] = useState(false); // «ابدأ من جديد» — يُظهر شاشة البداية رغم وجود خطة
  const loadedRef = useRef(false);

  // تحميل الخطة المحفوظة. إن لم توجد، تبقى الخطة null → تظهر شاشة الميزانية أولاً.
  const { data: saved, isLoading } = useQuery({
    queryKey: ['weddingPlan', user?.uid],
    queryFn:  () => getWeddingPlan(user!.uid),
    enabled:  !!user,
  });

  useEffect(() => {
    if (isLoading || plan) return;
    if (saved) setPlan(saved); // مستخدم عائد له خطة محفوظة → ادخل المحرّر مباشرة
    // مستخدم جديد بلا خطة → نُبقي plan = null لتظهر شاشة البداية (الميزانية أولاً)
  }, [saved, isLoading, plan]);

  const saveMutation = useMutation({
    mutationFn: (p: WeddingPlan) => saveWeddingPlan(user!.uid, p),
    onSuccess:  () => { setSaveState('saved'); qc.invalidateQueries({ queryKey: ['weddingPlan', user?.uid] }); },
  });

  // بناء الخطة من شاشة البداية على ضوء الميزانية، ثم حفظها فوراً (فلا تتكرر شاشة البداية)
  function startPlan(tier: WeddingTier, budget?: number) {
    const p = buildPlan(tier, budget && budget > 0 ? budget : undefined);
    loadedRef.current = true;     // التعديلات اللاحقة ستُحفظ تلقائياً
    setForceGate(false);
    setPlan(p);
    saveMutation.mutate(p);       // حفظ فوري ليتجاوز المستخدم العائد شاشة البداية
  }

  // «ابدأ من جديد» — يعيد المستخدم لشاشة الميزانية مع تعبئة ميزانيته الحالية
  function restart() {
    setDraftBudget(plan?.budget ?? 0);
    setForceGate(true);
  }

  // حفظ تلقائي مؤجّل (1.2 ثانية بعد آخر تعديل)
  useEffect(() => {
    if (!plan || !user) return;
    if (!loadedRef.current) { loadedRef.current = true; return; } // تجاهل أول تحميل
    setSaveState('saving');
    const t = setTimeout(() => saveMutation.mutate(plan), 1200);
    return () => clearTimeout(t);
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── الحسابات ──
  const incomeMonthly = (incomes ?? []).filter(i => i.type === 'recurring').reduce((s,i) => s + i.amount, 0)
    || (userSettings?.profile?.monthlyIncome ?? 0);

  function respOf(id: string): WeddingResponsibility {
    return plan?.responsibilities[id] ?? (ALL_ITEMS.find(i => i.id === id)?.resp ?? 'groom');
  }
  function enabled(id: string) { return !(plan?.disabled[id]); }

  const buffetTotal = plan && enabled('buffet') ? plan.guests * plan.perGuest : 0;
  const itemsTotal  = plan ? ALL_ITEMS.filter(i => enabled(i.id)).reduce((s,i) => s + (plan.amounts[i.id] ?? 0), 0) : 0;
  const total       = itemsTotal + buffetTotal;

  // ── الميزانية: العمود الفقري للتخطيط ──
  const budget      = plan?.budget ?? 0;
  const hasBudget   = budget > 0;
  const remaining   = budget - total;          // موجب = متبقٍّ، سالب = تجاوز
  const overBudget  = hasBudget && remaining < 0;
  const budgetPct   = hasBudget ? (total / budget) * 100 : 0;

  const respTotals: Record<WeddingResponsibility, number> = { groom: 0, bride: 0, shared: 0 };
  if (plan) {
    for (const it of ALL_ITEMS) if (enabled(it.id)) respTotals[respOf(it.id)] += plan.amounts[it.id] ?? 0;
    if (enabled('buffet')) respTotals[respOf('buffet')] += buffetTotal;
  }

  const biggest = plan ? [
    ...ALL_ITEMS.filter(i => enabled(i.id)).map(i => ({ label: i.label, amount: plan.amounts[i.id] ?? 0 })),
    ...(enabled('buffet') ? [{ label: 'البوفيه', amount: buffetTotal }] : []),
  ].filter(x => x.amount > 0).sort((a,b) => b.amount - a.amount).slice(0, 5) : [];

  const incomeMonths = incomeMonthly > 0 ? total / incomeMonthly : 0;

  // ── محدّثات الحالة ──
  function update(mut: (p: WeddingPlan) => WeddingPlan) {
    setPlan(p => p ? { ...mut(p), updatedAt: new Date().toISOString() } : p);
  }
  const setAmount = (id: string, v: number) => update(p => ({ ...p, amounts: { ...p.amounts, [id]: v } }));
  const setResp   = (id: string, v: WeddingResponsibility) => update(p => ({ ...p, responsibilities: { ...p.responsibilities, [id]: v } }));
  const toggle    = (id: string) => update(p => ({ ...p, disabled: { ...p.disabled, [id]: !p.disabled[id] } }));
  const setBudget = (v: number) => update(p => ({ ...p, budget: v }));

  function applyTier(tier: WeddingTier) {
    // المستوى يملأ مبالغ البنود فقط — لا يمسّ ميزانية المستخدم
    const base = buildPlan(tier, plan?.budget);
    setPlan(base);
    setTierToApply(null);
  }

  function share() {
    const lines = [
      '🎉 خطة تكاليف زواجي',
      '',
      hasBudget ? `الميزانية: ${fmt(budget)} د.ع` : '',
      `الإجمالي: ${fmt(total)} د.ع`,
      hasBudget ? (overBudget ? `تجاوز الميزانية: ${fmt(-remaining)} د.ع` : `المتبقّي: ${fmt(remaining)} د.ع`) : '',
      '',
      'التوزيع:',
      `• العريس: ${fmt(respTotals.groom)} د.ع`,
      `• أهل العروس: ${fmt(respTotals.bride)} د.ع`,
      `• مشترك: ${fmt(respTotals.shared)} د.ع`,
      '',
      'عبر تطبيق تدبير',
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank');
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto px-1 pt-2 gap-2 animate-pulse">
        <div className="h-10 bg-muted rounded-xl" />
        {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded-2xl" />)}
      </div>
    );
  }

  // ── شاشة البداية: الميزانية أولاً — لا تظهر أي بنود قبل تحديدها ──
  if (!plan || forceGate) {
    const sug = draftBudget > 0 ? suggestTier(draftBudget) : null;
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto px-1">
        {/* Header */}
        <div className="flex items-center gap-3 px-1 pt-1 pb-2 shrink-0">
          {forceGate ? (
            <button onClick={() => setForceGate(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : (
            <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="h-6 w-6" />
            </Link>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-bold">حاسبة زواجي</h1>
            <p className="text-[11px] text-muted-foreground">لنبدأ بميزانيتك</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-5 pb-20">
          <div className="text-center px-2">
            <p className="text-2xl font-bold mb-2">كم رصدت لزواجك؟</p>
            <p className="text-sm text-muted-foreground">
              أدخل المبلغ الذي خصّصته، وسنبني لك خطة تناسبه — ثم تعدّلها بحرية.
            </p>
          </div>

          <div className="relative px-2">
            <input
              value={fmtInput(draftBudget)}
              onChange={e => setDraftBudget(parseAmt(e.target.value))}
              inputMode="numeric"
              autoFocus
              placeholder="مثال: 40,000,000"
              className="w-full bg-card border-2 border-border rounded-2xl pl-12 pr-4 py-4 text-xl text-right font-bold outline-none focus:border-primary" />
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
          </div>

          {draftBudget > 0 ? (
            <div className="px-2">
              <p className="text-xs text-center text-muted-foreground mb-2">
                ميزانيتك تناسب مستوى «{TIER_LABEL[sug!]}». اختر نقطة البداية:
              </p>
              <div className="flex gap-2">
                {(['economy','medium','luxury'] as WeddingTier[]).map(t => (
                  <button key={t} onClick={() => startPlan(t, draftBudget)}
                    className={`flex-1 py-3 rounded-xl font-semibold border flex flex-col items-center gap-0.5 transition-all ${
                      sug === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
                    }`}>
                    <span className="text-sm">{TIER_LABEL[t]}</span>
                    <span className="text-[10px] opacity-80">~{fmt(TIER_TOTAL[t] / 1000000)}م</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-2">
              <button onClick={() => startPlan('medium')}
                className="w-full py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground active:scale-[0.98] transition-all">
                ابدأ بدون تحديد ميزانية
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-2 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">حاسبة زواجي</h1>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            خطّط ميزانية زواجك
            {saveState === 'saving' && <span className="text-amber-500">· جارٍ الحفظ</span>}
            {saveState === 'saved'  && <span className="text-emerald-500">· محفوظ ✓</span>}
          </p>
        </div>
        <button onClick={restart}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 px-2 py-1 rounded-lg border border-border">
          <RotateCcw className="h-3.5 w-3.5" />
          ابدأ من جديد
        </button>
      </div>

      {/* تبويبان */}
      <div className="flex gap-1.5 px-1 mb-2 shrink-0">
        <button onClick={() => setTab('items')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
            tab === 'items' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
          }`}>
          <ListChecks className="h-3.5 w-3.5" />
          البنود
        </button>
        <button onClick={() => setTab('summary')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
            tab === 'summary' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
          }`}>
          <PieChart className="h-3.5 w-3.5" />
          الملخص
        </button>
      </div>

      {/* ══════ تبويب البنود ══════ */}
      {tab === 'items' && (
        <>
        <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-3 min-h-0 pb-3">

          {/* ① الميزانية أولاً — عمود التخطيط */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 shrink-0">
            <label className="text-sm font-semibold mb-1.5 block">
              كم رصدت لزواجك؟ <span className="text-muted-foreground font-normal text-xs">(اختياري)</span>
            </label>
            <div className="relative">
              <input
                value={fmtInput(plan.budget ?? 0)}
                onChange={e => setBudget(parseAmt(e.target.value))}
                inputMode="numeric"
                placeholder="مثال: 40,000,000"
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-right font-semibold outline-none focus:border-primary" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">د.ع</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {hasBudget ? 'سنوضّح لك كم تبقّى مع كل تعديل — تابع الشريط بالأسفل ↓' : 'حدّد ميزانيتك وسنساعدك على ضبط زواجك ضمنها.'}
            </p>
          </div>

          {/* ② ابدأ بمستوى — مع إجمالي كل مستوى واقتراح الأنسب للميزانية */}
          <div className="bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              ابدأ بمستوى جاهز
              {hasBudget && <span className="text-primary"> · الأنسب لميزانيتك: «{TIER_LABEL[suggestTier(budget)]}»</span>}
            </p>
            <div className="flex gap-2">
              {(['economy','medium','luxury'] as WeddingTier[]).map(t => {
                const isSuggested = hasBudget && suggestTier(budget) === t && plan.tier !== t;
                return (
                  <button key={t} onClick={() => setTierToApply(t)}
                    className={`flex-1 py-2 rounded-xl font-semibold transition-all border flex flex-col items-center gap-0.5 ${
                      plan.tier === t ? 'bg-primary text-primary-foreground border-primary'
                      : isSuggested ? 'bg-primary/5 text-foreground border-primary/40'
                      : 'bg-muted/40 text-muted-foreground border-border'
                    }`}>
                    <span className="text-[11px]">{TIER_LABEL[t]}</span>
                    <span className="text-[9px] opacity-80">~{fmt(TIER_TOTAL[t] / 1000000)}م</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">يملأ كل البنود بأرقام تقريبية ثم تعدّلها كما تشاء.</p>
          </div>

          {/* المجموعات */}
          {GROUPS.map(group => (
            <div key={group.id} className="bg-card border border-border rounded-2xl overflow-hidden shrink-0">
              <div className="px-4 py-2 bg-muted/30 border-b border-border">
                <p className="text-xs font-bold">{group.title}</p>
              </div>
              <div className="divide-y divide-border">
                {group.items.map(item => {
                  const on = enabled(item.id);
                  return (
                    <div key={item.id} className={`px-3 py-2.5 flex items-center gap-2 ${on ? '' : 'opacity-40'}`}>
                      {/* تفعيل/استبعاد */}
                      <button onClick={() => toggle(item.id)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          on ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                        {on && <Check className="h-3 w-3 text-primary-foreground" />}
                      </button>
                      <span className="text-xs flex-1 min-w-0 truncate">{item.label}</span>
                      <RespChip value={respOf(item.id)} onChange={v => setResp(item.id, v)} />
                      <div className="relative w-28 shrink-0">
                        <input
                          value={fmtInput(plan.amounts[item.id] ?? 0)}
                          onChange={e => setAmount(item.id, parseAmt(e.target.value))}
                          disabled={!on}
                          inputMode="numeric"
                          className="w-full bg-muted/50 border border-border rounded-lg pl-7 pr-2 py-1.5 text-xs text-right outline-none focus:border-primary disabled:opacity-50" />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">د.ع</span>
                      </div>
                    </div>
                  );
                })}

                {/* البوفيه — صف خاص داخل مجموعة المراسم */}
                {group.id === 'ceremony' && (
                  <div className={`px-3 py-2.5 ${enabled('buffet') ? '' : 'opacity-40'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => toggle('buffet')}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          enabled('buffet') ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                        {enabled('buffet') && <Check className="h-3 w-3 text-primary-foreground" />}
                      </button>
                      <span className="text-xs flex-1 font-medium">البوفيه</span>
                      <RespChip value={respOf('buffet')} onChange={v => setResp('buffet', v)} />
                      <span className="text-xs font-bold shrink-0">{fmt(plan.guests * plan.perGuest)} د.ع</span>
                    </div>
                    <div className="flex gap-2 pr-7">
                      <div className="flex-1">
                        <label className="text-[9px] text-muted-foreground block mb-0.5">عدد المدعوين</label>
                        <input value={fmtInput(plan.guests)} onChange={e => update(p => ({ ...p, guests: parseAmt(e.target.value) }))}
                          disabled={!enabled('buffet')} inputMode="numeric"
                          className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs text-right outline-none focus:border-primary disabled:opacity-50" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-muted-foreground block mb-0.5">تكلفة الفرد</label>
                        <input value={fmtInput(plan.perGuest)} onChange={e => update(p => ({ ...p, perGuest: parseAmt(e.target.value) }))}
                          disabled={!enabled('buffet')} inputMode="numeric"
                          className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs text-right outline-none focus:border-primary disabled:opacity-50" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

        </div>

        {/* ③ الشريط الثابت — الإجمالي مقابل الميزانية (يتحدّث لحظياً) */}
        <div className="shrink-0 px-1 pb-1">
          <div className={`rounded-2xl px-4 py-2.5 border ${
            overBudget ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800' : 'bg-card border-border'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">الإجمالي</p>
                <p className="text-lg font-bold leading-none">{fmt(total)} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span></p>
              </div>
              {hasBudget && (
                <div className="text-left">
                  <p className="text-[10px] text-muted-foreground">{overBudget ? 'تجاوزت الميزانية' : 'المتبقّي'}</p>
                  <p className={`text-lg font-bold leading-none ${overBudget ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {fmt(Math.abs(remaining))} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span>
                  </p>
                </div>
              )}
            </div>
            {hasBudget && (
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden flex justify-end" dir="rtl">
                <div className={`h-full rounded-full transition-all ${
                  overBudget ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                }`} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* ══════ تبويب الملخص ══════ */}
      {tab === 'summary' && (
        <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-20">

          {/* الإجمالي + مقارنة الميزانية */}
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">إجمالي التكاليف</p>
            <p className="text-3xl font-bold leading-none">{fmt(total)} <span className="text-sm font-normal text-muted-foreground">د.ع</span></p>

            {hasBudget && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">ميزانيتك</span>
                  <span className="font-semibold">{fmt(budget)} د.ع</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden flex justify-end" dir="rtl">
                  <div className={`h-full rounded-full ${overBudget ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(budgetPct, 100)}%` }} />
                </div>
                <div className={`rounded-xl px-3 py-2 flex items-center justify-between ${
                  overBudget ? 'bg-red-50 dark:bg-red-950/20' : 'bg-emerald-50 dark:bg-emerald-950/20'
                }`}>
                  <span className="text-xs font-semibold">{overBudget ? 'تجاوزت الميزانية' : 'متبقٍّ من ميزانيتك'}</span>
                  <span className={`text-lg font-bold ${overBudget ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {fmt(Math.abs(remaining))} د.ع
                  </span>
                </div>
              </div>
            )}

            {incomeMonthly > 0 && (
              <p className="text-[11px] text-muted-foreground mt-3 text-center">
                يعادل دخل <span className="font-bold text-foreground">{incomeMonths.toFixed(1)}</span> شهر من دخلك الحالي
              </p>
            )}
          </div>

          {/* توزيع المسؤولية */}
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-3">من يدفع كم؟</p>
            <div className="flex flex-col gap-2.5">
              {(['groom','bride','shared'] as WeddingResponsibility[]).map(r => {
                const amt = respTotals[r];
                const pct = total > 0 ? (amt / total) * 100 : 0;
                return (
                  <div key={r}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${RESP_META[r].dot}`} />
                        {RESP_META[r].label}
                      </span>
                      <span className="text-xs font-bold">{fmt(amt)} <span className="text-[10px] font-normal text-muted-foreground">د.ع · {pct.toFixed(0)}%</span></span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex justify-end">
                      <div className={`h-full rounded-full ${RESP_META[r].dot}`} style={{ width: `${Math.min(pct,100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* أكبر البنود */}
          {biggest.length > 0 && (
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <p className="text-xs text-muted-foreground mb-3">أين تذهب أموالك؟ (أكبر ٥ بنود)</p>
              <div className="flex flex-col gap-2">
                {biggest.map((b, i) => {
                  const pct = total > 0 ? (b.amount / total) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs">{b.label}</span>
                        <span className="text-xs font-semibold">{fmt(b.amount)} <span className="text-[10px] font-normal text-muted-foreground">· {pct.toFixed(0)}%</span></span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex justify-end">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(pct,100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* مشاركة */}
          <button onClick={share}
            className="w-full py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
            <Share2 className="h-4 w-4" />
            مشاركة الخطة عبر واتساب
          </button>
        </div>
      )}

      {tierToApply && (
        <TierConfirm tier={tierToApply} onConfirm={() => applyTier(tierToApply)} onCancel={() => setTierToApply(null)} />
      )}
    </div>
  );
}
