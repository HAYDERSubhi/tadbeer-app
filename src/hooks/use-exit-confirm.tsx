"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

// مفتاح نضعه داخل history.state لتمييز المدخل "الحارس" الذي ندفعه نحن
// عن مداخل التنقّل الطبيعية للتطبيق.
const GUARD_KEY = "tadbeerExitGuard";
const ARM_WINDOW_MS = 2500;

/**
 * يمنع إغلاق التطبيق فجأةً بضغطة رجوع واحدة من الشاشة الجذر.
 *
 * المشكلة (رصدها المختبرون): داخل TWA على أندرويد، الشاشة الرئيسية هي أول
 * مدخل بالسجل — فأي ضغطة على زر الرجوع تُخرج المستخدم من التطبيق مباشرةً
 * بلا أي تأكيد، وهو سلوك مزعج عند الضغط بالخطأ.
 *
 * الحل (نمط أندرويد المعتاد: اضغط رجوع مرتين للخروج): ندفع مدخلاً حارساً
 * فوق الشاشة الرئيسية. أول ضغطة رجوع تلتهم الحارس فنعيد دفعه ونعرض تنبيهاً،
 * والضغطة الثانية خلال ثانيتين ونصف تمرّ فيُغلق التطبيق فعلاً.
 *
 * ⚠️ يُستدعى من الشاشة الرئيسية فقط — بقية الشاشات يجب أن يرجع منها الزر
 * كالمعتاد بلا اعتراض.
 */
export function useExitConfirm(active: boolean = true) {
  const { toast } = useToast();
  const armedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const pushGuard = () => {
      const current = window.history.state || {};
      window.history.pushState({ ...current, [GUARD_KEY]: true }, "");
    };

    // لا ندفع حارساً ثانياً إن كنّا واقفين على واحد أصلاً (إعادة تركيب المكوّن).
    if (!window.history.state?.[GUARD_KEY]) {
      pushGuard();
    }

    const onPopState = () => {
      if (armedRef.current) {
        // الضغطة الثانية: نُكمل الرجوع فعلياً — يُغلق التطبيق على أندرويد.
        armedRef.current = false;
        window.history.back();
        return;
      }
      armedRef.current = true;
      pushGuard();
      toast({ description: "اضغط رجوع مرة أخرى للخروج من تدبير" });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        armedRef.current = false;
      }, ARM_WINDOW_MS);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, toast]);
}
