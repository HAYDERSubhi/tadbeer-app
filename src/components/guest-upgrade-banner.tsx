'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { ShieldAlert, Loader2, X } from 'lucide-react';

// شريط يُعرض لمستخدم الزائر (المجهول) لحثّه على حفظ حسابه قبل فقدان بياناته
export function GuestUpgradeBanner() {
  const { user, linkGuestWithGoogle } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!user?.isAnonymous || dismissed) return null;

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
    <div className="mb-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">أنت تستخدم حساب زائر</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
            بياناتك مؤقتة على هذا الجهاز فقط — قد تُفقد عند مسح المتصفح أو تغيير الهاتف. احفظ حسابك مجاناً للاحتفاظ بها.
          </p>
          <button onClick={save} disabled={loading}
            className="mt-2 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-60 transition-colors">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            احفظ حسابك بـ Google
          </button>
        </div>
        <button onClick={() => setDismissed(true)} className="text-amber-600/60 dark:text-amber-400/60 p-0.5 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
