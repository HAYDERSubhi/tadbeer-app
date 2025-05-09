
import type { Metadata } from 'next';
import { Lalezar } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster"

const lalezar = Lalezar({
  variable: '--font-lalezar',
  subsets: ['arabic', 'latin'],
  weight: ['400'],
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
      <body className={`${lalezar.variable} font-sans antialiased`}>
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

