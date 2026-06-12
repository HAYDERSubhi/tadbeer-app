// Offline-first calculation functions for all financial tools

// ─── Installment + Cash vs Install ──────────────────────────────────────────

export type InstallmentResult = {
  monthly: number;
  total: number;
  interest: number;
  cashSaving: number;
  investmentGain: number;
  verdict: 'cash' | 'installment' | 'neutral';
};

export function calcInstallment(
  price: number,
  downPayment: number,
  months: number,
  interestRate: number,
  investmentReturn = 10
): InstallmentResult {
  const principal = price - downPayment;

  let monthly: number;
  let total: number;
  let interest: number;

  if (interestRate === 0) {
    monthly = principal / months;
    total = price;
    interest = 0;
  } else {
    const r = interestRate / 100 / 12;
    monthly = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    total = downPayment + monthly * months;
    interest = total - price;
  }

  // Cash vs install: invest monthly payment at annual investmentReturn%
  const monthlyReturn = investmentReturn / 100 / 12;
  const investmentGain =
    monthly * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn) - monthly * months;

  const cashSaving = interest;
  let verdict: 'cash' | 'installment' | 'neutral' = 'neutral';
  if (cashSaving > investmentGain + 500) verdict = 'cash';
  else if (investmentGain > cashSaving + 500) verdict = 'installment';

  return { monthly, total, interest, cashSaving, investmentGain, verdict };
}

// ─── Habit Cost ──────────────────────────────────────────────────────────────

const COMPARISONS = [
  { threshold: 500_000, label: 'هاتف Samsung A15', icon: '📱' },
  { threshold: 1_000_000, label: 'تذكرة سفر داخلية', icon: '✈️' },
  { threshold: 2_000_000, label: 'لابتوب اقتصادي', icon: '💻' },
  { threshold: 5_000_000, label: 'رحلة عائلية', icon: '🌍' },
  { threshold: 10_000_000, label: 'سيارة مستعملة', icon: '🚗' },
  { threshold: 50_000_000, label: 'دفعة أولى شقة', icon: '🏠' },
];

export type HabitResult = {
  monthly: number;
  yearly: number;
  fiveYears: number;
  tenYears: number;
  comparison: { label: string; icon: string } | null;
};

export function calcHabitCost(dailyCost: number): HabitResult {
  const monthly = dailyCost * 30;
  const yearly = dailyCost * 365;
  const fiveYears = yearly * 5;
  const tenYears = yearly * 10;

  const comparison = COMPARISONS.find(c => yearly <= c.threshold) ??
    COMPARISONS[COMPARISONS.length - 1];

  return { monthly, yearly, fiveYears, tenYears, comparison };
}

// ─── Worth It ────────────────────────────────────────────────────────────────

export type WorthItResult = {
  workDays: number;
  workHours: number;
  incomePercent: number;
  savingsPercent: number;
  verdict: 'comfortable' | 'consider' | 'careful';
};

export function calcWorthIt(
  price: number,
  monthlyIncome: number,
  savings = 0
): WorthItResult {
  const dailyIncome = monthlyIncome / 22;
  const workDays = price / dailyIncome;
  const workHours = workDays * 8;
  const incomePercent = (price / monthlyIncome) * 100;
  const savingsPercent = savings > 0 ? (price / savings) * 100 : 0;

  let verdict: WorthItResult['verdict'] = 'comfortable';
  if (incomePercent > 50) verdict = 'careful';
  else if (incomePercent > 20) verdict = 'consider';

  return { workDays, workHours, incomePercent, savingsPercent, verdict };
}

// ─── Wedding Budget ───────────────────────────────────────────────────────────

export type WeddingItem = { label: string; percent: number; amount: number; icon: string };

export function calcWeddingBudget(total: number): WeddingItem[] {
  const items: Omit<WeddingItem, 'amount'>[] = [
    { label: 'المهر', percent: 30, icon: '💍' },
    { label: 'قاعة الأفراح', percent: 25, icon: '🏛️' },
    { label: 'الذهب والمجوهرات', percent: 20, icon: '✨' },
    { label: 'الملابس والتجهيزات', percent: 10, icon: '👗' },
    { label: 'شهر العسل', percent: 10, icon: '🌙' },
    { label: 'متفرقات', percent: 5, icon: '📦' },
  ];
  return items.map(i => ({ ...i, amount: (total * i.percent) / 100 }));
}

// ─── Split Bill ───────────────────────────────────────────────────────────────

export type SplitPerson = { name: string; share: number };

export function calcSplitBill(total: number, people: SplitPerson[]): SplitPerson[] {
  const fixedTotal = people.reduce((sum, p) => sum + p.share, 0);
  if (fixedTotal === 0) {
    const equal = total / people.length;
    return people.map(p => ({ ...p, share: equal }));
  }
  return people;
}

export function buildWhatsAppMessage(total: number, people: SplitPerson[]): string {
  const lines = people.map(
    p => `• ${p.name}: ${Math.round(p.share).toLocaleString('ar-IQ')} د.ع`
  );
  return encodeURIComponent(
    `🍽️ تقسيم الفاتورة\nالإجمالي: ${Math.round(total).toLocaleString('ar-IQ')} د.ع\n\n${lines.join('\n')}\n\n— تطبيق تدبير`
  );
}
