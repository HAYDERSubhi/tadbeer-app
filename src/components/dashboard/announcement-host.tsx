"use client";

// نافذة منبثقة قابلة للإغلاق للإعلانات داخل التطبيق — تحلّ محلّ بطاقة `IncomeIntroCard`
// الأفقية (2026-11-21، قرار المالك). نافذة واحدة في اليوم الواحد، ولا تتزاحم مع الجولة.
//
// نوعان:
//  • «دخل»: تعريف بميزة تسجيل الدخل. المنطق والمفاتيح **نفسها** القديمة حرفياً
//    (`income-intro-seen-<uid>` · `income-intro-eligible-<uid>` · أحداث `income_intro_*`)
//    كي لا تعود لمن رآها، ويبقى القياس متصلاً بما قبله.
//  • «تقييم»: دعوة لتقييم تدبير على Google Play — أندرويد فقط، بعد ٥ مصاريف في ٣ أيام
//    مختلفة على الأقل. تُعرض مرتين كحدّ أقصى لكل حساب (بينهما ٣٠ يوماً)، ولا تعود بعد
//    الضغط على «قيّم التطبيق».
//
// ⛔ لا يمكن حصر دعوة التقييم بمن ثبّت من المتجر: لا فرق يُلتقَط بين TWA والمتصفّح
//    (CLAUDE.md، قرار 2026-09-08). فهي لكل مستخدمي أندرويد بقرار المالك.
// ⛔ لا مكافأة ولا وعد مقابل التقييم، ولا تصفية («هل أعجبك؟ نعم/لا» ثم التوجيه) — سياسة Play.
// ⛔ كل مفاتيح localStorage هنا مربوطة بالحساب (فخّ ١) — لا تجعلها عامة.
// ⛔ لا تضف نافذة ثالثة بلا المرور بـ `pickPopup`: هو من يضمن «واحدة في اليوم».
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Star, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { track } from '@/lib/track';
import { isAndroid, openPlayReviews } from '@/lib/platform';
import type { Expense } from '@/types';

type Kind = 'income' | 'rating';

// ⛔ المفتاح نفسه في (main)/page.tsx — لا تغيّره في مكان دون الآخر.
const TOUR_KEY = 'tadbeer-onboarding-tour-v2';
const SHOW_DELAY_MS = 2500;
const RATING_MIN_EXPENSES = 5;
const RATING_MIN_DAYS = 3;
const RATING_MAX_ASKS = 2;
const RATING_RETRY_MS = 30 * 24 * 60 * 60 * 1000;

const incomeSeenKey = (uid: string) => `income-intro-seen-${uid}`;
const incomeEligibleKey = (uid: string) => `income-intro-eligible-${uid}`;
const ratingKey = (uid: string) => `rating-prompt-${uid}`;
const lastShownKey = (uid: string) => `announce-last-shown-${uid}`;

type RatingState = { n: number; state: 'done' | 'later'; at: number };

function readRating(uid: string): RatingState | null {
  try {
    const raw = localStorage.getItem(ratingKey(uid));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<RatingState>;
    if (typeof v.n !== 'number' || (v.state !== 'done' && v.state !== 'later')) return null;
    return { n: v.n, state: v.state, at: typeof v.at === 'number' ? v.at : 0 };
  } catch {
    return null;
  }
}

/** «اليوم» محلي لا UTC (انظر مرحلة ٤ في CLAUDE.md) — وتواريخ غير صالحة تُهمَل. */
function distinctDays(list: Expense[]): number {
  const days = new Set<string>();
  for (const e of list) {
    const d = new Date(e.date);
    if (!Number.isNaN(d.getTime())) days.add(d.toDateString());
  }
  return days.size;
}

