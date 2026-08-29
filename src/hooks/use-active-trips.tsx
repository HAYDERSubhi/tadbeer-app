// src/hooks/use-active-trips.tsx
"use client";

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getTrips } from '@/services/firestore';
import { effectiveStatus } from '@/app/(main)/tools/safarati/calc';
import type { Trip } from '@/types';

/**
 * السفرات الفعّالة الآن — مصدر مربع «ضمن سفرة» بشاشات إدخال المصروف الاعتيادية.
 *
 * قاعدة مقصودة: هوك مستقل لا توسعة لـ`use-app-data`: ذلك السياق يغذّي التطبيق كله،
 * وأي حقل يُضاف إليه يمسّ كل شاشة. هنا نستعمل **نفس مفتاح** الاستعلام الذي
 * تستعمله شاشات الأداة (`['trips', uid]`) فيخدمه React Query من نفس المخزن
 * بلا استعلام ثانٍ.
 *
 * لمستخدم بلا أي سفرة: القائمة فارغة دائماً، فلا يظهر أي عنصر بأي شاشة إدخال.
 */
export function useActiveTrips(): { activeTrips: Trip[]; isLoading: boolean } {
    const { user } = useAuth();

    const { data: trips = [], isLoading } = useQuery({
        queryKey: ['trips', user?.uid],
        queryFn: () => getTrips(user!.uid),
        enabled: !!user,
    });

    // الأحدث بدايةً أولاً — وهي الافتراضية عند وجود أكثر من سفرة فعّالة.
    const activeTrips = useMemo(
        () => trips
            .filter(t => effectiveStatus(t) === 'ACTIVE')
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
        [trips]
    );

    return { activeTrips, isLoading };
}
