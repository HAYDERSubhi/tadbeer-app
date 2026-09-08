"use client";

import { useEffect, useState } from 'react';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';
import { shouldPromotePlayStore, PLAY_STORE_URL } from '@/lib/platform';

/**
 * رابط ثانوي هادئ لصفحة تدبير على Google Play، أسفل خيارات التسجيل.
 *
 * ⚠️ لماذا **ثانوي وفي الأسفل** — قرار مقصود لا تُرقّه جلسة قادمة:
 * كل من يضغطه **يغادر الموقع** إلى المتجر، وبعضهم لا يعود. تحويل صفحة التسجيل
 * ~18% (لقطة التحليلات 2026-07-24)، ورفع هذا الرابط إلى أعلى يخسر مسجّلين
 * مقابل مكسب لا يظهر إلا بعد أسابيع. مكانه الحالي: من يفضّل المتاجر يجده،
 * ومن يستعجل لا يلتفت له.
 *
 * السبب من الأساس: ٩٩١ حساباً في التطبيق مقابل «+١٠٠» تنزيل من Play — أي أن
 * الأغلبية ثبّتت من المتصفّح، **ولا يسمح لها Google بالتقييم إطلاقاً**. وقد
 * ثبت 2026-09-08 أن التطبيق **لا يستطيع تمييز مستخدم المتجر** ليُخاطبه وحده
 * (انظر ملف الذاكرة `twa_source_detection_impossible.md`)، فبقي هذا الطريق:
 * زيادة عدد مستخدمي المتجر من الأساس بدل عصر مجموعة صغيرة.
 *
 * ⚠️ **رابط نصّي لا صورة شارة Google الرسمية** — عمداً: الشارة الرسمية أصل
 * مملوك لجوجل وله شروط استعمال وأبعاد ملزمة. الرابط النصّي يتجنّب ذلك كلّه.
 *
 * القياس: `play_badge_view` عند الظهور و`play_badge_click` عند الضغط —
 * **الاثنان معاً** كي تُقرأ النسبة، فعدد الضغطات وحده لا معنى له بلا مقام.
 */

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0" fill="currentColor">
    <path d="M4.6 2.3a1 1 0 0 0-.6.9v17.6a1 1 0 0 0 1.5.9l13.8-8.8a1 1 0 0 0 0-1.7L5.5 2.4a1 1 0 0 0-.9-.1z" />
  </svg>
);

export function PlayStoreBadge() {
  const [show, setShow] = useState(false);

  // نفس شرط لافتة `play-install-banner` حرفياً — مصدر واحد كي لا ينحرف الموضعان.
  useEffect(() => {
    if (shouldPromotePlayStore()) setShow(true);
  }, []);

  // مقام النسبة: كم مرّة عُرض الرابط فعلاً (لا كم مرّة زُرِعت الصفحة).
  useEffect(() => {
    if (!show || !analytics) return;
    try { logEvent(analytics, 'play_badge_view'); } catch { /* القياس لا يُعطّل الصفحة */ }
  }, [show]);

  if (!show) return null;

  return (
    <div className="pt-3 mt-1 border-t border-white/15 text-center">
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (analytics) {
            try { logEvent(analytics, 'play_badge_click'); } catch { /* لا يمنع الانتقال */ }
          }
        }}
        // min-h-[44px] هدف لمس مطابق لقاعدة الموبايل الثابتة بالمشروع.
        className="inline-flex min-h-[44px] items-center justify-center gap-2 px-4 text-sm text-white/75 transition-colors hover:text-white active:text-white"
      >
        <PlayIcon />
        متوفر أيضاً على Google Play
      </a>
    </div>
  );
}
