import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'تدبير | تطبيقك المالي الذكي',
    short_name: 'تدبير',
    description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي مع تدبير.',
    start_url: '/',
    display: 'standalone',
    // Match the app's light background so the OS splash screen blends in.
    background_color: '#F8FAFC',
    theme_color: '#14A39A',
    dir: 'rtl',
    lang: 'ar',
    orientation: 'portrait',
    icons: [
      // 'any' = regular icon shown on home screen / task switcher
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // 'maskable' = adaptive icon for Android splash screen — must use the
      // version with coloured background fill so it doesn't appear black.
      { src: '/icons/maskable-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Web Share Target: lets the installed PWA appear in Android's share sheet.
    // When the user shares a bank SMS/notification, Android opens /import with
    // the text in the query string, which we parse into an expense.
    share_target: {
      action: '/import',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },
  };
}
