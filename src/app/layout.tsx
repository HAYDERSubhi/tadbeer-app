
import type { Metadata } from 'next';
import { Lalezar, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster"

const lalezar = Lalezar({
  variable: '--font-lalezar',
  subsets: ['arabic'],
  weight: '400',
  display: 'swap',
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: '--font-noto-sans-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Iraqi Budgeteer | كي - راقب مصروفك',
  description: 'تطبيق مالي لإدارة المصروفات الشخصية للمستخدمين الناطقين بالعربية في العراق.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${lalezar.variable} ${notoSansArabic.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
