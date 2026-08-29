// src/components/expenses/trip-expense-field.tsx
"use client";

/**
 * مربع «ضمن سفرة» + منتقي تصنيف السفرة الثماني — لشاشات إدخال المصروف الاعتيادية.
 *
 * قاعدة مقفلة — مسموح بثلاث نقاط إنشاء فقط: شاشة إضافة المصروف، نموذج المصروف اليدوي/الصوتي،
 * ومسح الفاتورة (إضافةً لنموذج التعديل لتصحيح وسم منسي أو خاطئ).
 * **ممنوع** بزر «تم الدفع» بالفواتير القادمة وبالاستيراد من ملف: النقطتان تنشئان
 * مصاريف مشتقّة لا يكتبها المستخدم لحظياً — فاتورة كهرباء البيت تنشتغل وهو مسافر،
 * ووسمها تلقائياً كمصروف سفرة يخرّب رقم السفرة بصمت.
 *
 * بغياب أي سفرة فعّالة لا يُرسَم أي عنصر إطلاقاً (المكوّن يُرجع null).
 */

import { Plane } from 'lucide-react';
import type { Trip, TripCategory } from '@/types';
import {
  TRIP_CATEGORIES, TRIP_CATEGORY_LABEL,
} from '@/app/(main)/tools/safarati/calc';
import { TRIP_CATEGORY_ICON } from '@/app/(main)/tools/safarati/icons';

/** علامة صح خطّية — بلا إيموجي، مطابقةً لأسلوب أيقونات تدبير. */
function CheckMark() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export function TripExpenseToggle({ activeTrips, selectedTripId, onSelect }: {
  activeTrips: Trip[];
  selectedTripId: string | null;
  onSelect: (tripId: string | null) => void;
}) {
  if (activeTrips.length === 0) return null;

  const current = activeTrips.find(t => t.id === selectedTripId) ?? activeTrips[0];
  const checked = !!selectedTripId;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
      <button type="button" onClick={() => onSelect(checked ? null : current.id)}
              className="flex items-center gap-2.5 w-full text-start">
        <span className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
          checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-background'
        }`}>
          {checked && <CheckMark />}
        </span>
        <Plane className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium min-w-0 truncate">
          ضمن سفرة: {current.name}
        </span>
      </button>

      {/* أكثر من سفرة فعّالة (نادر لكنه ممكن) — اختيار قصير، والافتراضي أحدث بداية. */}
      {checked && activeTrips.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {activeTrips.map(t => (
            <button key={t.id} type="button" onClick={() => onSelect(t.id)}
              className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                t.id === current.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * منتقي تصنيف السفرة الثماني — يحلّ محل قائمة فئات تدبير الاثنتي عشرة عند
 * التأشير. الحقل العام category يُقفَل برمجياً على «سفر» ولا يختاره المستخدم.
 */
export function TripCategoryPicker({ value, onChange }: {
  value: TripCategory;
  onChange: (c: TripCategory) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">اختر تصنيف مصروف السفرة</p>
      {/* عمودان لا أربعة: بأربعة أعمدة على شاشة 375px لا يتّسع اسم التصنيف
          بحجم مقروء (text-sm)، فينكسر أو يُقتطع. */}
      <div className="grid grid-cols-2 gap-2">
        {TRIP_CATEGORIES.map(c => {
          const Icon = TRIP_CATEGORY_ICON[c];
          const on = value === c;
          return (
            <button key={c} type="button" onClick={() => onChange(c)}
              className={`flex items-center gap-2 py-2.5 px-2.5 rounded-xl border-2 transition-all active:scale-95 text-start ${
                on ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-muted/50 text-foreground/75'
              }`}>
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-sm leading-tight truncate">{TRIP_CATEGORY_LABEL[c]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
