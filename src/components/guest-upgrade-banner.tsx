'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { ShieldCheck, Loader2, X } from 'lucide-react';

// عتبة الإنجاز: لا يظهر البانر إلا بعد أن يسجّل الضيف هذا العدد من المصاريف —
// لحظة تكون فيها بياناته صارت ذات قيمة يخاف على ضياعها (محفّز مبني على القيمة لا الإجبار).
const MILESTONE = 10;

// شريط يُعرض لمستخدم الزائر (المجهول) لحثّه على حفظ حسابه قبل فقدان بياناته.
// يظهر فقط بعد بلوغ عتبة الإنجاز (MILESTONE مصروف) لا فور الدخول.
export function GuestUpgradeBanner({ expenseCount = 0 }: { expenseCount?: number }) {
  const { user, linkGuestWithGoogle } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!user?.isAnonymous || dismissed || expenseCount < MILESTONE) return null;

  async function save() {
    // داخل متصفّح فيسبوك/إنستغرام المدمج جوجل تمنع الدخول نهائياً — أرشد بدل محاولة فاشلة.
    if (isInAppBrowser()) {
      toast({
        title: 'افتح تدبير في المتصفّح',
        description: 'حفظ الحساب بجوجل لا يعمل داخل متصفّح إنستغرام/فيسبوك — افتح tadbeer.app في Chrome أو Safari.',
      });
      return;
    }
    setLoading(true);
    try {
      // تحويل كامل الصفحة لجوجل — عند النجاح تغادر الصفحة وترجع، والترحيب/الأخطاء
      // يعالَجان عند العودة في use-auth. البانر يختفي تلقائياً لأن المستخدم لن يبقى مجهولاً.
      await linkGuestWithGoogle();
    } catch (e: any) {
      toast({ title: 'لم يكتمل الحفظ', description: 'تعذّر فتح صفحة Google. حاول مجدداً.', variant: 'destructive' });
      setLoading(false);
    }
    // لا نُطفئ التحميل عند النجاح: الصفحة تغادر لجوجل والمؤشّر الدوّار هو التغذية الصحيحة.
  }

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-teal-100 dark:border-teal-900/50 bg-gradient-to-br from-teal-50 to-emerald-50/40 dark:from-teal-950/40 dark:to-emerald-950/20 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600/10 dark:bg-teal-400/10">
          <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-teal-900 dark:text-teal-200">سجّلت {MILESTONE} مصاريف — لا تخاطر بضياعها 👏</p>
          <p className="text-xs text-teal-800/70 dark:text-teal-300/70 mt-0.5 leading-relaxed">
            بياناتك مؤقتة على هذا الجهاز فقط. احفظ حسابك بـ Google بضغطة واحدة لتبقى دائماً.
          </p>
          <button onClick={save} disabled={loading}
            className="mt-2.5 inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl disabled:opacity-60 transition-colors">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            احفظ حسابك بـ Google
          </button>
        </div>
        <button onClick={() => setDismissed(true)} aria-label="إغلاق" className="text-teal-700/50 dark:text-teal-400/50 p-0.5 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
