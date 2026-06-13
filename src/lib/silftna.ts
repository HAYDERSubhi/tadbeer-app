// ═══════════ محرّك حسابات سلفتنا (دوال نقية قابلة للاختبار) ═══════════
import type { Silftna, SilftnaMember, SilftnaCycle, SilftnaPeriod } from '@/types';

// مجموع الأسهم = طول الجمعية (عدد الدورات)، لا عدد الأعضاء
export function totalShares(members: SilftnaMember[]): number {
  return members.reduce((s, m) => s + Math.max(1, m.shares || 1), 0);
}

// المبلغ المُجمَّع كل دورة = القسط × مجموع الأسهم (هو نفسه ما يستلمه كل مستلم)
export function cycleAmount(installment: number, members: SilftnaMember[]): number {
  return installment * totalShares(members);
}

// ما يدفعه عضو كل دورة = القسط × أسهمه
export function memberDuePerCycle(installment: number, member: SilftnaMember): number {
  return installment * Math.max(1, member.shares || 1);
}

// ── ترتيب الخانات: Smooth Weighted Round Robin ──
// يحافظ على ترتيب المدير عند تساوي الأسهم، ويباعد خانات صاحب الأسهم المتعددة بعدالة.
export function buildSlotOrder(members: SilftnaMember[], primaryOrderIds: string[]): string[] {
  // نرتّب الأعضاء حسب ترتيب المدير (للحسم عند التعادل)
  const ordered = primaryOrderIds
    .map(id => members.find(m => m.id === id))
    .filter((m): m is SilftnaMember => !!m);
  // أي عضو غير مذكور في الترتيب يُضاف في النهاية
  for (const m of members) if (!primaryOrderIds.includes(m.id)) ordered.push(m);

  const total = totalShares(ordered);
  const state = ordered.map(m => ({ id: m.id, weight: Math.max(1, m.shares || 1), current: 0 }));
  const slots: string[] = [];

  for (let i = 0; i < total; i++) {
    for (const s of state) s.current += s.weight;
    let best = state[0];
    for (const s of state) if (s.current > best.current) best = s;
    best.current -= total;
    slots.push(best.id);
  }
  return slots;
}

// ── حساب تاريخ الدورة n (0 = أول دورة = تاريخ البداية) ──
export function cycleDate(startDate: string, period: SilftnaPeriod, n: number): string {
  const start = new Date(startDate);
  const y = start.getUTCFullYear(), mo = start.getUTCMonth(), d = start.getUTCDate();

  let result: Date;
  if (period === 'daily')        result = new Date(Date.UTC(y, mo, d + n));
  else if (period === 'weekly')  result = new Date(Date.UTC(y, mo, d + n * 7));
  else if (period === 'biweekly')result = new Date(Date.UTC(y, mo, d + n * 14));
  else {
    // monthly — مع تثبيت آخر يوم في الأشهر القصيرة (فبراير ...)
    const target = new Date(Date.UTC(y, mo + n, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    result = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)));
  }
  return result.toISOString().split('T')[0];
}

// ── توليد الجدول الكامل من ترتيب الأعضاء ──
export function generateSchedule(
  members: SilftnaMember[],
  primaryOrderIds: string[],
  installment: number,
  startDate: string,
  period: SilftnaPeriod,
): SilftnaCycle[] {
  const slots  = buildSlotOrder(members, primaryOrderIds);
  const amount = cycleAmount(installment, members);
  return slots.map((memberId, i) => ({
    index: i + 1,
    memberId,
    amount,
    date: cycleDate(startDate, period, i),
    delivered: false,
  }));
}

// ── تبديل مستلِمَي دورتين (للدورات غير المُسلَّمة فقط) ──
export function swapCycles(schedule: SilftnaCycle[], indexA: number, indexB: number): SilftnaCycle[] {
  const a = schedule.find(c => c.index === indexA);
  const b = schedule.find(c => c.index === indexB);
  if (!a || !b || a.delivered || b.delivered) return schedule; // حارس: لا تبديل لدورة مُسلَّمة
  return schedule.map(c => {
    if (c.index === indexA) return { ...c, memberId: b.memberId };
    if (c.index === indexB) return { ...c, memberId: a.memberId };
    return c;
  });
}

