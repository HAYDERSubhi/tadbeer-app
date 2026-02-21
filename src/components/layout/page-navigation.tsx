
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Target, Settings, BarChart3, WalletCards, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'الرئيسية', icon: Home },
  { href: '/stats', label: 'الإحصائيات', icon: BarChart3 },
  { href: '/expenses', label: 'المصاريف', icon: WalletCards },
  { href: '/planner', label: 'الأهداف', icon: Target },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export default function PageNavigation() {
  const pathname = usePathname();

  return (
    <nav id="main-navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-stretch justify-around">
        {navItems.map((item) => {
          const isActive = (item.href === '/' && pathname === '/') || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                isActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
      {/* Hidden link for the proposal during the pitch */}
      {pathname === '/proposal' && (
          <div className="absolute -top-12 right-4">
              <Link href="/proposal" className="bg-primary text-white p-2 rounded-full shadow-lg flex items-center gap-2 text-xs">
                  <FileText className="h-4 w-4" /> عرض المقترح
              </Link>
          </div>
      )}
    </nav>
  );
}
