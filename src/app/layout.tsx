// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Tajawal } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { AppProviders } from '@/components/providers';
import { SWUpdater } from '@/components/sw-updater';
import { META_PIXEL_ID } from '@/lib/meta-pixel';

// Self-hosted via Next.js — eliminates render-blocking Google Fonts request.
const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-tajawal',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tadbeer.app';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'تدبير | تطبيقك المالي الذكي',
    template: '%s | تدبير',
  },
  description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي مع تدبير. ابدأ الآن!',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/logo.png', sizes: '32x32' },
      { url: '/logo.png', sizes: '16x16' },
    ],
    shortcut: '/logo.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/logo.png',
        color: '#14A39A',
      },
    ],
  },
  openGraph: {
    title: 'تدبير | تطبيقك المالي الذكي',
    description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي!',
    url: APP_URL,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'شعار تطبيق تدبير مع خلفية',
      },
    ],
    locale: 'ar_IQ',
    type: 'website',
    siteName: 'تدبير',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'تدبير | تطبيقك المالي الذكي',
    description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي!',
     images: ['/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'تدبير',
    startupImage: [
        { url: '/logo.png', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)' },
    ],
  },
};

// Raise Vercel serverless timeout to 30s for all server actions in this app
// (AI flows — Gemini API — can occasionally take >10s default limit).
export const maxDuration = 30;

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#14B8A5' },
    { media: '(prefers-color-scheme: dark)', color: '#14B8A5' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // يمدّ المحتوى تحت شريطي النظام (الحالة والإيماءات) ويفعّل env(safe-area-inset-*)
  // ضروري للـ TWA على أندرويد 15 (edge-to-edge مفروضة) — الهيدر والشريط السفلي
  // يعالجان الحواف عبر padding آمن أدناه.
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={tajawal.variable}>
      <body>
        {/* Meta Pixel — loaded after the page is interactive so it never blocks first paint. */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
        <AppProviders>
          <SWUpdater />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