// ── تقرير التصفية: من دفع كم، من استلم كم، والصافي لكل عضو ──
export type ClearanceRow = { memberId: string; name: string; paid: number; received: number; net: number };
export function clearanceReport(s: Silftna): ClearanceRow[] {
  return s.members.map(m => {
    const paid = s.payments
      .filter(p => p.memberId === m.id)
      .reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const received = s.schedule
      .filter(c => c.delivered && c.memberId === m.id)
      .reduce((sum, c) => sum + c.amount, 0);
    return { memberId: m.id, name: m.name, paid, received, net: paid - received };
  });
}

// ── إجماليات للوحة المدير ──
export function silftnaTotals(s: Silftna) {
  const shares = totalShares(s.members);
  const cycles = s.schedule.length || shares;
  const collectedThisRound = (cycleIndex: number) =>
    s.payments.filter(p => p.cycleIndex === cycleIndex).reduce((sum, p) => sum + p.paidAmount, 0);
  const delivered = s.schedule.filter(c => c.delivered).length;
  const progress  = cycles > 0 ? Math.round((delivered / cycles) * 100) : 0;
  return {
    shares,
    cycles,
    perCycle: cycleAmount(s.installment, s.members),
    delivered,
    progress,
    collectedThisRound,
  };
}

// ── الدورة الحالية (أول دورة غير مُسلَّمة) ──
export function currentCycleOf(s: Silftna) {
  return s.schedule.find(c => !c.delivered) ?? null;
}

// ── نقاط الثقة لعضو (تُحسب تلقائياً من سلوك الدفع، 0..100) ──
export function memberTrust(s: Silftna, memberId: string): { score: number; label: string; cls: string } {
  const m = s.members.find(x => x.id === memberId);
  const pastIndices = s.schedule.filter(c => c.delivered).map(c => c.index);
  const current = currentCycleOf(s);
  const today = new Date().setHours(0, 0, 0, 0);

  let score = 100;
  for (const ci of pastIndices) {
    const st = s.payments.find(p => p.memberId === memberId && p.cycleIndex === ci)?.status ?? 'unpaid';
    if (st === 'unpaid')  score -= 20;
    else if (st === 'partial') score -= 10;
  }
  // الدورة الحالية متأخرة وغير مدفوعة
  if (current && new Date(current.date).setHours(0,0,0,0) <= today) {
    const st = s.payments.find(p => p.memberId === memberId && p.cycleIndex === current.index)?.status ?? 'unpaid';
    if (st === 'unpaid')  score -= 10;
    else if (st === 'partial') score -= 5;
  }
  if (m?.status === 'excluded')  score -= 30;
  if (m?.status === 'withdrawn') score -= 15;

  score = Math.max(0, Math.min(100, score));
  const label = score >= 85 ? 'موثوق' : score >= 60 ? 'جيد' : score >= 40 ? 'متوسط' : 'ضعيف';
  const cls = score >= 85 ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
    : score >= 60 ? 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
    : score >= 40 ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
    : 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
  return { score, label, cls };
}

// ── الصندوق الاحتياطي: المتراكم − المصروف = الرصيد ──
export function reserveStats(s: Silftna) {
  const pct = s.reservePercent || 0;
  // يتراكم بنسبة من كل مبلغ مسدَّد فعلاً
  const accrued = pct > 0
    ? Math.round(s.payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0) * pct / 100)
    : 0;
  const spent = (s.reserveSpends ?? []).reduce((sum, x) => sum + (x.amount || 0), 0);
  return { enabled: pct > 0, pct, accrued, spent, balance: accrued - spent };
}

// ── تسميات عربية مساعدة للتقارير ──
const PERIOD_AR: Record<SilftnaPeriod, string> = { daily: 'يومي', weekly: 'أسبوعي', biweekly: 'نصف شهري', monthly: 'شهري' };
function arDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function arNum(n: number) { return Math.round(n).toLocaleString('en-US'); }

