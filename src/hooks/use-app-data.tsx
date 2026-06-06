// src/hooks/use-app-data.tsx
"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Expense, Goal, UserSettings, Income, Household } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { getExpenses, getGoals, getIncomes, getUserSettings, getHousehold } from '@/services/firestore';

interface AppDataContextType {
    expenses: Expense[];
    goals: Goal[];
    incomes: Income[];
    userSettings: UserSettings;
    household: Household | null;
    householdId: string | null;
    isLoading: boolean;
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

export function AppDataProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Settings first (needed for householdId)
    const { data: userSettings, isLoading: settingsLoading, isError: settingsIsError, error: settingsError } = useQuery<UserSettings, Error>({
        queryKey: ['userSettings', user?.uid],
        queryFn: () => getUserSettings(user!.uid),
        enabled: !!user,
        placeholderData: defaultSettings,
        staleTime: 1000 * 60,
    });

    const householdId = userSettings?.householdId ?? null;

    // Data queries — use householdId when available
    const { data: expenses = [], isLoading: expensesLoading, isError: expensesIsError, error: expensesError } = useQuery<Expense[], Error>({
        queryKey: ['expenses', user?.uid, householdId],
        queryFn: () => getExpenses(user!.uid, householdId),
        enabled: !!user && !settingsLoading,
        staleTime: 1000 * 60,
    });

    const { data: goals = [], isLoading: goalsLoading, isError: goalsIsError, error: goalsError } = useQuery<Goal[], Error>({
        queryKey: ['goals', user?.uid, householdId],
        queryFn: () => getGoals(user!.uid, householdId),
        enabled: !!user && !settingsLoading,
        staleTime: 1000 * 60,
    });

    const { data: incomes = [], isLoading: incomesLoading, isError: incomesIsError, error: incomesError } = useQuery<Income[], Error>({
        queryKey: ['incomes', user?.uid],
        queryFn: () => getIncomes(user!.uid),
        enabled: !!user,
        staleTime: 1000 * 60,
    });

    // Household doc (only when user is in a household)
    const { data: household = null } = useQuery<Household | null, Error>({
        queryKey: ['household', householdId],
        queryFn: () => getHousehold(householdId!),
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5,
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
