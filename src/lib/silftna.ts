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
