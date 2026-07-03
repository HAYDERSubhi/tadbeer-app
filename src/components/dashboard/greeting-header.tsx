"use client";

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';
import { ChevronLeft } from 'lucide-react';

function timeGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'صباح الخير', emoji: '☀️' };
  if (hour >= 12 && hour < 17) return { text: 'مساء الخير', emoji: '🌤️' };
  return { text: 'مساء الخير', emoji: '🌙' };
}

export function GreetingHeader() {
  const { user } = useAuth();

  const fullName = user?.displayName?.trim() || '';
  const firstName = fullName.split(/\s+/)[0] || '';
  const { text, emoji } = timeGreeting();
  const today = format(new Date(), 'EEEE، d MMMM', { locale: arIQ });

  return (
    <div className="flex items-center gap-3 px-1 pt-1">
      <Link href="/settings" aria-label="الملف الشخصي" className="shrink-0 active:scale-95 transition-transform">
        <Avatar className="h-11 w-11 ring-2 ring-primary/20">
          {user?.photoURL && (
            <AvatarImage src={user.photoURL} alt={fullName || 'الصورة الشخصية'} referrerPolicy="no-referrer" />
          )}
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
            {firstName ? firstName.charAt(0) : '👋'}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0">
        <p className="font-bold text-base text-foreground truncate">
          {firstName ? `${text}، ${firstName} ${emoji}` : `${text} ${emoji}`}
        </p>
        {firstName ? (
          <p className="text-[11px] text-muted-foreground">{today}</p>
        ) : (
          <Link href="/settings" className="flex items-center gap-0.5 text-[11px] text-primary py-0.5">
            شنو نناديك؟ أضف اسمك
            <ChevronLeft className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
