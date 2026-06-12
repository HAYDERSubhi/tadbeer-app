"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Target, Settings, BarChart3, WalletCards, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/',         label: 'الرئيسية',  icon: Home },
  { href: '/expenses', label: 'مصاريف',    icon: WalletCards },
  { href: '/stats',    label: 'إحصائيات',  icon: BarChart3 },
  { href: '/tools',    label: 'أدوات',     icon: Wrench },
  { href: '/planner',  label: 'الأهداف',   icon: Target },
  { href: '/settings', label: 'إعدادات',   icon: Settings },
];

export default function PageNavigation() {
  const pathname = usePathname();

  return (
    <nav id="main-navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto grid h-16 max-w-md grid-cols-6 items-center px-1">
        {navItems.map((item) => {
          const isActive =
            (item.href === '/' && pathname === '/') ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-md py-2 text-[9px] font-medium transition-colors",
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive && "stroke-[2.5px]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
