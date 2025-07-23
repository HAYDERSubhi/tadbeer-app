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
    // To change the preview image, replace the URL below with a direct link to your desired image.
    // Recommended size is 1200x630 pixels.
    images: [
      {
        url: 'https://placehold.co/1200x630/fec604/202638.png',
        width: 1200,
        height: 630,
        alt: 'بانر تطبيق تدبير',
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
