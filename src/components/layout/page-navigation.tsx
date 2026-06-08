"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Target, Settings, BarChart3, WalletCards } from 'lucide-react';
import { cn } from '@/lib/utils';

// RTL order: rightmost item first
const navItems = [
  { href: '/',         label: 'الرئيسية',  icon: Home },
  { href: '/expenses', label: 'مصاريف',    icon: WalletCards },
  { href: '/stats',    label: 'إحصائيات',  icon: BarChart3 },
  { href: '/planner',  label: 'الأهداف',   icon: Target },
  { href: '/settings', label: 'إعدادات',   icon: Settings },
];

export default function PageNavigation() {
  const pathname = usePathname();

  return (
    <nav id="main-navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
        {navItems.map((item) => {
          const isActive =
            (item.href === '/' && pathname === '/') ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors",
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
