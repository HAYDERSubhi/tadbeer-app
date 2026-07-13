"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Target, BarChart3, WalletCards, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

function useNewBadgeDot() {
  const [hasDot, setHasDot] = useState(false);
  useEffect(() => {
    try { setHasDot(localStorage.getItem('tadbeer-new-badge') === '1'); } catch {}
    const handler = () => {
      try { setHasDot(localStorage.getItem('tadbeer-new-badge') === '1'); } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return hasDot;
}

const navItems = [
  { href: '/',         label: 'الرئيسية',  icon: Home },
  { href: '/expenses', label: 'مصاريف',    icon: WalletCards },
  { href: '/stats',    label: 'إحصائيات',  icon: BarChart3 },
  { href: '/tools',    label: 'أدوات',     icon: Wrench },
  { href: '/planner',  label: 'الأهداف',   icon: Target },
];

export default function PageNavigation() {
  const pathname = usePathname();
  const hasNewBadge = useNewBadgeDot();

  return (
    <nav id="main-navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
                "flex flex-col items-center justify-center gap-0.5 rounded-md py-2 text-[9px] font-medium transition-colors",
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="relative inline-flex">
                <item.icon className={cn("h-[22px] w-[22px]", isActive && "stroke-[2.5px]")} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
