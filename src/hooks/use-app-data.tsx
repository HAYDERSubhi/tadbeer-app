// src/hooks/use-app-data.tsx
"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Expense, Goal, UserSettings, Income } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { getExpenses, getGoals, getIncomes, getUserSettings } from '@/services/firestore';
import { Loader2Icon } from 'lucide-react';
import FirestoreErrorAlert from '@/components/errors/firestore-error-alert';

interface AppDataContextType {
    expenses: Expense[];
    goals: Goal[];
    incomes: Income[];
    userSettings: UserSettings;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    const { data: expenses = [], isLoading: expensesLoading, isError: expensesIsError, error: expensesError } = useQuery<Expense[], Error>({
        queryKey: ['expenses', user?.uid],
        queryFn: () => getExpenses(user!.uid),
        enabled: !!user,
    });

    const { data: goals = [], isLoading: goalsLoading, isError: goalsIsError, error: goalsError } = useQuery<Goal[], Error>({
        queryKey: ['goals', user?.uid],
        queryFn: () => getGoals(user!.uid),
        enabled: !!user,
    });

    const { data: incomes = [], isLoading: incomesLoading, isError: incomesIsError, error: incomesError } = useQuery<Income[], Error>({
        queryKey: ['incomes', user?.uid],
        queryFn: () => getIncomes(user!.uid),
        enabled: !!user,
    });

    const { data: userSettings, isLoading: settingsLoading, isError: settingsIsError, error: settingsError } = useQuery<UserSettings, Error>({
        queryKey: ['userSettings', user?.uid],
        queryFn: () => getUserSettings(user!.uid),
        enabled: !!user,
    });

    const isLoading = expensesLoading || goalsLoading || incomesLoading || settingsLoading;
    const isError = expensesIsError || goalsIsError || incomesIsError || settingsIsError;
    
    // Combine errors, preferring the first one that occurred.
    const error = expensesError || goalsError || incomesError || settingsError;

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2Icon className="h-12 w-12 animate-spin text-primary" />
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
        userSettings: userSettings!, // We can assert non-null because we handle loading/error states
        isLoading,
        isError,
        error,
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
