
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, Goal, SettingsIcon, PieChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { buttonVariants } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'الرئيسية', icon: HomeIcon },
  { href: '/stats', label: 'الإحصائيات', icon: PieChartIcon },
  { href: '/planner', label: 'المخطط', icon: Goal },
  { href: '/settings', label: 'الإعدادات', icon: SettingsIcon },
];

export default function PageNavigation() {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <nav id="main-navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 justify-around">
          {navItems.map((item) => {
            const isActive = (item.href === '/' && pathname === '/') || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} legacyBehavior passHref>
                <a className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors w-1/4",
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}>
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </a>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav id="main-navigation" className="mt-8 mb-4 py-6 border-t border-b border-border/50">
      <div className="container mx-auto flex flex-row justify-around items-center gap-4">
        {navItems.map((item) => {
           const isActive = (item.href === '/' && pathname === '/') || (item.href !== '/' && pathname.startsWith(item.href));
           return (
            <Link key={item.href} href={item.href} legacyBehavior passHref>
              <a
                className={cn(
                  buttonVariants({ 
                    variant: isActive ? 'default' : 'outline', 
                    size: 'lg' 
                  }),
                  "w-full sm:w-auto flex-grow sm:flex-none text-base"
                )}
              >
                <item.icon className="ml-2 h-5 w-5" />
                {item.label}
              </a>
            </Link>
          )
        })}
      </div>
    </nav>
  );
}
