// src/hooks/use-save-category.tsx
"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { updateUserSettings } from '@/services/firestore';
import type { Category } from '@/types';

/**
 * Shared hook to add a new custom category from anywhere (add-expense screen,
 * voice-review form). Uses the exact same persistence path as the settings page:
 * it writes the full merged category list back via updateUserSettings, passing
 * householdId so family members write to the shared household doc (not their
 * personal doc). Returns the freshly-created category so the caller can
 * auto-select it for the expense being logged.
 */
export const useSaveCategory = () => {
    const { user } = useAuth();
    const { householdId } = useAppData();
    const { categories } = useCategories();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (updatedCategories: Category[]) =>
            updateUserSettings(user!.uid, { categories: updatedCategories }, householdId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
        },
    });

    const addCategory = async (data: { name: string; icon: string }): Promise<Category> => {
        const newCategory: Category = {
            id: data.name.toLowerCase().replace(/\s+/g, '_') + '_' + crypto.randomUUID().slice(0, 4),
            name: data.name,
            icon: data.icon,
            color: '1',
            isDefault: false,
        };
        await mutation.mutateAsync([...categories, newCategory]);
        return newCategory;
    };

    return { addCategory, isSaving: mutation.isPending };
};
