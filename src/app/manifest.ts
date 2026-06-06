import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'تدبير | تطبيقك المالي الذكي',
    short_name: 'تدبير',
    description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي مع تدبير.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#14b8a6',
    dir: 'rtl',
    lang: 'ar',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
