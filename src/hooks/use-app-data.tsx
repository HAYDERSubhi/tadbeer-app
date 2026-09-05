// src/hooks/use-app-data.tsx
"use client";

import { createContext, useContext, useMemo, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Expense, Goal, UserSettings, Income, Household } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { getExpenses, getGoals, getIncomes, getUserSettings, getHousehold } from '@/services/firestore';
import { subMonths, startOfMonth } from 'date-fns';

interface AppDataContextType {
    expenses: Expense[];
    goals: Goal[];
    incomes: Income[];
    userSettings: UserSettings;
    household: Household | null;
    householdId: string | null;
    isLoading: boolean;
    /** True once the real settings have been fetched from Firestore (not just placeholder). */
    isSettingsFetched: boolean;
    /** True once the real expenses have been fetched (prevents stale-cache flash). */
    isExpensesFetched: boolean;
    isError: boolean;
    error: Error | null;
    queryClient: ReturnType<typeof useQueryClient>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

const defaultSettings: UserSettings = {
    budget: { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 },
    categoryBudgets: {},
    profile: {
        monthlyIncome: 0,
        familyMembers: [],
    },
    recurringPayments: [],
};

// Load the last 6 complete months + the current month.
// This covers: SixMonthChart, MonthlyComparisonCard, AiTrendsCard, budget widget.
// Pages that need the full history (stats, expenses) fetch separately.
// Computed at fetch time (not module load) so a long-lived PWA session that
// crosses a month boundary gets a fresh window on its next refetch.
export function getRecentStart(): Date {
    return startOfMonth(subMonths(new Date(), 6));
}

// ─── آخر معرّف عائلة معروف (ذاكرة محلية مربوطة بالحساب) ─────────────────────
// المشكلة: `getUserSettings` هي وحدها من تكشف `householdId`، والإعدادات تُرجع قيمة
// مبدئية فورية (placeholderData) تجعل `isLoading` تساوي false منذ أول رسم. فكانت
// استعلامات المصاريف/الأهداف/الدخل تنطلق فوراً بمسار **شخصي** (householdId = null)،
// ثم تصل الإعدادات الحقيقية فيتغيّر مفتاح الاستعلام وتنطلق **مرّة ثانية** بمسار العائلة:
// جلب مزدوج وشاشة تحميل مرّتين لكل عضو عائلة، بكل فتح بارد.
//
// الحل: نتذكّر آخر معرّف عائلة لهذا الحساب فنبدأ من المسار الصحيح مباشرةً.
// المفتاح **مربوط بالـ uid** (لا يتسرّب بين حسابين على نفس الجهاز) و**جديد**
// فلا يحتاج ترحيلاً ولا يمسح حالة أحد. وإن كانت القيمة قديمة (غادر العائلة من جهاز
// آخر) فأسوأ ما يحدث استعلام واحد مرفوض ثم تصحيح تلقائي فور وصول الإعدادات —
// والقيمة تُصحَّح على القرص بنفس اللحظة فلا تتكرّر.
const HH_CACHE_PREFIX = 'tadbeer-hh:';

function readCachedHouseholdId(uid?: string | null): string | null {
    if (!uid || typeof window === 'undefined') return null;
    try { return localStorage.getItem(HH_CACHE_PREFIX + uid) || null; } catch { return null; }
}

function writeCachedHouseholdId(uid: string, householdId: string | null) {
    if (typeof window === 'undefined') return;
    try {
        if (householdId) localStorage.setItem(HH_CACHE_PREFIX + uid, householdId);
        else localStorage.removeItem(HH_CACHE_PREFIX + uid);
    } catch { /* وضع التصفّح الخاص — لا ضرر، نعود للسلوك القديم */ }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Settings first (needed for householdId).
    // placeholderData gives instant default while fetching so isLoading=false;
    // isFetched is what tells us the REAL settings have landed.
    const {
        data: userSettings,
        isLoading: settingsLoading,
        isFetched: settingsFetched,
        isError: settingsIsError,
        error: settingsError,
    } = useQuery<UserSettings, Error>({
        queryKey: ['userSettings', user?.uid],
        queryFn: () => getUserSettings(user!.uid),
        enabled: !!user,
        placeholderData: defaultSettings,
        // 5 min — mutations always invalidate explicitly so longer stale is safe.
        staleTime: 1000 * 60 * 5,
    });

    // قبل وصول الإعدادات الحقيقية نستعمل آخر معرّف عائلة معروف بدل الافتراض بأنه
    // مستخدم فردي — وإلا انطلق كل استعلام مرّتين لأعضاء العائلة (انظر الشرح أعلاه).
    const cachedHouseholdId = useMemo(
        () => readCachedHouseholdId(user?.uid),
        [user?.uid]
    );
    const householdId = settingsFetched
        ? (userSettings?.householdId ?? null)
        : cachedHouseholdId;

    // خزّن القيمة الحقيقية فور وصولها (وامسحها إن غادر العائلة) كي يبدأ الفتح القادم صحيحاً.
    useEffect(() => {
        if (!user?.uid || !settingsFetched) return;
        writeCachedHouseholdId(user.uid, userSettings?.householdId ?? null);
    }, [user?.uid, settingsFetched, userSettings?.householdId]);

    // Recent expenses only (last ~7 months) — fast initial load for the homepage.
    // queryKey includes 'recent' so it coexists with the all-expenses cache entry.
    const {
        data: expenses = [],
        isLoading: expensesLoading,
        isFetched: expensesFetched,
        isError: expensesIsError,
        error: expensesError,
    } = useQuery<Expense[], Error>({
        // NOTE: keep this key exactly 4 elements — optimistic updates elsewhere
        // (manual form, add-expense page, expenses page) target it verbatim.
        // The window is computed fresh inside queryFn, so every actual fetch
        // (staleTime 5 min) uses an up-to-date 6-month window even in
        // long-lived PWA sessions that cross a month boundary.
        queryKey: ['expenses', user?.uid, householdId, 'recent'],
        queryFn: () => getExpenses(user!.uid, householdId, { startDate: getRecentStart() }),
        enabled: !!user && !settingsLoading,
        staleTime: 1000 * 60 * 5,
    });

    const { data: goals = [], isLoading: goalsLoading, isError: goalsIsError, error: goalsError } = useQuery<Goal[], Error>({
        queryKey: ['goals', user?.uid, householdId],
        queryFn: () => getGoals(user!.uid, householdId),
        enabled: !!user && !settingsLoading,
        staleTime: 1000 * 60 * 5,
    });

    const { data: incomes = [], isLoading: incomesLoading, isError: incomesIsError, error: incomesError } = useQuery<Income[], Error>({
        queryKey: ['incomes', user?.uid, householdId],
        queryFn: () => getIncomes(user!.uid, householdId),
        enabled: !!user && !settingsLoading,
        staleTime: 1000 * 60 * 5,
    });

    // Household doc (only when user is in a household)
    const { data: household = null } = useQuery<Household | null, Error>({
        queryKey: ['household', householdId],
        queryFn: () => getHousehold(householdId!),
        enabled: !!householdId,
        staleTime: 1000 * 60 * 10,
    });

    const isLoading = settingsLoading || expensesLoading || goalsLoading || incomesLoading;
    const isError = expensesIsError || goalsIsError || incomesIsError || settingsIsError;
    const error = expensesError || goalsError || incomesError || settingsError;

    const value: AppDataContextType = {
        expenses,
        goals,
        incomes,
        userSettings: userSettings || defaultSettings,
        household,
        householdId,
        isLoading,
        // "ready" = fetched from Firestore at least once. **لا** نشترط انتهاء إعادة الجلب
        // الخلفية: كان الشرط `&& !isRefetching` يُخفي بيانات المستخدم الظاهرة أمامه ويعيد
        // الشاشة كاملةً إلى مستطيلات رمادية عند كل إعادة جلب — أي عند السحب للتحديث،
        // وعند العودة للرئيسية بعد انقضاء staleTime (٥ دقائق) — رغم أن البيانات في الذاكرة
        // ولم تتغيّر. النتيجة كانت تطبيقاً يبدو أبطأ بكثير مما هو.
        // الآن يبقى المحتوى ظاهراً والتحديث يحصل بصمت خلفه.
        isSettingsFetched: settingsFetched,
        isExpensesFetched: expensesFetched,
        isError,
        error,
        queryClient,
    };

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useAppData = (): AppDataContextType => {
    const context = useContext(AppDataContext);
    if (context === undefined) {
        throw new Error('useAppData must be used within an AppDataProvider');
    }
    return context;
};
