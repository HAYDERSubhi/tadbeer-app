// src/hooks/use-badges.tsx
"use client";

/**
 * Badge computation hook.
 * Runs silently in the background, compares earned badges with
 * what the user has already unlocked, saves new ones + shows toast.
 */

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { getUserBadges, saveBadge, getReferralCount } from '@/services/firestore';
import { useToast } from '@/hooks/use-toast';
import { getBadgeDef, type BadgeId } from '@/lib/badges';
import { parseISO, differenceInCalendarDays, format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

// ── Helpers ─────────────────────────────────────────────────────────────────

function hasConsecutiveDays(dates: string[], count: number): boolean {
    if (dates.length < count) return false;
    // Unique date strings sorted
    const unique = [...new Set(dates.map(d => d.slice(0, 10)))].sort();
    let streak = 1;
    for (let i = 1; i < unique.length; i++) {
        const diff = differenceInCalendarDays(parseISO(unique[i]), parseISO(unique[i - 1]));
        if (diff === 1) {
            streak++;
            if (streak >= count) return true;
        } else {
            streak = 1;
        }
    }
    return false;
}

function hadZeroSpendDay(expenseDates: string[]): boolean {
    if (expenseDates.length === 0) return false;
    const dateSet = new Set(expenseDates.map(d => d.slice(0, 10)));
    const earliest = expenseDates.map(d => d.slice(0, 10)).sort()[0];
    const today = format(new Date(), 'yyyy-MM-dd');
    // Walk from earliest to yesterday and check if any day has 0 expenses
    let cur = new Date(earliest);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    while (cur <= yesterday) {
        const key = format(cur, 'yyyy-MM-dd');
        if (!dateSet.has(key)) return true;
        cur.setDate(cur.getDate() + 1);
    }
    return false;
}

function finishedMonthUnderBudget(
    expenseDates: string[],
    expenseAmounts: number[],
    budget: number,
    savingsPct = 0
): boolean {
    if (!budget) return false;
    const now = new Date();
    // Check previous month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const start = startOfMonth(prevMonth);
    const end = endOfMonth(prevMonth);
    let total = 0;
    expenseDates.forEach((d, i) => {
        try {
            if (isWithinInterval(parseISO(d), { start, end })) total += expenseAmounts[i];
        } catch { /* noop */ }
    });
    if (total === 0) return false; // no expenses last month → skip
    const saved = budget - total;
    if (savingsPct > 0) return saved >= budget * savingsPct;
    return saved > 0; // any saving
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBadges() {
    const { user } = useAuth();
    const { expenses, userSettings, householdId } = useAppData();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const savingRef = useRef<Set<string>>(new Set()); // prevent double-save in same session

    const { data: earnedBadges = [] } = useQuery({
        queryKey: ['badges', user?.uid],
        queryFn: () => getUserBadges(user!.uid),
        enabled: !!user,
        staleTime: 1000 * 60 * 10,
    });

    const { data: referralCount = 0 } = useQuery({
        queryKey: ['referralCount', user?.uid],
        queryFn: () => getReferralCount(user!.uid),
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    });

    useEffect(() => {
        if (!user || earnedBadges === undefined) return;

        const earnedIds = new Set(earnedBadges.map(b => b.id));
        const budget = userSettings?.budget?.totalBudget ?? 0;
        const expenseDates = expenses.map(e => e.date);
        const expenseAmounts = expenses.map(e => e.amount);

        const checkAndAward = async (id: BadgeId, condition: boolean) => {
            if (!condition) return;
            if (earnedIds.has(id)) return;
            if (savingRef.current.has(id)) return;
            savingRef.current.add(id);

            await saveBadge(user.uid, id);
            queryClient.invalidateQueries({ queryKey: ['badges', user.uid] });

            const def = getBadgeDef(id);
            if (def) {
                toast({
                    title: `${def.icon} إنجاز جديد — ${def.name}!`,
                    description: def.description,
                });
            }
        };

        // Evaluate all badges
        const checks: Array<[BadgeId, boolean]> = [
            ['first_expense',  expenses.length > 0],
            ['week_logger',    hasConsecutiveDays(expenseDates, 7)],
            ['zero_day',       hadZeroSpendDay(expenseDates)],
            ['family_leader',  !!householdId],
            // report_viewer: only true if user explicitly visited /report page
            // (flag set ONLY in report/page.tsx, NOT in achievements page)
            ['report_viewer',  typeof window !== 'undefined' && localStorage.getItem('tadbeer-report-viewed') === '1'],
            ['month_saver',    finishedMonthUnderBudget(expenseDates, expenseAmounts, budget, 0)],
            ['big_saver',      finishedMonthUnderBudget(expenseDates, expenseAmounts, budget, 0.2)],
            ['first_referral', referralCount >= 1],
            ['social_pro',     referralCount >= 3],
        ];

        checks.forEach(([id, cond]) => checkAndAward(id, cond));

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expenses, userSettings, householdId, earnedBadges, referralCount, user]);

    return { earnedBadges, referralCount };
}
