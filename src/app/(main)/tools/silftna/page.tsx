'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import {
  getSilftnaList, getSilftna, addSilftna, updateSilftna, deleteSilftna,
} from '@/services/firestore';
import {
  totalShares, cycleAmount, memberDuePerCycle, generateSchedule, silftnaTotals,
  swapCycles, clearanceReport, silftnaDashboard, reserveStats,
} from '@/lib/silftna';
import {
  ChevronRight, Plus, Users, Trash2, X, ArrowUp, ArrowDown, Shuffle,
  Check, MessageCircle, Calendar, Wallet, AlertTriangle, Crown, ArrowLeftRight, FileText,
  LayoutDashboard, TrendingUp, Bell,
} from 'lucide-react';
import Link from 'next/link';
import type {
  Silftna, SilftnaMember, SilftnaPeriod, SilftnaMethod, SilftnaPaymentStatus,
  SilftnaMemberStatus,
} from '@/types';

// ── مساعدات ───────────────────────────────────────────────────
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const uid4 = () => Math.random().toString(36).slice(2, 9);

const PERIOD_LABEL: Record<SilftnaPeriod, string> = {
  daily: 'يومي', weekly: 'أسبوعي', biweekly: 'نصف شهري', monthly: 'شهري',
};
const METHOD_LABEL: Record<SilftnaMethod, string> = {
  lottery: 'قرعة', registration: 'حسب التسجيل', manual: 'ترتيب يدوي',
};

