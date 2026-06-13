'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { getWeddingPlan, saveWeddingPlan } from '@/services/firestore';
import { ChevronRight, ListChecks, PieChart, Share2, Check, AlertTriangle } from 'lucide-react';
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
const GIFTS: Record<WeddingTier, number> = { economy: 3000000, medium: 8000000, luxury: 20000000 };

const TIER_LABEL: Record<WeddingTier, string> = { economy: 'اقتصادي', medium: 'متوسط', luxury: 'فخم' };

const RESP_META: Record<WeddingResponsibility, { label: string; cls: string; dot: string }> = {
  groom:  { label: 'العريس',     cls: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30',     dot: 'bg-blue-500' },
  bride:  { label: 'أهل العروس', cls: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30',     dot: 'bg-rose-500' },
  shared: { label: 'مشترك',      cls: 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30', dot: 'bg-violet-500' },
};
const RESP_CYCLE: WeddingResponsibility[] = ['groom', 'bride', 'shared'];

function fmt(n: number) { return Math.round(n).toLocaleString('en-US'); }
function fmtInput(raw: number) { return raw ? raw.toLocaleString('en-US') : ''; }
function parseAmt(s: string) { return parseInt(s.replace(/,/g, '').replace(/\D/g, '') || '0') || 0; }

function buildPlan(tier: WeddingTier): WeddingPlan {
  const k = TIER_KEY[tier];
  const amounts: Record<string, number> = {};
  const responsibilities: Record<string, WeddingResponsibility> = {};
  for (const it of ALL_ITEMS) { amounts[it.id] = it[k]; responsibilities[it.id] = it.resp; }
  responsibilities['buffet'] = 'groom';
  return {
    amounts, responsibilities, disabled: {},
    guests: BUFFET.guests[tier], perGuest: BUFFET.perGuest[tier],
    gifts: GIFTS[tier], tier, updatedAt: new Date().toISOString(),
  };
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
  const loadedRef = useRef(false);

  // تحميل الخطة المحفوظة (أو بناء مستوى متوسط لأول مرة)
  const { data: saved, isLoading } = useQuery({
    queryKey: ['weddingPlan', user?.uid],
    queryFn:  () => getWeddingPlan(user!.uid),
    enabled:  !!user,
  });

  useEffect(() => {
    if (isLoading || plan) return;
    setPlan(saved ?? buildPlan('medium'));
  }, [saved, isLoading, plan]);

  const saveMutation = useMutation({
    mutationFn: (p: WeddingPlan) => saveWeddingPlan(user!.uid, p),
    onSuccess:  () => { setSaveState('saved'); qc.invalidateQueries({ queryKey: ['weddingPlan', user?.uid] }); },
  });

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
  const gifts       = plan?.gifts ?? 0;
  const net         = Math.max(0, total - gifts);

  const respTotals: Record<WeddingResponsibility, number> = { groom: 0, bride: 0, shared: 0 };
  if (plan) {
    for (const it of ALL_ITEMS) if (enabled(it.id)) respTotals[respOf(it.id)] += plan.amounts[it.id] ?? 0;
    if (enabled('buffet')) respTotals[respOf('buffet')] += buffetTotal;
  }

  const biggest = plan ? [
    ...ALL_ITEMS.filter(i => enabled(i.id)).map(i => ({ label: i.label, amount: plan.amounts[i.id] ?? 0 })),
    ...(enabled('buffet') ? [{ label: 'البوفيه', amount: buffetTotal }] : []),
  ].filter(x => x.amount > 0).sort((a,b) => b.amount - a.amount).slice(0, 5) : [];

  const incomeMonths = incomeMonthly > 0 ? net / incomeMonthly : 0;

  // ── محدّثات الحالة ──
  function update(mut: (p: WeddingPlan) => WeddingPlan) {
    setPlan(p => p ? { ...mut(p), updatedAt: new Date().toISOString() } : p);
  }
  const setAmount = (id: string, v: number) => update(p => ({ ...p, amounts: { ...p.amounts, [id]: v } }));
  const setResp   = (id: string, v: WeddingResponsibility) => update(p => ({ ...p, responsibilities: { ...p.responsibilities, [id]: v } }));
  const toggle    = (id: string) => update(p => ({ ...p, disabled: { ...p.disabled, [id]: !p.disabled[id] } }));

  function applyTier(tier: WeddingTier) {
    const base = buildPlan(tier);
    setPlan(base);
    setTierToApply(null);
  }

  function share() {
    const lines = [
      '🎉 خطة تكاليف الزواج',
      '',
      `الإجمالي: ${fmt(total)} د.ع`,
      gifts > 0 ? `النقوط المتوقعة: -${fmt(gifts)} د.ع` : '',
      `الصافي المطلوب: ${fmt(net)} د.ع`,
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

  if (isLoading || !plan) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto px-1 pt-2 gap-2 animate-pulse">
        <div className="h-10 bg-muted rounded-xl" />
        {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded-2xl" />)}
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
          <h1 className="text-lg font-bold">حاسبة الزواج</h1>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            خطّط ميزانية زواجك
            {saveState === 'saving' && <span className="text-amber-500">· جارٍ الحفظ</span>}
            {saveState === 'saved'  && <span className="text-emerald-500">· محفوظ ✓</span>}
          </p>
        </div>
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
        <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-3 min-h-0 pb-20">

          {/* اختيار المستوى */}
          <div className="bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground mb-2">ابدأ بمستوى جاهز</p>
            <div className="flex gap-2">
              {(['economy','medium','luxury'] as WeddingTier[]).map(t => (
                <button key={t} onClick={() => setTierToApply(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    plan.tier === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-muted-foreground border-border'
                  }`}>
                  {TIER_LABEL[t]}
                </button>
              ))}
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

          {/* النقوط المتوقعة */}
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-4 py-3 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">النقوط المتوقعة</p>
                <p className="text-[10px] text-muted-foreground">تُطرح من الإجمالي</p>
              </div>
              <div className="relative w-32 shrink-0">
                <input value={fmtInput(plan.gifts)} onChange={e => update(p => ({ ...p, gifts: parseAmt(e.target.value) }))}
                  inputMode="numeric"
                  className="w-full bg-background border border-emerald-300 dark:border-emerald-700 rounded-lg pl-7 pr-2 py-2 text-xs text-right outline-none focus:border-emerald-500" />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">د.ع</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ تبويب الملخص ══════ */}
      {tab === 'summary' && (
        <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-20">

          {/* الإجمالي والصافي */}
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">إجمالي التكاليف</p>
            <p className="text-3xl font-bold leading-none">{fmt(total)} <span className="text-sm font-normal text-muted-foreground">د.ع</span></p>
            {gifts > 0 && (
              <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="text-emerald-600 dark:text-emerald-400">− النقوط المتوقعة: {fmt(gifts)}</span>
              </div>
            )}
            <div className="mt-2 bg-primary/5 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold">الصافي المطلوب</span>
              <span className="text-lg font-bold text-primary">{fmt(net)} د.ع</span>
            </div>
            {incomeMonthly > 0 && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                يعادل دخل {incomeMonths.toFixed(1)} شهر من دخلك الحالي
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
