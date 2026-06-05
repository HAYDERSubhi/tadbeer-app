"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Target, Settings, BarChart3, WalletCards, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/settings', label: 'إعدادات', icon: Settings },
  { href: '/expenses', label: 'مصاريف', icon: WalletCards },
  { href: '/stats', label: 'إحصائيات', icon: BarChart3 },
  { href: '/planner', label: 'الأهداف', icon: Target },
  { href: '/', label: 'الرئيسية', icon: Home },
];

export default function PageNavigation() {
  const pathname = usePathname();

  return (
    <nav id="main-navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">

      {/* Floating Action Button — centered above nav */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-10">
        <Link
          href="/add-expense"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/40 hover:bg-primary/90 transition-all active:scale-95 border-4 border-background"
          aria-label="إضافة مصروف"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Link>
      </div>

      {/* Nav items */}
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
        {navItems.map((item) => {
          const isActive =
            (item.href === '/' && pathname === '/') ||
            (item.href !== '/' && pathname.startsWith(item.href));

          // Leave center slot empty for FAB space
          const isCenter = item.href === '/stats';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors",
                isCenter && "mt-2", // push center items down slightly for FAB
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
