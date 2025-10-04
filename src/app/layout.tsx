// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tadbeer.app';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'تدبير | تطبيقك المالي الذكي',
    template: '%s | تدبير',
  },
  description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي مع تدبير. ابدأ الآن!',
  manifest: '/manifest.webmanifest', // Default name from next-pwa
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
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
    other: [
      {
        rel: 'mask-icon',
        url: '/icons/maskable-icon.png',
        color: '#1AB2A7',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#121C1C' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
