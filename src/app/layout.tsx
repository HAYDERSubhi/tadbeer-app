
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers';

// This metadata object controls what users see when the app link is shared.
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
    // Using a static, locally-hosted image for reliability.
    images: [
      {
        url: '/logo.png?v=2', // Relative path to the image in the public folder
        width: 512,
        height: 512,
        alt: 'شعار تطبيق تدبير',
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
     images: ['/logo.png?v=2'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'تدبير',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

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
