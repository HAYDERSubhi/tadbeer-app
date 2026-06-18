import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'تدبير | تطبيقك المالي الذكي',
    short_name: 'تدبير',
    description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي مع تدبير.',
    start_url: '/',
    display: 'standalone',
    // Match the app's light background so the OS splash screen blends in.
    background_color: '#14B8A5',
    theme_color: '#14B8A5',
    dir: 'rtl',
    lang: 'ar',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // NOTE: maskable-icon.png was removed — it had a black background which
      // caused the Android splash screen to show a large black square.
      // Android will now use icon-512x512.png (any) on the #F8FAFC background.
    ],
  };
}
