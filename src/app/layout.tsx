// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    default: 'مصروفات | تطبيقك المالي الذكي',
    template: '%s | مصروفات',
  },
  description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي. ابدأ الآن!',
  manifest: '/manifest.json',
  openGraph: {
    title: 'مصروفات | تطبيقك المالي الذكي',
    description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي!',
    images: [
      {
        url: 'https://placehold.co/1200x630.png',
        width: 1200,
        height: 630,
        alt: 'بانر تطبيق مصروفات',
      },
    ],
    locale: 'ar_IQ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'مصروفات | تطبيقك المالي الذكي',
    description: 'إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي!',
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
      <body className={'antialiased'}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