/** أي نافذة تُعرض الآن؟ (أو لا شيء). تكتب مفتاح «أول يوم مؤهَّل» للدخل كأثر جانبي كالقديم. */
function pickPopup(uid: string, expenses: Expense[]): Kind | null {
  try {
    if (expenses.length === 0) return null;
    // لا شيء قبل انتهاء الجولة التعريفية.
    if (!localStorage.getItem(TOUR_KEY)) return null;
    const today = new Date().toDateString();
    // نافذة واحدة في اليوم، مهما كان نوعها.
    if (localStorage.getItem(lastShownKey(uid)) === today) return null;

    // ١) الدخل أولاً: في يوم لاحق لا في يوم الجولة نفسه (قرار المالك 2026-11-14).
    if (localStorage.getItem(incomeSeenKey(uid)) !== '1') {
      const first = localStorage.getItem(incomeEligibleKey(uid));
      if (!first) { localStorage.setItem(incomeEligibleKey(uid), today); return null; }
      if (first === today) return null;
      return 'income';
    }

    // ٢) دعوة التقييم: أندرويد ومتصل بالشبكة (المتجر يحتاجها).
    if (!isAndroid()) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    const mine = expenses.filter((e) => e.uid === uid);
    if (mine.length < RATING_MIN_EXPENSES || distinctDays(mine) < RATING_MIN_DAYS) return null;
    const st = readRating(uid);
    if (st) {
      if (st.state === 'done' || st.n >= RATING_MAX_ASKS) return null;
      if (Date.now() - st.at < RATING_RETRY_MS) return null;
    }
    return 'rating';
  } catch {
    return null; // التخزين غير متاح: لا نعرض ما قد يتكرّر بلا ضابط
  }
}

