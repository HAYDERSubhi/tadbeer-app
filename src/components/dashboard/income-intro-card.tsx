"use client";

// بطاقة تعريف بميزة «تسجيل الدخل» — تظهر مرة واحدة لكل حساب وقابلة للإغلاق.
//
// «مرة واحدة» = جلسة الفتح الأولى فقط: تبقى ظاهرة ما دام المستخدم في هذه الجلسة (حتى لو تنقّل
// وعاد للرئيسية)، ولا تعود في فتحة لاحقة. المفتاح مربوط بالحساب لا بالجهاز (فخّ ١ في CLAUDE.md:
// مفاتيح localStorage العامة تتداخل بين حسابين على جهاز واحد). ولا تظهر لمن لم يسجّل أي مصروف بعد
// كي لا تزاحم الجولة التعريفية للمستخدم الجديد.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HandCoins, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { track } from '@/lib/track';

const seenKey = (uid: string) => `income-intro-seen-${uid}`;
const sessionKey = (uid: string) => `income-intro-session-${uid}`;
const eligibleKey = (uid: string) => `income-intro-eligible-${uid}`;

export function IncomeIntroCard() {
  const { user } = useAuth();
  const router = useRouter();
  const { expenses, isExpensesFetched } = useAppData();
  const [visible, setVisible] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || !user || !isExpensesFetched || expenses.length === 0) return;
    // لا تظهر قبل انتهاء الجولة التعريفية: كانت تظهر للمستخدم الجديد بشارة «جديد» فوق
    // الميزانية ومع الجولة في اللحظة نفسها (فيديو المالك 2026-11-14). تنتظر فتحة لاحقة.
    // ⛔ المفتاح نفسه في (main)/page.tsx — لا تغيّره في مكان دون الآخر.
    try { if (!localStorage.getItem('tadbeer-onboarding-tour-v2')) return; } catch { return; }
    // وفي يوم لاحق لا في يوم الجولة نفسه (قرار المالك 2026-11-14): أول يوم يرى فيه التطبيقُ
    // الجولةَ منتهية يُسجَّل، والبطاقة تنتظر يوماً بعده. من رأى البطاقة سابقاً لا يتأثر.
    try {
      const seenBefore = localStorage.getItem(seenKey(user.uid)) === '1';
      if (!seenBefore) {
        const today = new Date().toDateString();
        const firstDay = localStorage.getItem(eligibleKey(user.uid));
        if (!firstDay) { localStorage.setItem(eligibleKey(user.uid), today); return; }
        if (firstDay === today) return;
      }
    } catch { return; }
    decided.current = true;
    try {
      const inThisSession = sessionStorage.getItem(sessionKey(user.uid)) === '1';
      const seenBefore = localStorage.getItem(seenKey(user.uid)) === '1';
      if (seenBefore && !inThisSession) return; // عُرضت في فتحة سابقة ولم تعد مطلوبة
      localStorage.setItem(seenKey(user.uid), '1');
      sessionStorage.setItem(sessionKey(user.uid), '1');
      setVisible(true);
      if (!seenBefore) track('income_intro_view');
    } catch {
      // التخزين غير متاح: لا نعرضها كي لا تتكرّر بلا إمكانية إغلاقها
    }
  }, [user, isExpensesFetched, expenses.length]);

  const close = () => {
    try { if (user) sessionStorage.setItem(sessionKey(user.uid), '0'); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-primary/5 animate-in fade-in">
      <button
        type="button"
        onClick={() => { track('income_intro_dismiss'); close(); }}
        aria-label="إغلاق"
        className="absolute top-2 end-2 p-1.5 rounded-full text-muted-foreground hover:bg-muted touch-manipulation"
      >
        <X className="h-4 w-4" />
      </button>
      <CardContent className="p-4 flex gap-3 items-start">
        <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-primary/15 text-primary">
          <HandCoins className="h-6 w-6" />
        </span>
        <div className="min-w-0 pe-6">
          <p className="text-xs font-bold text-primary mb-0.5">جديد</p>
          <h3 className="font-bold text-sm">سجّل دخلك أولاً بأول</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            دخلك يومي أو غير ثابت؟ اضغط «دخل» في شاشة الإضافة وسجّل ما استلمته، ويظهر في قائمة الرئيسية مع مصاريفك.
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => { track('income_intro_click'); close(); router.push('/add-expense?mode=income'); }}
          >
            جرّب الآن
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
