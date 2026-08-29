// src/hooks/use-categories.tsx
"use client";

import { useMemo } from 'react';
import { useAppData } from '@/hooks/use-app-data';
import { DEFAULT_CATEGORIES, SYSTEM_CATEGORIES, SYSTEM_CATEGORY_IDS } from '@/lib/constants';
import type { Category } from '@/types';
import { CATEGORY_ICON_MAP } from '@/lib/category-icons';
import React from 'react';

// خريطة الأيقونات المركزية (Lucide) — مصدر واحد مشترك مع منتقي نافذة الفئة.
const ICON_MAP = CATEGORY_ICON_MAP;

/**
 * A custom hook to get the final, merged list of expense categories.
 * It combines the default categories with the user's custom categories from settings.
 * It also ensures that any category used in an existing expense is included, even if deleted.
 */
export const useCategories = () => {
    const { userSettings, expenses } = useAppData();

    const categories = useMemo(() => {
        const userCategories = userSettings?.categories || [];
        
        // Create a map of all known categories (default + user-defined)
        const allCategoriesMap = new Map<string, Category>();

        // 1. Add all default categories to the map
        Object.values(DEFAULT_CATEGORIES).forEach(cat => {
            allCategoriesMap.set(cat.id, { ...cat, isDefault: true });
        });
        
        // 2. Add/override with user-defined categories
        if (userCategories.length > 0) {
            userCategories.forEach(userCat => {
                allCategoriesMap.set(userCat.id, userCat);
            });
        } else {
            // If user has no categories saved, we assume they are using the defaults.
            // This case is primarily for new users. The settings save logic will persist these.
        }

        // 3. Ensure any category referenced in an expense exists in the final list
        // This prevents crashes if a category was deleted after being used.
        expenses.forEach(expense => {
            // فئة نظامية (مثل «سفر» لأداة سفراتي): تُدرَج بتعريفها الكامل من
            // constants (اسم + أيقونة + لون مخطط) بدل أن يبتلعها فرع «محذوفة»
            // أدناه فتظهر بالإحصائيات والتقرير باسم «محذوفة (سفر)» وأيقونة سلّة.
            // تُستثنى بعدها من قوائم الاختيار عبر selectableCategories أدناه.
            if (SYSTEM_CATEGORY_IDS.has(expense.category)) {
                if (!allCategoriesMap.has(expense.category)) {
                    allCategoriesMap.set(expense.category, {
                        ...SYSTEM_CATEGORIES[expense.category],
                        isDefault: true,
                    });
                }
                return;
            }
            if (!allCategoriesMap.has(expense.category)) {
                // If an expense's category is missing, add a fallback "deleted" category
                allCategoriesMap.set(expense.category, {
                    id: expense.category,
                    name: `محذوفة (${expense.category})`,
                    icon: '🗑️',
                    color: '5', // A neutral color for deleted items
                    isDefault: false
                });
            }
        });

        // Convert the map back to an array
        const finalCategories = Array.from(allCategoriesMap.values());
        
        // Sort categories: default ones first, then user-created ones alphabetically
        finalCategories.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name, 'ar');
        });

        return finalCategories;
    }, [userSettings?.categories, expenses]);

    /**
     * القائمة المخصّصة للاختيار اليدوي — بلا الفئات النظامية («سفر» لسفراتي).
     * مصدر واحد يستهلكه: كل قوائم اختيار الفئة، وخريطة الفئات المُمرَّرة لاقتراح
     * الفئة بالذكاء الاصطناعي، وكل حفظ يُعيد كتابة فئات المستخدم بالإعدادات.
     * حصر الاستثناء هنا (لا تكراره بست شاشات) يمنع نسيانه بأي شاشة إدخال لاحقة.
     * لمستخدم بلا مصاريف سفر، محتواها مطابق تماماً لـ categories.
     */
    const selectableCategories = useMemo(
        () => categories.filter(c => !SYSTEM_CATEGORY_IDS.has(c.id)),
        [categories]
    );

    const categoryMap = useMemo(() => {
      return categories.reduce((acc, cat) => {
        acc[cat.id] = cat;
        return acc;
      }, {} as Record<string, Category>);
    }, [categories]);

    // Helper to get icon component from name string
    const getIconComponent = (iconName: string): React.ReactNode => {
        const IconComponent = ICON_MAP[iconName];
        if (IconComponent) {
            return React.createElement(IconComponent);
        }
        return iconName; // Fallback to rendering the emoji/string directly
    };

    return { categories, selectableCategories, categoryMap, getIconComponent };
};
