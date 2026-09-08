"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';
import { shouldPromotePlayStore, PLAY_STORE_URL } from '@/lib/platform';

/**
 * لافتة تدعو مستخدم أندرويد لتنزيل تدبير من **Google Play**.
 *
 * ⚠️ خلفت لافتة «أضف التطبيق لشاشتك الرئيسية» (التثبيت من المتصفّح) بقرار صريح
 * من صاحب المشروع 2026-09-08: «أي مستخدم أندرويد يُوجَّه إلى جوجل بلي، لا حاجة
 * للتثبيت من المتصفّح». **لا تُعِد التثبيت من المتصفّح لأندرويد بلا إذنه.**
 *
 * السبب: ٩٩١ حساباً مقابل «+١٠٠» تنزيل من Play — والفارق سببه أن هذه اللافتة
 * بالذات كانت تلتقط **أثمن لحظة في المنتج** (مستخدم جرّب وأعجبه ويريد أيقونة)
 * وتوجّهها كلها إلى المتصفّح. ومن ثبّت من المتصفّح **لا يسمح له Google بالتقييم
 * إطلاقاً**، ولا يُحتسب تنزيلاً على المتجر.
 *
 * ⚠️ **قرار اتُّخذ بلا أرقام — وهذا مقصود ومعروف.** لافتة التثبيت القديمة لم تكن
 * مقيسة إطلاقاً، فلا أحد يعرف كم شخصاً كان يستعملها. لذلك القياس هنا **شرط**
 * لا زينة: `play_banner_view` (المقام) · `play_banner_click` · `play_banner_dismiss`.
 * ⇒ **راجع الأرقام بعد أسبوعين.** إن تبيّن أن التثبيت تراجع بشدّة، فالتراجع عن
 *   هذا القرار مشروع — وهو أصلاً السبب في إضافة القياس.
 *
 * آيفون خارج الموضوع تماماً (لا Google Play هناك) — `IosInstallBanner` باقية له.
 */

// نفس تأخير لافتة آيفون: لا نقاطع المستخدم في أول ثانيتين من دخوله.
const APPEAR_DELAY_MS = 2500;
const DISMISS_KEY = 'play-banner-dismissed';

export function PlayInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldPromotePlayStore()) return;

    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { /* تصفّح خاص */ }
    if (dismissed) return;

    const t = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // المقام: كم مرّة رآها مستخدم فعلاً — لا كم مرّة رُكِّب المكوّن.
  useEffect(() => {
    if (!visible || !analytics) return;
    try { logEvent(analytics, 'play_banner_view'); } catch { /* القياس لا يُعطّل الواجهة */ }
  }, [visible]);

  if (!visible) return null;

  const track = (name: string) => {
    if (!analytics) return;
    try { logEvent(analytics, name); } catch { /* لا يمنع الإجراء */ }
  };

  const handleDismiss = () => {
    track('play_banner_dismiss');
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* تصفّح خاص */ }
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3 animate-in slide-in-from-bottom-2 duration-300"
      role="banner"
      aria-label="تنزيل تدبير من Google Play"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-4 shadow-xl">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight text-white">تدبير</p>
          <p className="mt-0.5 text-sm text-white/85">حمّله من Google Play</p>
        </div>

        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('play_banner_click')}
          // min-h/min-w 44px: قاعدة هدف اللمس الثابتة بالمشروع.
          className="flex min-h-[44px] flex-shrink-0 items-center rounded-xl bg-white px-4 text-sm font-bold text-primary shadow-sm transition-opacity active:opacity-70"
        >
          تنزيل
        </a>

        <button
          onClick={handleDismiss}
          className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-full text-white/70 transition-colors active:bg-white/20"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
