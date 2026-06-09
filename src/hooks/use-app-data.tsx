// src/hooks/use-app-data.tsx
"use client";

import { createContext, useContext, useMemo, ReactNode } from 'react';
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
const RECENT_START = startOfMonth(subMonths(new Date(), 6));

export function AppDataProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Settings first (needed for householdId).
    // placeholderData gives instant default while fetching so isLoading=false,
    // but isFetched+isRefetching tells us if REAL data has settled.
    const {
        data: userSettings,
        isLoading: settingsLoading,
        isFetched: settingsFetched,
        isRefetching: settingsRefetching,
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

    const householdId = userSettings?.householdId ?? null;

    // Recent expenses only (last ~7 months) — fast initial load for the homepage.
    // queryKey includes 'recent' so it coexists with the all-expenses cache entry.
    const {
        data: expenses = [],
        isLoading: expensesLoading,
        isFetched: expensesFetched,
        isRefetching: expensesRefetching,
        isError: expensesIsError,
        error: expensesError,
    } = useQuery<Expense[], Error>({
        queryKey: ['expenses', user?.uid, householdId, 'recent'],
        queryFn: () => getExpenses(user!.uid, householdId, { startDate: RECENT_START }),
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
        queryKey: ['incomes', user?.uid],
        queryFn: () => getIncomes(user!.uid),
        enabled: !!user,
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
        // "truly ready" = fetched at least once AND not currently re-fetching stale data.
        // This prevents showing stale cached data during background refetch.
        isSettingsFetched: settingsFetched && !settingsRefetching,
        isExpensesFetched: expensesFetched && !expensesRefetching,
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
