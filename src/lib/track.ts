// src/lib/track.ts
// قياس الاستخدام — نقطة واحدة لكل أحداث التحليلات الجديدة.
//
// لماذا وُجد (2026-11-13): تقرير الصفحات في GA4 أظهر «/add-expense: ٢٢ مشاهدة و٣٩
// مستخدماً» — مستحيل منطقياً. السبب أن Firebase Analytics يسجّل `page_view` عند
// تحميل المستند فقط، والتنقّل عبر `next/link` لا يحمّل مستنداً، فكل الشاشات
// الداخلية كانت شبه غائبة عن القياس. ومعها لم يكن أي حدث يقيس الميزانية ولا الصوت
// ولا الفاتورة ولا المستشار، فكانت قرارات المنتج تُتَّخذ بلا أرقام.
//
// ⛔ القياس لا يُعطّل الواجهة أبداً: كل نداء هنا محميّ ولا يرمي.
// ⛔ لا تُرسِل نصوصاً يكتبها المستخدم ولا مبالغ ولا أسماء — أسماء أحداث وأعلام فقط.
import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase";

type Params = Record<string, string | number | boolean>;

export function track(name: string, params?: Params): void {
  if (!analytics) return;
  try {
    logEvent(analytics, name, params);
  } catch {
    /* القياس لا يُعطّل الواجهة */
  }
}

/** مشاهدة شاشة عند التنقّل الداخلي. المسار فقط — بلا استعلام (قد يحمل رمز إحالة). */
export function trackPageView(pathname: string): void {
  if (typeof window === "undefined") return;
  track("page_view", {
    page_path: pathname,
    page_location: window.location.origin + pathname,
  });
}
