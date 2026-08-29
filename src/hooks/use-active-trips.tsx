// src/hooks/use-active-trips.tsx
"use client";

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getTrips } from '@/services/firestore';
import { effectiveStatus, isWithinTripDays, startOfLocalDay } from '@/app/(main)/tools/safarati/calc';
import type { Trip } from '@/types';

/**
 * السفرات القابلة للوسم — مصدر مربع «ضمن سفرة» بشاشات إدخال المصروف الاعتيادية.
 *
 * قاعدة مقصودة: هوك مستقل لا توسعة لـ`use-app-data`: ذلك السياق يغذّي التطبيق كله،
 * وأي حقل يُضاف إليه يمسّ كل شاشة. هنا نستعمل **نفس مفتاح** الاستعلام الذي
 * تستعمله شاشات الأداة (`['trips', uid]`) فيخدمه React Query من نفس المخزن
 * بلا استعلام ثانٍ.
 *
 * النطاق: **من لحظة إنشاء السفرة** وحتى إغلاقها — لا نافذة زمنية قبل البداية.
 * السبب: إنشاء السفرة بحد ذاته إعلان نية، والحجوزات الكبرى (تذكرة، تأشيرة) تُدفع
 * قبل شهر أو أكثر. أي نافذة ثابتة (أسبوعان، شهر) رقم اعتباطي يفوّت حالات حقيقية.
 * الثمن الوحيد وجود مربع **غير مؤشَّر** — هادئ بصرياً ولا يفرض أي خطوة.
 *
 * لمستخدم بلا أي سفرة: القائمة فارغة دائماً، فلا يظهر أي عنصر بأي شاشة إدخال.
 */
export function useActiveTrips(): {
    /** كل ما يمكن وسمه الآن (مخطَّطة أو جارية أو منتهية غير مُغلقة). */
    activeTrips: Trip[];
    /** السفرة التي **يقع اليوم ضمن أيامها** — وهي وحدها ما تُؤشَّر افتراضياً. */
    travelingTrip: Trip | null;
    isLoading: boolean;
} {
    const { user } = useAuth();

    const { data: trips = [], isLoading } = useQuery({
        queryKey: ['trips', user?.uid],
        queryFn: () => getTrips(user!.uid),
        enabled: !!user,
    });

    const activeTrips = useMemo(() => {
        const today = startOfLocalDay(new Date()).getTime();
        return trips
            .filter(t => effectiveStatus(t) !== 'COMPLETED')
            // الترتيب: الجارية الآن أولاً، ثم الأقرب موعداً — فأول عنصر دائماً
            // هو الأوجه للعرض بالمربع.
            .sort((a, b) => {
                const aNow = isWithinTripDays(a) ? 0 : 1;
                const bNow = isWithinTripDays(b) ? 0 : 1;
                if (aNow !== bNow) return aNow - bNow;
                const dist = (t: Trip) =>
                    Math.abs(startOfLocalDay(new Date(t.startDate)).getTime() - today);
                return dist(a) - dist(b);
            });
    }, [trips]);

    const travelingTrip = useMemo(
        () => activeTrips.find(t => isWithinTripDays(t)) ?? null,
        [activeTrips]
    );

    return { activeTrips, travelingTrip, isLoading };
}
