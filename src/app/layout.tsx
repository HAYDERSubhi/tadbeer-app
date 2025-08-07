
// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    default: 'تدبير | تطبيقك المالي الذكي',
    template: '%s | تدبير',
  },
  description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي مع تدبير. ابدأ الآن!',
  manifest: '/manifest.json',
  openGraph: {
    title: 'تدبير | تطبيقك المالي الذكي',
    description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي!',
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
    startupImage: '/apple-touch-icon.png',
  },
  icons: {
    icon: '/logo.png', // Use the new logo for favicon
    shortcut: '/icon-192x192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFDA63',
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