export function AnnouncementHost() {
  const { user } = useAuth();
  const router = useRouter();
  const { expenses, isExpensesFetched } = useAppData();
  const [kind, setKind] = useState<Kind | null>(null);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid || !isExpensesFetched || kind) return;
    // تأخير قصير كي لا تقفز النافذة فوق أول رسم للشاشة.
    const t = setTimeout(() => {
      const next = pickPopup(uid, expenses);
      if (!next) return;
      try {
        localStorage.setItem(lastShownKey(uid), new Date().toDateString());
        if (next === 'income') {
          localStorage.setItem(incomeSeenKey(uid), '1');
        } else {
          // نسجّلها «لاحقاً» لحظة العرض: الإغلاق بأي طريقة (أو قتل التطبيق) يُحسب تأجيلاً.
          const prev = readRating(uid);
          localStorage.setItem(
            ratingKey(uid),
            JSON.stringify({ n: (prev?.n ?? 0) + 1, state: 'later', at: Date.now() } satisfies RatingState),
          );
        }
      } catch {
        return;
      }
      track(next === 'income' ? 'income_intro_view' : 'rating_prompt_view');
      setKind(next);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [uid, isExpensesFetched, expenses, kind]);

  if (!kind) return null;

  const dismiss = () => {
    track(kind === 'income' ? 'income_intro_dismiss' : 'rating_prompt_dismiss');
    setKind(null);
  };

  const accept = () => {
    if (kind === 'income') {
      track('income_intro_click');
      setKind(null);
      router.push('/add-expense?mode=income');
      return;
    }
    track('rating_prompt_click');
    try { if (uid) localStorage.setItem(ratingKey(uid), JSON.stringify({ n: RATING_MAX_ASKS, state: 'done', at: Date.now() } satisfies RatingState)); } catch {}
    setKind(null);
    openPlayReviews();
  };

  const income = kind === 'income';

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-slate-900/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          dir="rtl"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-x-6 top-1/2 z-[60] mx-auto max-w-sm -translate-y-1/2 overflow-hidden rounded-[28px] bg-card text-card-foreground shadow-2xl duration-300 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-8 motion-reduce:animate-none"
        >
          <DialogPrimitive.Close
            aria-label="إغلاق"
            className="absolute end-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full touch-manipulation"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/70">
              <X className="h-4 w-4" />
            </span>
          </DialogPrimitive.Close>

          {income ? <IncomeArt /> : <RatingArt />}

          <div className="px-6 pb-2 pt-5 text-center">
            <DialogPrimitive.Title className="text-xl font-extrabold text-teal-800 dark:text-primary">
              {income ? 'سجّل دخلك بسهولة' : 'هل أفادك تدبير؟'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-[15px] leading-7 text-muted-foreground">
              {income
                ? 'إذا كان دخلك يتغيّر بين يوم وأسبوع وشهر، يمكنك الآن تسجيله في تدبير خلال ثوانٍ.'
                : 'إذا أعجبك التطبيق، فتقييمك على جوجل بلاي يساعد غيرك على اكتشافه.'}
            </DialogPrimitive.Description>
          </div>

          <div className="grid grid-cols-[1.4fr_1fr] gap-3 px-6 pb-6 pt-4">
            <button
              type="button"
              onClick={accept}
              className="h-12 rounded-2xl bg-teal-700 text-base font-bold text-white touch-manipulation hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {income ? 'جرّب الآن' : 'قيّم التطبيق'}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="h-12 rounded-2xl border-2 border-teal-600 bg-transparent text-base font-bold text-teal-700 touch-manipulation hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-primary dark:hover:bg-primary/10"
            >
              لاحقاً
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** رسمة الدخل: مقطع مصغّر من شاشة الإضافة (تبويب «مصروف | دخل» وحقل المبلغ). زخرفة بلا بيانات حقيقية. */
function IncomeArt() {
  return (
    <div aria-hidden="true" className="relative mx-4 mt-4 h-48 overflow-hidden rounded-3xl bg-primary/10">
      <div className="absolute inset-x-[-10%] bottom-[-35%] h-[75%] rounded-[50%] bg-primary/15" />
      <span className="absolute start-10 top-12 h-1 w-5 -rotate-[30deg] rounded-full bg-primary" />
      <span className="absolute start-8 top-[4.2rem] h-1 w-5 rounded-full bg-primary" />
      <span className="absolute start-10 top-[5.4rem] h-1 w-5 rotate-[30deg] rounded-full bg-primary" />
      <div className="absolute start-1/2 top-5 w-[11.5rem] -translate-x-1/2 -rotate-[4deg] overflow-hidden rounded-2xl border-2 border-teal-700 bg-card shadow-lg">
        <div className="flex items-center justify-between bg-teal-700 px-3 py-2">
          <span className="h-5 w-5 rounded-full bg-white/80" />
          <span className="text-sm font-extrabold text-white">تدبير</span>
        </div>
        <div className="bg-muted/60 px-3 pb-9 pt-5">
          <div className="flex rounded-xl bg-muted p-1 text-xs font-bold">
            <span className="flex-1 py-2 text-center text-muted-foreground">مصروف</span>
            <span className="flex-1 rounded-lg bg-card py-2 text-center text-teal-700 shadow dark:text-primary">دخل</span>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-8 bottom-4 flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-lg">
        <span className="text-sm font-bold text-foreground/80">المبلغ</span>
        <bdi className="text-xs font-semibold text-muted-foreground">د.ع</bdi>
      </div>
    </div>
  );
}

/** رسمة التقييم: شعار متجر Play مبسّط + خمس نجوم. (نجوم ممتلئة بقرار المالك 2026-11-21.) */
function RatingArt() {
  return (
    <div aria-hidden="true" className="relative mx-4 mt-4 flex h-44 items-center justify-center overflow-hidden rounded-3xl bg-primary/10">
      <div className="absolute inset-x-[-10%] bottom-[-35%] h-[75%] rounded-[50%] bg-primary/15" />
      <svg viewBox="0 0 48 48" className="relative h-24 w-24 drop-shadow-md">
        <polygon points="8,4 8,44 24,24" fill="#2196F3" />
        <polygon points="8,4 34,19.3 24,24" fill="#34A853" />
        <polygon points="34,19.3 42,24 34,28.7 24,24" fill="#FBBC04" />
        <polygon points="8,44 24,24 34,28.7" fill="#EA4335" />
      </svg>
      <div className="absolute bottom-6 end-8 flex gap-1 rounded-2xl bg-card px-3 py-2 shadow-lg">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="h-4 w-4 fill-teal-600 text-teal-600" />
        ))}
      </div>
    </div>
  );
}
