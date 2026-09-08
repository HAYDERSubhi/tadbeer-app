
/** @type {import('next').NextConfig} */

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  customWorkerSrc: "worker",
  // ⛔ كان `false` — وهو سبب أن التطبيق **لا يعمل بلا إنترنت عملياً**.
  // قاعدة `runtimeCaching` أدناه تحفظ طلبات التنقّل (`request.mode === 'navigate'`)
  // فقط، وهي لا تشمل التنقّل داخل التطبيق عبر `next/link` (ذاك يجلب حمولة RSC
  // لا مستنداً). فكانت الشاشة الوحيدة المحفوظة هي التي فُتحت من رابط خارجي أو من
  // أيقونة التطبيق، وكل ضغطة داخلية تصل لشاشة **غير محفوظة**.
  // أُثبت بالقياس على الإنتاج 2026-09-08: بعد فتح `/signup` ثم الضغط على رابط
  // `/login` داخل الصفحة، بقي `pages-cache` يحوي `/signup` و`/privacy` فقط —
  // و`/login` **لم يُحفظ** رغم أن الصفحة انتقلت إليه فعلاً.
  // ⚠️ الثمن المعروف: طلب مستند إضافي مع كل تنقّل داخلي (بيانات أكثر قليلاً).
  cacheOnFrontEndNav: true,
  // يبقى `false` عمداً: يحفظ كل <script> و<link> عند كل تنقّل، وملفاتنا الثابتة
  // محفوظة مسبقاً أصلاً (١٣٥ ملفاً) — فلا فائدة تُذكر مقابل طلبات زائدة.
  aggressiveFrontEndNavCaching: false,
  // صفحة بديلة بشكل تدبير بدل شاشة خطأ المتصفّح السوداء.
  // ⚠️ المسار `~offline` لا `_offline`: المكتبة تبحث عن `src/app/~offline/page.*`
  //    لموجّه App (تحقّقت من كودها)، وأي مجلد يبدأ بـ`_` في App Router **مجلد
  //    خاص لا يُنشئ مساراً أصلاً** — فلو سُمّي `_offline` لما وُجدت الصفحة إطلاقاً.
  fallbacks: { document: "/~offline" },
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    // صفحات HTML: الشبكة أولاً ليصل التحديث فوراً.
    // ملفات Next.js الثابتة لها بصمة hash في أسمائها فتُحدَّث تلقائياً.
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache',
          networkTimeoutSeconds: 2,
          expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
    ],
  },
  // --- START of PWA manifest options ---
  id: "app.tadbeer.web",
  start_url: "/",
  display: "standalone",
  orientation: "portrait",
  // White splash screen background so the icon doesn't appear on black.
  background_color: "#F8FAFC",
  // Teal theme matches the app primary color.
  theme_color: "#14A39A",
  short_name: "تدبير",
  description: "إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي مع تدبير.",
  icons: [
    { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    // maskable: allows Android to use adaptive icon with coloured background.
    { src: "/icons/maskable-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  // ⛔ لا تُعِد حقل `screenshots` بلا ملفات موجودة فعلاً. كان يشير إلى ثلاث صور
  // `screenshot-{1,2,3}-light.png` **لم توجد على القرص قط** (فُحص تاريخ git كلّه
  // 2026-09-09) — أي مرجع ميت يجعل المتصفّح يطلب ٣ ملفات ترجع ٤٠٤ بلا فائدة.
  // لو أردت لقطات في نافذة تثبيت PWA: ضع الملفات في `public/` أولاً ثم أعِد
  // الحقل بأسمائها الحقيقية. (اللقطات القديمة محفوظة في `docs/assets/screenshots/`
  // وهي بمقاسات مختلفة — لا تنسخها إلى `public` بلا مراجعة الأبعاد.)
  related_applications: [],
  prefer_related_applications: false,
  // --- END of PWA manifest options ---
});

const nextConfig = {
  // بصمة البناء — تُمرَّر للعميل ليكتشف النسخة الجديدة ويُنظّف الـ cache تلقائياً
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now()),
  },
  // توحيد نطاق المصادقة: نافذة الدخول بجوجل تُخدَم من tadbeer.app نفسه بدل
  // iraqi-budgeteer.firebaseapp.com — الحل الرسمي من Firebase لانقطاع الدخول
  // عندما يعزل المتصفح تخزين الطرف الثالث (Chrome/TWA/Safari).
  // يعمل فقط عندما يكون NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tadbeer.app في Vercel.
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://iraqi-budgeteer.firebaseapp.com/__/auth/:path*',
      },
      {
        source: '/__/firebase/:path*',
        destination: 'https://iraqi-budgeteer.firebaseapp.com/__/firebase/:path*',
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Raise server-action body limit to 4 MB so large audio data-URIs
    // (long voice recordings) don't get rejected by Next.js before reaching
    // the handler. The /api/voice route handles audio so this also acts as
    // a safety net for any remaining server actions that receive media.
    serverActionsBodySizeLimit: '4mb',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // This is a workaround for a build issue with the handlebars dependency in genkit.
  // It ensures that the package is treated as an external dependency by the server components.
  serverExternalPackages: ['handlebars'],
};

module.exports = withPWA(nextConfig);
