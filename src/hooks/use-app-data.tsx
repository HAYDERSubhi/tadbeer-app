// src/hooks/use-app-data.tsx
"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Expense, Goal, UserSettings, Income } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { getExpenses, getGoals, getIncomes, getUserSettings } from '@/services/firestore';

interface AppDataContextType {
    expenses: Expense[];
    goals: Goal[];
    incomes: Income[];
    userSettings: UserSettings;
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

    const { data: expenses = [], isLoading: expensesLoading, isError: expensesIsError, error: expensesError } = useQuery<Expense[], Error>({
        queryKey: ['expenses', user?.uid],
        queryFn: () => getExpenses(user!.uid),
        enabled: !!user,
        staleTime: 1000 * 60,
    });

    const { data: goals = [], isLoading: goalsLoading, isError: goalsIsError, error: goalsError } = useQuery<Goal[], Error>({
        queryKey: ['goals', user?.uid],
        queryFn: () => getGoals(user!.uid),
        enabled: !!user,
        staleTime: 1000 * 60,
    });

    const { data: incomes = [], isLoading: incomesLoading, isError: incomesIsError, error: incomesError } = useQuery<Income[], Error>({
        queryKey: ['incomes', user?.uid],
        queryFn: () => getIncomes(user!.uid),
        enabled: !!user,
        staleTime: 1000 * 60,
    });

    const { data: userSettings, isLoading: settingsLoading, isError: settingsIsError, error: settingsError } = useQuery<UserSettings, Error>({
        queryKey: ['userSettings', user?.uid],
        queryFn: () => getUserSettings(user!.uid),
        enabled: !!user,
        placeholderData: defaultSettings,
        staleTime: 1000 * 60,
    });

    // We no longer block the entire UI here. 
    // Sub-components will use these flags to show local skeletons.
    const isLoading = expensesLoading || goalsLoading || incomesLoading || settingsLoading;
    const isError = expensesIsError || goalsIsError || incomesIsError || settingsIsError;
    const error = expensesError || goalsError || incomesError || settingsError;

    const value: AppDataContextType = {
        expenses,
        goals,
        incomes,
        userSettings: userSettings || defaultSettings, 
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
