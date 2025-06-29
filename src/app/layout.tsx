// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers';

export const metadata: Metadata = {
  title: 'مصروفات',
  description: 'تطبيق مالي لإدارة المصروفات الشخصية للمستخدمين الناطقين بالعربية في العراق.',
  manifest: '/manifest.json',
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