const MEMBER_STATUS: Record<SilftnaMemberStatus, { label: string; cls: string }> = {
  'active':    { label: 'فعّال',    cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  'late':      { label: 'متأخر',    cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  'at-risk':   { label: 'في المخاطر', cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  'withdrawn': { label: 'منسحب',    cls: 'bg-muted text-muted-foreground' },
  'excluded':  { label: 'مستبعَد',  cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  'completed': { label: 'مكتمل',    cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
};
const STATUS_CYCLE: SilftnaMemberStatus[] = ['active', 'late', 'at-risk', 'withdrawn', 'excluded'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtInput(raw: number) { return raw ? raw.toLocaleString('en-US') : ''; }
function parseAmt(s: string) { return parseInt(s.replace(/,/g, '').replace(/\D/g, '') || '0') || 0; }

// ═══════════════ رسائل واتساب الجاهزة ═══════════════
function waLaunch(s: Silftna, m: SilftnaMember, order: number, date: string, amount: number) {
  return `أهلاً ${m.name}، تمت إضافتك لسلفة "${s.name}". دورك في الاستلام بتاريخ ${fmtDate(date)} بمبلغ ${fmt(amount)} د.ع. ترتيبك: ${order}. نرجو الالتزام بمواعيد الدفع. شكراً.`;
}
function waReminder(s: Silftna, cycleIndex: number, date: string, amount: number) {
  return `السلام عليكم، نذكّركم بأن قسط سلفة "${s.name}" رقم (${cycleIndex}) يستحق بتاريخ ${fmtDate(date)} بمبلغ ${fmt(amount)} د.ع. شكراً لتعاونكم.`;
}
function waDelivered(s: Silftna, m: SilftnaMember, amount: number) {
  return `ألف مبروك ${m.name}، تم تسليمك مبلغ السلفة الكامل (${fmt(amount)} د.ع). تتهنّى بيهم!`;
}
function openWA(phone: string | undefined, text: string) {
  const p = phone?.replace(/\D/g, '');
  window.open(p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// ═══════════════ تأكيد الحذف ═══════════════
function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pb-16">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-background rounded-2xl border border-border px-5 py-5 w-full max-w-xs z-10">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="font-semibold text-sm">{title}</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{body}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">إلغاء</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ الصفحة ═══════════════════════
type View = { name: 'list' } | { name: 'create' } | { name: 'detail'; id: string };

export default function SilftnaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ name: 'list' });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['silftna', user?.uid],
    queryFn:  () => getSilftnaList(user!.uid),
    enabled:  !!user,
  });

  if (view.name === 'create') {
    return <CreateView onDone={(id) => { qc.invalidateQueries({ queryKey: ['silftna', user?.uid] }); setView(id ? { name: 'detail', id } : { name: 'list' }); }} onCancel={() => setView({ name: 'list' })} />;
  }
  if (view.name === 'detail') {
    return <DetailView id={view.id} onBack={() => { qc.invalidateQueries({ queryKey: ['silftna', user?.uid] }); setView({ name: 'list' }); }} />;
  }

  // ── قائمة السلف ──
  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">
      <div className="flex items-center gap-3 px-1 pt-1 pb-3 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">سلفتنا</h1>
          <p className="text-[11px] text-muted-foreground">أدِر سلفك الدوّارة بسهولة</p>
        </div>
        <button onClick={() => setView({ name: 'create' })}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform">
          <Plus className="h-3.5 w-3.5" /> سلفة جديدة
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-4">
        {isLoading && [1,2].map(i => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}

        {!isLoading && list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl mb-3">🤝</p>
            <p className="text-sm text-muted-foreground">لا توجد سلف بعد</p>
            <button onClick={() => setView({ name: 'create' })}
              className="mt-3 text-xs text-primary border border-primary/30 rounded-xl px-4 py-2">
              أنشئ أول سلفة
            </button>
          </div>
        )}

        {list.map(s => {
          const t = silftnaTotals(s);
          return (
            <button key={s.id} onClick={() => setView({ name: 'detail', id: s.id })}
              className="bg-card border border-border rounded-2xl px-4 py-3 text-right active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">{s.name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-lg ${
                  s.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : s.status === 'active' ? 'bg-primary/10 text-primary'
                  : s.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-muted text-muted-foreground'
                }`}>
                  {s.status === 'completed' ? 'مكتملة' : s.status === 'active' ? 'نشطة' : s.status === 'cancelled' ? 'ملغاة' : 'مسودّة'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{s.members.length} عضو</span>
                <span className="flex items-center gap-1"><Wallet className="h-3 w-3" />{fmt(s.installment)} د.ع / {PERIOD_LABEL[s.period]}</span>
              </div>
              {s.status !== 'draft' && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex justify-end">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${t.progress}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{t.delivered} من {t.cycles} دورة · {t.progress}%</p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════ إنشاء سلفة ═══════════════════════
function CreateView({ onDone, onCancel }: { onDone: (id: string | null) => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // الخطوة 1: البيانات الأساسية
  const [name, setName] = useState('');
  const [installmentRaw, setInstallmentRaw] = useState('');
  const [period, setPeriod] = useState<SilftnaPeriod>('monthly');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<SilftnaMethod>('lottery');
  const [reservePercent, setReservePercent] = useState(0);
  const installment = parseAmt(installmentRaw);

  // الخطوة 2: الأعضاء
  const [members, setMembers] = useState<SilftnaMember[]>([]);
  const [mName, setMName] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mShares, setMShares] = useState(1);

  // الخطوة 3: الترتيب
  const [order, setOrder] = useState<string[]>([]);
  const [lotteryDone, setLotteryDone] = useState(false);

  const addMutation = useMutation({
    mutationFn: (data: Omit<Silftna, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => addSilftna(user!.uid, data),
    onSuccess:  (id) => onDone(id),
  });

  function addMember() {
    if (!mName.trim()) return;
    setMembers(p => [...p, { id: uid4(), name: mName.trim(), phone: mPhone.trim() || undefined, shares: mShares, status: 'active' }]);
    setMName(''); setMPhone(''); setMShares(1);
  }
  function removeMember(id: string) { setMembers(p => p.filter(m => m.id !== id)); }

  function goToOrder() {
    // ترتيب مبدئي حسب التسجيل
    setOrder(members.map(m => m.id));
    setLotteryDone(method !== 'lottery');
    setStep(3);
  }

  function runLottery() {
    const shuffled = [...members].sort(() => Math.random() - 0.5).map(m => m.id);
    setOrder(shuffled);
    setLotteryDone(true);
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setOrder(p => {
      const next = [...p];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return p;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function finalize() {
    const schedule = generateSchedule(members, order, installment, startDate, period);
    addMutation.mutate({
      name: name.trim(), installment, currency: 'IQD', period, startDate, method,
      reservePercent, status: 'active', members, schedule, payments: [], reserveSpends: [],
    });
  }

  const shares = totalShares(members);
  const perCycle = cycleAmount(installment, members);
  const memberById = (id: string) => members.find(m => m.id === id);

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-2 shrink-0">
        <button onClick={() => step === 1 ? onCancel() : setStep(step - 1)} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">سلفة جديدة</h1>
          <p className="text-[11px] text-muted-foreground">الخطوة {step} من 3</p>
        </div>
      </div>

      {/* مؤشر الخطوات */}
      <div className="flex gap-1.5 px-1 mb-3 shrink-0">
        {[1,2,3].map(i => (
          <div key={i} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-3 min-h-0 pb-24">

        {/* ── الخطوة 1 ── */}
        {step === 1 && (
          <>
            <div className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-col gap-3 shrink-0">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">اسم السلفة *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: سلفة الأصدقاء"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">قيمة القسط الواحد *</label>
                <div className="relative">
                  <input value={fmtInput(installment)} onChange={e => setInstallmentRaw(e.target.value)} inputMode="numeric" placeholder="مثال: 100,000"
                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm text-right outline-none focus:border-primary" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">دورية الدفع</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['daily','weekly','biweekly','monthly'] as SilftnaPeriod[]).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`py-2 rounded-lg text-[11px] font-medium transition-all ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {PERIOD_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">تاريخ أول دفعة</label>
                <input value={startDate} onChange={e => setStartDate(e.target.value)} type="date"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">طريقة تحديد الأدوار</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['lottery','registration','manual'] as SilftnaMethod[]).map(m => (
                    <button key={m} onClick={() => setMethod(m)}
                      className={`py-2 rounded-lg text-[11px] font-medium transition-all ${method === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {METHOD_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  الصندوق الاحتياطي
                  <span className="mr-1 text-[10px] opacity-60">(نسبة تُضاف على كل قسط — 0 = معطّل)</span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 1, 2, 3, 5].map(p => (
                    <button key={p} onClick={() => setReservePercent(p)}
                      className={`py-2 rounded-lg text-[11px] font-medium transition-all ${reservePercent === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {p === 0 ? 'بدون' : `${p}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── الخطوة 2: الأعضاء ── */}
        {step === 2 && (
          <>
            <div className="bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
              <p className="text-xs font-semibold text-muted-foreground mb-2">إضافة عضو</p>
              <div className="flex flex-col gap-2">
                <input value={mName} onChange={e => setMName(e.target.value)} placeholder="اسم العضو *"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-right outline-none focus:border-primary" />
                <input value={mPhone} onChange={e => setMPhone(e.target.value)} type="tel" placeholder="رقم الواتساب (اختياري) — 9647..." dir="ltr"
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">عدد الأسهم</span>
                    <button onClick={() => setMShares(s => Math.max(1, s - 1))} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center">−</button>
                    <span className="text-sm font-bold w-5 text-center">{mShares}</span>
                    <button onClick={() => setMShares(s => Math.min(10, s + 1))} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center">+</button>
                  </div>
                  <button onClick={addMember} disabled={!mName.trim()}
                    className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-40">
                    <Plus className="h-3.5 w-3.5" /> إضافة
                  </button>
                </div>
              </div>
            </div>

            {members.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shrink-0">
                <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-bold">الأعضاء ({members.length})</p>
                  <p className="text-[10px] text-muted-foreground">مجموع الأسهم: {shares}</p>
                </div>
                <div className="divide-y divide-border">
                  {members.map(m => (
                    <div key={m.id} className="px-3 py-2.5 flex items-center gap-2">
                      <span className="text-xs flex-1">{m.name}{m.shares > 1 && <span className="text-[10px] text-primary mr-1">({m.shares} أسهم)</span>}</span>
                      {m.phone && <MessageCircle className="h-3 w-3 text-emerald-500" />}
                      <button onClick={() => removeMember(m.id)} className="text-muted-foreground/40 hover:text-destructive p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {members.length > 0 && installment > 0 && (
              <div className="bg-primary/5 rounded-2xl px-4 py-3 shrink-0 text-center">
                <p className="text-[11px] text-muted-foreground">مدة السلفة {shares} دورة · المبلغ كل دورة</p>
                <p className="text-xl font-bold text-primary">{fmt(perCycle)} د.ع</p>
              </div>
            )}
          </>
        )}

        {/* ── الخطوة 3: الترتيب ── */}
        {step === 3 && (
          <>
            {method === 'lottery' && (
              <button onClick={runLottery}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3 text-sm font-semibold active:scale-[0.98] shrink-0">
                <Shuffle className="h-4 w-4" /> {lotteryDone ? 'إعادة القرعة' : 'إجراء القرعة'}
              </button>
            )}
            {method === 'manual' && (
              <p className="text-[11px] text-muted-foreground text-center shrink-0">رتّب الأعضاء بالأسهم لأعلى/أسفل لتحديد دور الاستلام</p>
            )}

            <div className="bg-card border border-border rounded-2xl overflow-hidden shrink-0">
              <div className="px-4 py-2 bg-muted/30 border-b border-border">
                <p className="text-xs font-bold">ترتيب الاستلام</p>
              </div>
              <div className="divide-y divide-border">
                {order.map((id, idx) => {
                  const m = memberById(id);
                  if (!m) return null;
                  const medal = idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-700' : '';
                  return (
                    <div key={id} className="px-3 py-2.5 flex items-center gap-2">
                      <span className={`w-6 text-center text-xs font-bold ${medal}`}>{idx < 3 ? <Crown className="h-3.5 w-3.5 inline" /> : idx + 1}</span>
                      <span className="text-xs flex-1">{m.name}{m.shares > 1 && <span className="text-[10px] text-primary mr-1">({m.shares})</span>}</span>
                      {method === 'manual' && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="w-6 h-6 rounded border border-border flex items-center justify-center disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                          <button onClick={() => moveItem(idx, 1)} disabled={idx === order.length - 1} className="w-6 h-6 rounded border border-border flex items-center justify-center disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center shrink-0">
              أصحاب الأسهم المتعددة تُوزَّع خاناتهم تلقائياً بتباعد عند الاعتماد
            </p>
          </>
        )}
      </div>

      {/* أزرار التنقل — ثابتة */}
      <div className="shrink-0 px-2 pt-2 pb-3 border-t border-border bg-background flex gap-2">
        {step === 1 && (
          <button onClick={() => setStep(2)} disabled={!name.trim() || installment <= 0}
            className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">التالي: الأعضاء</button>
        )}
        {step === 2 && (
          <button onClick={goToOrder} disabled={members.length < 2}
            className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
            {members.length < 2 ? 'أضف عضوين على الأقل' : 'التالي: الترتيب'}
          </button>
        )}
        {step === 3 && (
          <button onClick={finalize} disabled={!lotteryDone || addMutation.isPending}
            className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
            {addMutation.isPending ? 'جارٍ الإنشاء...' : 'اعتماد وإنشاء السلفة'}
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════ لوحة المدير ═══════════════════════
function Dashboard({ s, onSpendReserve }: { s: Silftna; onSpendReserve: (amount: number, reason: string) => void }) {
  const d = silftnaDashboard(s);
  const reserve = reserveStats(s);
  const [spendOpen, setSpendOpen] = useState(false);
  const [spendAmt, setSpendAmt] = useState('');
  const [spendReason, setSpendReason] = useState('');

  function doSpend() {
    const amt = parseAmt(spendAmt);
    if (amt <= 0 || amt > reserve.balance) return;
    onSpendReserve(amt, spendReason);
    setSpendAmt(''); setSpendReason(''); setSpendOpen(false);
  }

  return (
    <>
      {/* نسبة إنجاز السلفة */}
      <div className="bg-card border border-border rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">إنجاز السلفة</span>
          <span className="text-sm font-bold text-primary">{d.progress}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex justify-end">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${d.progress}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">{d.delivered} من {d.cycles} دورة مكتملة</p>
      </div>

      {/* جُمع / وُزِّع */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-border rounded-2xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">إجمالي ما جُمع</p>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{fmt(d.totalCollected)}</p>
          <p className="text-[9px] text-muted-foreground">د.ع</p>
        </div>
        <div className="bg-card border border-border rounded-2xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">إجمالي ما وُزِّع</p>
          <p className="text-base font-bold">{fmt(d.totalDistributed)}</p>
          <p className="text-[9px] text-muted-foreground">د.ع</p>
        </div>
      </div>

      {/* الدورة الحالية */}
      {d.current ? (
        <div className="bg-card border border-primary/40 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] text-muted-foreground">المستلم القادم</p>
              <p className="text-sm font-bold">{d.nextRecipientName}</p>
            </div>
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground">دورة {d.current.index} · {fmtDate(d.current.date)}</p>
              <p className="text-sm font-bold">{fmt(d.current.amount)} د.ع</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">جمع هذه الدورة</span>
            <span className="text-[10px] font-bold">{d.paidCount}/{d.membersCount} عضو · {d.cycleProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex justify-end">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.cycleProgress}%` }} />
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">🎉 اكتملت كل الدورات</p>
        </div>
      )}

      {/* المتأخرون */}
      {d.overdue.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">متأخرون عن الدورة الحالية ({d.overdue.length})</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {d.overdue.map(m => (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-xs">{m.name}</span>
                {m.phone && d.current && (
                  <button onClick={() => openWA(m.phone, waReminder(s, d.current!.index, d.current!.date, memberDuePerCycle(s.installment, m)))}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2 py-1 flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> تذكير
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الأكثر التزاماً */}
      {d.committed.length > 0 && (
        <div className="bg-card border border-border rounded-2xl px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-xs font-bold">الأكثر التزاماً</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {d.committed.map(m => (
              <span key={m.id} className="text-[11px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-lg">
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* الصندوق الاحتياطي */}
      {reserve.enabled && (
        <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-bold text-violet-700 dark:text-violet-400">الصندوق الاحتياطي</p>
              <p className="text-[10px] text-muted-foreground">{reserve.pct}% من كل دفعة</p>
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-violet-700 dark:text-violet-400">{fmt(reserve.balance)}</p>
              <p className="text-[9px] text-muted-foreground">الرصيد · د.ع</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
            <span>تراكم: {fmt(reserve.accrued)}</span>
            <span>مصروف: {fmt(reserve.spent)}</span>
          </div>

          {!spendOpen ? (
            <button onClick={() => setSpendOpen(true)} disabled={reserve.balance <= 0}
              className="w-full py-2 rounded-xl border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 text-xs font-medium disabled:opacity-40">
              تسجيل صرف من الصندوق
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <input value={fmtInput(parseAmt(spendAmt))} onChange={e => setSpendAmt(e.target.value)} inputMode="numeric" placeholder="المبلغ"
                  className="w-full bg-background border border-border rounded-lg pl-7 pr-2 py-2 text-xs text-right outline-none focus:border-violet-500" />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">د.ع</span>
              </div>
              <input value={spendReason} onChange={e => setSpendReason(e.target.value)} placeholder="السبب (تعويض، تأخير، طوارئ...)"
                className="w-full bg-background border border-border rounded-lg px-2 py-2 text-xs text-right outline-none focus:border-violet-500" />
              <div className="flex gap-2">
                <button onClick={() => { setSpendOpen(false); setSpendAmt(''); setSpendReason(''); }}
                  className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground">إلغاء</button>
                <button onClick={doSpend} disabled={parseAmt(spendAmt) <= 0 || parseAmt(spendAmt) > reserve.balance}
                  className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">صرف</button>
              </div>
            </div>
          )}

          {(s.reserveSpends ?? []).length > 0 && (
            <div className="mt-2 pt-2 border-t border-violet-200 dark:border-violet-800 flex flex-col gap-1">
              {(s.reserveSpends ?? []).slice(-3).reverse().map(sp => (
                <div key={sp.id} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground truncate">{sp.reason}</span>
                  <span className="text-violet-700 dark:text-violet-400 font-medium shrink-0">−{fmt(sp.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ═══════════════════════ تفاصيل السلفة ═══════════════════════
function DetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'dashboard' | 'schedule' | 'payments' | 'members'>('dashboard');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirst, setSwapFirst] = useState<number | null>(null);
  const [showClearance, setShowClearance] = useState(false);

  const { data: s, isLoading } = useQuery({
    queryKey: ['silftna', user?.uid, id],
    queryFn:  () => getSilftna(user!.uid, id),
    enabled:  !!user,
  });

  const patchMutation = useMutation({
    mutationFn: (patch: Partial<Silftna>) => updateSilftna(user!.uid, id, patch),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['silftna', user?.uid, id] }),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteSilftna(user!.uid, id),
    onSuccess:  () => onBack(),
  });

  if (isLoading || !s) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto px-1 pt-2 gap-2 animate-pulse">
        <div className="h-10 bg-muted rounded-xl" />
        {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-2xl" />)}
      </div>
    );
  }

  const t = silftnaTotals(s);
  const memberById = (mid: string) => s.members.find(m => m.id === mid);
  const currentCycle = s.schedule.find(c => !c.delivered) ?? null;

  // ── تسليم السلفة لمستلم دورة ──
  function deliverCycle(cycleIndex: number) {
    const schedule = s!.schedule.map(c => c.index === cycleIndex ? { ...c, delivered: true } : c);
    const allDone = schedule.every(c => c.delivered);
    patchMutation.mutate({ schedule, status: allDone ? 'completed' : 'active' });
  }

  // ── تحديث حالة دفع عضو في الدورة الحالية ──
  function setPayment(memberId: string, cycleIndex: number, status: SilftnaPaymentStatus) {
    const due = memberDuePerCycle(s!.installment, memberById(memberId)!);
    const others = s!.payments.filter(p => !(p.memberId === memberId && p.cycleIndex === cycleIndex));
    const paidAmount = status === 'paid' ? due : status === 'partial' ? Math.round(due / 2) : 0;
    patchMutation.mutate({ payments: [...others, { memberId, cycleIndex, status, paidAmount, recordedAt: new Date().toISOString() }] });
  }
  function paymentOf(memberId: string, cycleIndex: number): SilftnaPaymentStatus {
    return s!.payments.find(p => p.memberId === memberId && p.cycleIndex === cycleIndex)?.status ?? 'unpaid';
  }

  // ── تبديل الأدوار ──
  function handleCycleTap(cycleIndex: number, delivered: boolean) {
    if (!swapMode || delivered) return;
    if (swapFirst === null) { setSwapFirst(cycleIndex); return; }
    if (swapFirst === cycleIndex) { setSwapFirst(null); return; }
    patchMutation.mutate({ schedule: swapCycles(s!.schedule, swapFirst, cycleIndex) });
    setSwapFirst(null);
    setSwapMode(false);
  }

  // ── تغيير حالة العضو (يدوياً) ──
  function cycleMemberStatus(memberId: string) {
    const members = s!.members.map(m => {
      if (m.id !== memberId) return m;
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(m.status as SilftnaMemberStatus) + 1) % STATUS_CYCLE.length];
      return { ...m, status: next };
    });
    patchMutation.mutate({ members });
  }

  // ── إلغاء السلفة (مع تقرير تصفية) ──
  function cancelSilftna() {
    patchMutation.mutate({ status: 'cancelled' });
    setShowClearance(false);
  }
  const clearance = clearanceReport(s!);

  // ── صرف من الصندوق الاحتياطي ──
  function spendReserve(amount: number, reason: string) {
    const spend = { id: uid4(), amount, reason: reason.trim() || 'صرف', date: new Date().toISOString() };
    patchMutation.mutate({ reserveSpends: [...(s!.reserveSpends ?? []), spend] });
  }

  const TABS = [
    { key: 'dashboard' as const, label: 'اللوحة', icon: LayoutDashboard },
    { key: 'schedule'  as const, label: 'الجدول', icon: Calendar },
    { key: 'payments'  as const, label: 'الدفعات', icon: Wallet },
    { key: 'members'   as const, label: 'الأعضاء', icon: Users },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-md mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-2 shrink-0">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-6 w-6" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{s.name}</h1>
          <p className="text-[11px] text-muted-foreground">{fmt(s.installment)} د.ع / {PERIOD_LABEL[s.period]} · {t.shares} دورة</p>
        </div>
        <button onClick={() => setConfirmDelete(true)} className="text-muted-foreground/40 hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
      </div>

      {/* تبويبات */}
      <div className="flex gap-1.5 px-1 mb-2 shrink-0">
        {TABS.map(T => (
          <button key={T.key} onClick={() => setTab(T.key)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-medium transition-all ${tab === T.key ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}>
            <T.icon className="h-3.5 w-3.5" /> {T.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0 pb-4">
        {/* ── اللوحة ── */}
        {tab === 'dashboard' && <Dashboard s={s} onSpendReserve={spendReserve} />}

        {/* ── الجدول ── */}
        {tab === 'schedule' && s.status !== 'cancelled' && (
          <div className="flex items-center justify-between gap-2 shrink-0 mb-1">
            <button onClick={() => { setSwapMode(v => !v); setSwapFirst(null); }}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-xl border transition-all ${
                swapMode ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
              }`}>
              <ArrowLeftRight className="h-3.5 w-3.5" /> {swapMode ? 'اختر دورتين للتبديل' : 'تبديل الأدوار'}
            </button>
            {swapMode && <button onClick={() => { setSwapMode(false); setSwapFirst(null); }} className="text-[11px] text-muted-foreground">إلغاء</button>}
          </div>
        )}
        {tab === 'schedule' && s.schedule.map(c => {
          const m = memberById(c.memberId);
          const isCurrent = currentCycle?.index === c.index;
          const isSwapSel = swapFirst === c.index;
          const swappable = swapMode && !c.delivered;
          return (
            <div key={c.index}
              onClick={() => handleCycleTap(c.index, c.delivered)}
              className={`bg-card border rounded-2xl px-4 py-3 transition-all ${
                isSwapSel ? 'border-primary ring-2 ring-primary/30'
                : isCurrent ? 'border-primary'
                : c.delivered ? 'border-emerald-300 dark:border-emerald-700' : 'border-border'
              } ${swappable ? 'cursor-pointer active:scale-[0.99]' : ''} ${swapMode && c.delivered ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold shrink-0">{c.index}</span>
                  <div>
                    <p className="text-sm font-semibold">{m?.name ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(c.date)}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">{fmt(c.amount)}</p>
                  <p className="text-[9px] text-muted-foreground">د.ع</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                {c.delivered ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> سُلِّمت</span>
                ) : isCurrent ? (
                  <span className="text-[10px] text-primary font-medium">الدورة الحالية</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">قادمة</span>
                )}
                {!swapMode && (
                  <div className="flex items-center gap-1.5">
                    {m?.phone && (
                      <button onClick={(e) => { e.stopPropagation(); openWA(m.phone, waLaunch(s, m, c.index, c.date, c.amount)); }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2 py-1 flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> إشعار
                      </button>
                    )}
                    {!c.delivered && s.status !== 'cancelled' && (
                      <button onClick={(e) => { e.stopPropagation(); deliverCycle(c.index); }}
                        className="text-[10px] border border-border rounded-lg px-2 py-1 text-muted-foreground hover:border-primary hover:text-primary">
                        سجّل التسليم
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── الدفعات (الدورة الحالية) ── */}
        {tab === 'payments' && (
          currentCycle ? (
            <>
              <div className="bg-primary/5 rounded-2xl px-4 py-2.5 shrink-0 text-center">
                <p className="text-[11px] text-muted-foreground">دفعات الدورة {currentCycle.index} · المستلم: {memberById(currentCycle.memberId)?.name}</p>
                <p className="text-[10px] text-muted-foreground">استحقاق {fmtDate(currentCycle.date)}</p>
              </div>
              {s.members.map(m => {
                const st = paymentOf(m.id, currentCycle.index);
                const due = memberDuePerCycle(s.installment, m);
                return (
                  <div key={m.id} className="bg-card border border-border rounded-2xl px-4 py-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold">{m.name}{m.shares > 1 && <span className="text-[10px] text-primary mr-1">({m.shares} أسهم)</span>}</p>
                        <p className="text-[10px] text-muted-foreground">مستحق: {fmt(due)} د.ع</p>
                      </div>
                      {m.phone && (
                        <button onClick={() => openWA(m.phone, waReminder(s, currentCycle.index, currentCycle.date, due))}
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2 py-1 flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> تذكير
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['paid','partial','unpaid'] as SilftnaPaymentStatus[]).map(opt => (
                        <button key={opt} onClick={() => setPayment(m.id, currentCycle.index, opt)}
                          className={`py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                            st === opt
                              ? opt === 'paid' ? 'bg-emerald-500 text-white' : opt === 'partial' ? 'bg-amber-400 text-white' : 'bg-red-400 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                          {opt === 'paid' ? 'دفع' : opt === 'partial' ? 'جزئي' : 'لم يدفع'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-sm text-muted-foreground">اكتملت كل الدورات</p>
            </div>
          )
        )}

        {/* ── الأعضاء ── */}
        {tab === 'members' && (
          <>
            {s.members.map(m => {
              const receiveCount = s.schedule.filter(c => c.memberId === m.id).length;
              const meta = MEMBER_STATUS[m.status as SilftnaMemberStatus] ?? MEMBER_STATUS.active;
              return (
                <div key={m.id} className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{m.name}</p>
                      <button onClick={() => cycleMemberStatus(m.id)} className={`text-[9px] px-1.5 py-0.5 rounded-md shrink-0 ${meta.cls}`}>
                        {meta.label}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {m.shares > 1 ? `${m.shares} أسهم · يستلم ${receiveCount} مرات` : 'سهم واحد'}
                      {m.phone && ' · لديه واتساب'}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-muted text-muted-foreground shrink-0">
                    {fmt(memberDuePerCycle(s.installment, m))} د.ع/دورة
                  </span>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground text-center mt-1">اضغط على شارة الحالة لتغييرها</p>

            {/* تصفية/إلغاء السلفة */}
            {s.status !== 'cancelled' && (
              <button onClick={() => setShowClearance(true)}
                className="mt-2 w-full py-2.5 rounded-2xl border border-destructive/40 text-destructive text-xs font-medium flex items-center justify-center gap-2">
                <FileText className="h-3.5 w-3.5" /> تصفية وإلغاء السلفة
              </button>
            )}
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog title="حذف السلفة؟" body={`سيتم حذف "${s.name}" وكل سجلاتها نهائياً.`} confirmLabel="حذف"
          onConfirm={() => deleteMutation.mutate()} onCancel={() => setConfirmDelete(false)} />
      )}

      {/* ── تقرير التصفية ── */}
      {showClearance && (
        <div className="fixed inset-0 z-50 flex items-end pb-16">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowClearance(false)} />
          <div className="relative w-full max-w-md mx-auto bg-background rounded-t-3xl border-t border-border z-10 flex flex-col max-h-[80dvh]">
            <div className="shrink-0 px-5 pt-3 pb-2">
              <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">تقرير التصفية</h2>
                  <p className="text-[11px] text-muted-foreground">من له ومن عليه عند الإلغاء</p>
                </div>
                <button onClick={() => setShowClearance(false)} className="p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-2">
              <div className="bg-muted/30 rounded-xl px-3 py-2 mb-2 flex text-[10px] font-semibold text-muted-foreground">
                <span className="flex-1">العضو</span>
                <span className="w-20 text-center">دفع</span>
                <span className="w-20 text-center">استلم</span>
                <span className="w-24 text-center">الصافي</span>
              </div>
              {clearance.map(row => (
                <div key={row.memberId} className="flex items-center px-3 py-2 border-b border-border text-[11px]">
                  <span className="flex-1 font-medium truncate">{row.name}</span>
                  <span className="w-20 text-center text-muted-foreground">{fmt(row.paid)}</span>
                  <span className="w-20 text-center text-muted-foreground">{fmt(row.received)}</span>
                  <span className={`w-24 text-center font-bold ${row.net > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {row.net > 0 ? `له ${fmt(row.net)}` : row.net < 0 ? `عليه ${fmt(-row.net)}` : '—'}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                «له» = دفع أكثر مما استلم (يُستحق له فرق). «عليه» = استلم أكثر مما دفع (مطلوب منه فرق). استخدم هذا الجدول لإجراء تسوية مالية عادلة بين الأعضاء.
              </p>
            </div>

            <div className="shrink-0 px-5 pt-2 pb-4 border-t border-border bg-background flex gap-2">
              <button onClick={() => setShowClearance(false)} className="flex-1 py-3 rounded-2xl border border-border text-sm text-muted-foreground">رجوع</button>
              <button onClick={cancelSilftna} className="flex-1 py-3 rounded-2xl bg-destructive text-destructive-foreground text-sm font-semibold">تأكيد الإلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
