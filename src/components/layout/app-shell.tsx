"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, BarChart3Icon, SettingsIcon, WalletIcon, MoonIcon, SunIcon, PlusCircleIcon, MicIcon, ScanLineIcon, CreditCardIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import VoiceExpenseForm from '@/components/expenses/voice-expense-form';
import ReceiptScanForm from '@/components/expenses/receipt-scan-form';

const navItems = [
  { href: '/', label: 'الرئيسية', icon: HomeIcon },
  { href: '/stats', label: 'الإحصائيات', icon: BarChart3Icon },
  { href: '/settings', label: 'الإعدادات', icon: SettingsIcon },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  const AddExpenseOptions = [
    { label: "إدخال يدوي", icon: PlusCircleIcon, component: <ManualExpenseForm /> },
    { label: "إدخال صوتي", icon: MicIcon, component: <VoiceExpenseForm /> },
    { label: "مسح فاتورة", icon: ScanLineIcon, component: <ReceiptScanForm /> },
    { label: "بطاقة إلكترونية", icon: CreditCardIcon, component: <p className="p-4 text-center">سيتم إضافة مزامنة البطاقة الإلكترونية قريباً.</p> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <WalletIcon className="h-7 w-7 text-primary" />
            <span className="hidden sm:inline">كي - راقب مصروفك</span>
            <span className="sm:hidden">كي</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label="Toggle theme"
            >
              <SunIcon className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <MoonIcon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 container mx-auto py-6">
        {!isMobile && (
          <aside className="w-64 pr-8 space-y-4">
            <nav className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted hover:text-muted-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
             <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button className="w-full mt-4">
                  <PlusCircleIcon className="ml-2 h-5 w-5" />
                  إضافة مصروف
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {AddExpenseOptions.map(option => (
                  <Dialog key={option.label}>
                    <DialogTrigger asChild>
                       <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <option.icon className="mr-2 h-4 w-4" />
                        {option.label}
                      </DropdownMenuItem>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{option.label}</DialogTitle>
                      </DialogHeader>
                      {option.component}
                    </DialogContent>
                  </Dialog>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </aside>
        )}
        <main className="flex-1">{children}</main>
      </div>

      {isMobile && (
        <footer className="sticky bottom-0 z-50 w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <nav className="container grid grid-cols-4 h-16 items-center justify-items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 p-2 rounded-md text-xs font-medium transition-colors w-full',
                  pathname === item.href
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
             <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                 <Button variant="ghost" className="flex flex-col items-center justify-center gap-1 p-2 rounded-md text-xs font-medium transition-colors w-full text-primary">
                    <PlusCircleIcon className="h-5 w-5" />
                    إضافة
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mb-2">
                 {AddExpenseOptions.map(option => (
                  <Dialog key={option.label}>
                    <DialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <option.icon className="mr-2 h-4 w-4" />
                        {option.label}
                      </DropdownMenuItem>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{option.label}</DialogTitle>
                      </DialogHeader>
                      {option.component}
                    </DialogContent>
                  </Dialog>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </footer>
      )}
    </div>
  );
}
