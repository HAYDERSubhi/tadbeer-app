
// src/hooks/use-app-data.tsx
"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useQuery, QueryClient } from '@tanstack/react-query';
import type { Expense, Goal, UserSettings, Income } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { getExpenses, getGoals, getIncomes, getUserSettings } from '@/services/firestore';
import { Loader2Icon } from 'lucide-react';
import FirestoreErrorAlert from '@/components/errors/firestore-error-alert';
import Logo from '@/components/ui/logo';

interface AppDataContextType {
    expenses: Expense[];
    goals: Goal[];
    incomes: Income[];
    userSettings: UserSettings;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    queryClient: QueryClient; // Expose queryClient
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
    const queryClient = new QueryClient(); // This should be ideally provided from a higher-level provider

    const { data: expenses = [], isLoading: expensesLoading, isError: expensesIsError, error: expensesError } = useQuery<Expense[], Error>({
        queryKey: ['expenses', user?.uid],
        queryFn: () => getExpenses(user!.uid),
        enabled: !!user,
        staleTime: 1000 * 60, // 1 minute
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

    const isLoading = expensesLoading || goalsLoading || incomesLoading || settingsLoading;
    const isError = expensesIsError || goalsIsError || incomesIsError || settingsIsError;
    
    // Combine errors, preferring the first one that occurred.
    const error = expensesError || goalsError || incomesError || settingsError;

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4 animate-pulse">
                    <Logo className="h-20 w-20" />
                    <h1 className="text-3xl font-bold text-primary">تدبير</h1>
                </div>
            </div>
        );
    }
    
    if (isError && error) {
        // You can decide which context to show, or create a more generic one.
        const errorContext = 
            expensesError ? "المصاريف" : 
            goalsError ? "الأهداف" :
            incomesError ? "الدخل" :
            "الإعدادات";
        return <FirestoreErrorAlert error={error} context={errorContext} />;
    }

    const value: AppDataContextType = {
        expenses,
        goals,
        incomes,
        userSettings, 
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