// ── تقرير نصّي شامل قابل للمشاركة (واتساب/نسخ) ──
export function silftnaReportText(s: Silftna): string {
  const t = silftnaTotals(s);
  const reserve = reserveStats(s);
  const lines: string[] = [];
  lines.push(`📋 تقرير سلفة "${s.name}"`);
  lines.push('');
  lines.push(`القسط: ${arNum(s.installment)} د.ع · الدورية: ${PERIOD_AR[s.period]}`);
  lines.push(`الأعضاء: ${s.members.length} · الدورات: ${t.cycles} · المبلغ/دورة: ${arNum(t.perCycle)} د.ع`);
  lines.push(`الإنجاز: ${t.delivered}/${t.cycles} دورة (${t.progress}%)`);
  if (reserve.enabled) lines.push(`الصندوق الاحتياطي: رصيد ${arNum(reserve.balance)} د.ع (${reserve.pct}%)`);
  lines.push('');
  lines.push('— جدول الاستلام —');
  for (const c of s.schedule) {
    const m = s.members.find(x => x.id === c.memberId);
    const mark = c.delivered ? '✅' : '⏳';
    lines.push(`${mark} دورة ${c.index}: ${m?.name ?? '—'} · ${arDate(c.date)} · ${arNum(c.amount)} د.ع`);
  }
  lines.push('');
  lines.push('عبر تطبيق تدبير — سلفتنا');
  return lines.join('\n');
}

// ── تصدير الجدول CSV (يفتح في Excel) ──
export function silftnaCSV(s: Silftna): string {
  const rows = [['الدورة', 'المستلم', 'المبلغ', 'التاريخ', 'الحالة']];
  for (const c of s.schedule) {
    const m = s.members.find(x => x.id === c.memberId);
    rows.push([String(c.index), m?.name ?? '', String(c.amount), c.date, c.delivered ? 'مُسلَّمة' : 'قادمة']);
  }
  // BOM لدعم العربية في Excel
  return '﻿' + rows.map(r => r.map(f => `"${f.replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ── لوحة المدير الإحصائية الشاملة ──
export function silftnaDashboard(s: Silftna) {
  const t = silftnaTotals(s);
  const current = currentCycleOf(s);

  // إجمالي ما جُمِع وما وُزِّع طوال السلفة
  const totalCollected = s.payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
  const totalDistributed = s.schedule.filter(c => c.delivered).reduce((sum, c) => sum + c.amount, 0);

  // حالة الدورة الحالية: من دفع كاملاً
  let paidCount = 0, dueThisCycle = 0, collectedThisCycle = 0;
  if (current) {
    for (const m of s.members) {
      const due = installmentDue(s.installment, m);
      dueThisCycle += due;
      const pay = s.payments.find(p => p.memberId === m.id && p.cycleIndex === current.index);
      collectedThisCycle += pay?.paidAmount ?? 0;
      if (pay?.status === 'paid') paidCount++;
    }
  }
  const cycleProgress = dueThisCycle > 0 ? Math.round((collectedThisCycle / dueThisCycle) * 100) : 0;

  // المتأخرون: الدورة الحالية مستحقة (مرّ تاريخها) ولم يدفعوا كاملاً
  const today = new Date().setHours(0, 0, 0, 0);
  const overdue = current && new Date(current.date).setHours(0, 0, 0, 0) <= today
    ? s.members.filter(m => {
        const pay = s.payments.find(p => p.memberId === m.id && p.cycleIndex === current.index);
        return (pay?.status ?? 'unpaid') !== 'paid';
      })
    : [];

  // الأكثر التزاماً: دفعوا «كاملاً» كل الدورات الماضية (المُسلَّمة)
  const pastIndices = s.schedule.filter(c => c.delivered).map(c => c.index);
  const committed = pastIndices.length === 0 ? [] : s.members.filter(m =>
    pastIndices.every(ci => s.payments.find(p => p.memberId === m.id && p.cycleIndex === ci)?.status === 'paid')
  );

  return {
    ...t,
    current,
    nextRecipientName: current ? (s.members.find(m => m.id === current.memberId)?.name ?? '—') : null,
    totalCollected,
    totalDistributed,
    paidCount,
    membersCount: s.members.length,
    cycleProgress,
    overdue,
    committed,
  };
}

function installmentDue(installment: number, m: SilftnaMember) { return installment * Math.max(1, m.shares || 1); }
