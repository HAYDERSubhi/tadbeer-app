
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, BarChart3Icon, SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'الرئيسية', icon: HomeIcon },
  { href: '/stats', label: 'الإحصائيات', icon: BarChart3Icon },
  { href: '/settings', label: 'الإعدادات', icon: SettingsIcon },
];

export default function PageNavigation() {
  const pathname = usePathname();

  return (
    <nav className="mt-8 mb-4 py-6 border-t border-b border-border/50">
      <div className="container mx-auto flex flex-col sm:flex-row justify-around items-center gap-3 sm:gap-4">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} legacyBehavior passHref>
            <Button
              variant={pathname === item.href ? 'default' : 'outline'}
              className="w-full sm:w-auto flex-grow sm:flex-none px-8 py-3 text-base"
              size="lg"
            >
              <item.icon className="ml-2 h-5 w-5" />
              {item.label}
            </Button>
          </Link>
        ))}
      </div>
    </nav>
  );
}
