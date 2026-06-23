// src/app/(main)/achievements/page.tsx
"use client";

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getUserBadges, getReferralCount } from '@/services/firestore';
import { BADGES, getBadgeDef } from '@/lib/badges';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';
import { Copy, Share2, Trophy, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

export default function AchievementsPage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const { data: earnedBadges = [] } = useQuery({
        queryKey: ['badges', user?.uid],
        queryFn: () => getUserBadges(user!.uid),
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    });

    const { data: referralCount = 0 } = useQuery({
        queryKey: ['referralCount', user?.uid],
        queryFn: () => getReferralCount(user!.uid),
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    });

    try { localStorage.removeItem('tadbeer-new-badge'); } catch {}

    // NOTE: do NOT set tadbeer-report-viewed here.
    // That flag is only set when user actually visits /report page.

    const shareBadge = async (badge: { icon: string; name: string; description: string }) => {
        const text = `${badge.icon} حصلت على شارة "${badge.name}" في تدبير!\n${badge.description}`;
        const url = 'https://tadbeer.app';
        if (navigator.share) {
            await navigator.share({ title: 'تدبير — إنجاز جديد!', text, url }).catch(() => {});
        } else {
            await navigator.clipboard.writeText(`${text}\n${url}`);
            toast({ title: 'تم نسخ النص! 📋' });
        }
    };

    const earnedIds = new Set(earnedBadges.map(b => b.id));
    const earnedCount = earnedBadges.length;
    const totalCount = BADGES.length;

    // Referral link
    const referralLink = user ? `https://tadbeer.app/login?ref=${user.uid}` : '';

    const copyReferralLink = async () => {
        if (!referralLink) return;
        if (navigator.share) {
            await navigator.share({
                title: 'تدبير — تطبيق إدارة المصاريف',
                text: 'جرّب تدبير لإدارة مصاريفك بذكاء! 💰',
                url: referralLink,
            });
        } else {
            await navigator.clipboard.writeText(referralLink);
            toast({ title: 'تم نسخ رابط الدعوة! 📋' });
        }
    };

    const getEarnedDate = (badgeId: string): string | null => {
        const b = earnedBadges.find(e => e.id === badgeId);
        if (!b) return null;
        try {
            return format(new Date(b.earnedAt), 'd MMM yyyy', { locale: arIQ });
        } catch { return null; }
    };

    return (
        <div className="space-y-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                <h1 className="text-xl font-bold">الإنجازات والشارات</h1>
            </div>

            {/* Progress */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">تقدمك</span>
                        <span className="text-sm font-bold text-primary">{earnedCount} من {totalCount}</span>
                    </div>
                    <Progress value={(earnedCount / totalCount) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        {earnedCount === totalCount
                            ? '🎉 أحرزت جميع الشارات! أنت بطل!'
                            : `تبقى ${totalCount - earnedCount} شارة للاكتمال`}
                    </p>
                </CardContent>
            </Card>

            {/* Badges Grid */}
            <div className="grid grid-cols-1 gap-3">
                {/* Earned first */}
                {BADGES.filter(b => earnedIds.has(b.id)).map(badge => (
                    <div
                        key={badge.id}
                        className={cn(
                            'flex items-center gap-3 rounded-xl p-3 border',
                            badge.color,
                            'border-transparent'
                        )}
                    >
                        <div className="text-3xl w-12 h-12 flex items-center justify-center rounded-full bg-white/50 dark:bg-black/20 shrink-0">
                            {badge.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={cn('font-bold text-sm', badge.textColor)}>{badge.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            <p className="text-[10px] text-muted-foreground">
                                {getEarnedDate(badge.id)}
                            </p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ مفتوح</p>
                            <button
                                onClick={() => shareBadge(badge)}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                                aria-label="شارك الشارة"
                            >
                                <Share2 className="h-3 w-3" />
                                شارك
                            </button>
                        </div>
                    </div>
                ))}

                {/* Locked */}
                {BADGES.filter(b => !earnedIds.has(b.id)).map(badge => (
                    <div
                        key={badge.id}
                        className="flex items-center gap-3 rounded-xl p-3 border border-dashed border-border bg-muted/30 opacity-60"
                    >
                        <div className="text-3xl w-12 h-12 flex items-center justify-center rounded-full bg-muted shrink-0 grayscale">
                            {badge.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-muted-foreground">{badge.name}</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">{badge.description}</p>
                        </div>
                        <Lock className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </div>
                ))}
            </div>

            {/* Referral Section */}
            <Card className="mt-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        🤝 دعوة أصدقاء
                    </CardTitle>
                    <CardDescription>
                        شارك تدبير مع أصدقائك واكسب شارات حصرية
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Count + progress */}
                    <div className="rounded-xl bg-muted/60 px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">الأصدقاء المدعوون</p>
                                <p className="text-3xl font-bold text-primary">{referralCount}</p>
                            </div>
                            <div className="text-right">
                                {referralCount >= 3 ? (
                                    <p className="text-xs text-emerald-500 font-medium">✓ ناشر تدبير مكتملة!</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">{referralCount} من 3 أصدقاء</p>
                                )}
                            </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-background overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min((referralCount / 3) * 100, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            {[1, 2, 3].map(n => (
                                <span key={n} className={cn(referralCount >= n ? 'text-primary font-medium' : '')}>
                                    {referralCount >= n ? '●' : '○'} صديق {n}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Share button */}
                    <Button className="w-full gap-2" onClick={copyReferralLink}>
                        <Share2 className="h-4 w-4" />
                        مشاركة رابط الدعوة
                    </Button>

                    <p className="text-[10px] text-muted-foreground text-center">
                        عندما يسجّل صديقك عبر رابطك الخاص، يُحسب لك تلقائياً
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
