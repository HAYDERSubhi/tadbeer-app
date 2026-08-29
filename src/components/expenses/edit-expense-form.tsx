// src/components/expenses/edit-expense-form.tsx
"use client";

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2Icon, PencilIcon } from 'lucide-react';
import { format, isBefore, startOfMonth, parseISO } from 'date-fns';
import { arIQ, formatYearMonth } from '@/lib/arabic-date';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { normalizeDigits } from '@/lib/normalize-digits';
import type { Expense, TripCategory } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateExpense } from '@/services/firestore';
import { useCategories } from '@/hooks/use-categories';
import { useActiveTrips } from '@/hooks/use-active-trips';
import { TripExpenseToggle } from '@/components/expenses/trip-expense-field';
import { TRIP_CATEGORIES, TRIP_CATEGORY_LABEL } from '@/app/(main)/tools/safarati/calc';
import { TRAVEL_CATEGORY_ID } from '@/lib/constants';

const expenseSchema = z.object({
  title: z.string().min(1, { message: 'العنوان مطلوب' }),
  amount: z.coerce.number().min(1, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  category: z.string().min(1, { message: 'الفئة مطلوبة' }),
  date: z.date({ required_error: 'التاريخ مطلوب' }),
  isOutOfBudget: z.boolean().optional(),
  outOfBudgetDetails: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

export default function EditExpenseForm({ expense, setOpen }: { expense: Expense, setOpen: (open: boolean) => void }) {
  const { user } = useAuth();
  const { householdId } = useAppData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // الفئات القابلة للاختيار فقط — «سفر» النظامية مستثناة مركزياً (سفراتي).
  const { selectableCategories: categories, getIconComponent } = useCategories();

  // ── سفراتي: بالتعديل، الحالة الابتدائية تعكس المصروف نفسه ولا تُؤشَّر افتراضياً.
  // تأشير مصروف قائم تلقائياً معناه إعادة وسمه بصمت — عكس المطلوب تماماً.
  const { activeTrips } = useActiveTrips();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(expense.tripId ?? null);
  const [tripCategory, setTripCategory] = useState<TripCategory>(expense.tripCategory ?? 'other');
  const selectedTrip = activeTrips.find(t => t.id === selectedTripId) ?? null;
  // مصروف يتبع سفرة منتهية: لا تُعرض أي أداة وسم، وتبقى حقوله كما هي عند الحفظ.
  const belongsToClosedTrip = !!expense.tripId && !activeTrips.some(t => t.id === expense.tripId);

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      date: new Date(expense.date),
      isOutOfBudget: expense.isOutOfBudget || false,
      outOfBudgetDetails: expense.outOfBudgetDetails || '',
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>) => updateExpense(user!.uid, expense.id, data, householdId),
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
        toast({
          title: "تم التحديث بنجاح!",
          description: `تم تحديث مصروف "${variables.title}".`,
        });
        setOpen(false);
        form.reset();
    },
    onError: () => {
        toast({
          title: "خطأ في التحديث",
          description: "لم نتمكن من تحديث المصروف.",
          variant: "destructive",
        });
    }
  });

  // Holds form data awaiting confirmation when editing a closed (past) month.
  const [pendingPastEdit, setPendingPastEdit] = useState<ExpenseFormData | null>(null);

  // Is the ORIGINAL expense dated in a month before the current one?
  const isPastMonthExpense = (() => {
    try { return isBefore(parseISO(expense.date), startOfMonth(new Date())); }
    catch { return false; }
  })();

  const expenseMonthLabel = (() => {
    try { return formatYearMonth(format(parseISO(expense.date), 'yyyy-MM')); }
    catch { return ''; }
  })();

  /**
   * يبني حمولة الحفظ حسب حالة الوسم:
   * - سفرة منتهية: لا تُمرَّر حقول السفرة إطلاقاً فتبقى كما هي بالمستند.
   * - موسوم بسفرة فعّالة: الفئة تُقفَل على «سفر» وحالة الميزانية مشتقّة منها.
   * - فُكّ الوسم: يُفرَّغ tripId بنص فارغ (لا undefined — فـFirestore مضبوط على
   *   تجاهل غير المعرَّف فلا يُحذف الحقل)، وتُستعمل الفئة التي اختارها المستخدم.
   */
  const buildPayload = (data: ExpenseFormData) => {
    const base = { ...data, date: data.date.toISOString() };
    if (belongsToClosedTrip) return base;
    if (selectedTrip) {
      return {
        ...base,
        category: TRAVEL_CATEGORY_ID,
        tripId: selectedTrip.id,
        tripCategory,
        isOutOfBudget: !selectedTrip.countsInBudget,
      };
    }
    if (expense.tripId) return { ...base, tripId: '', tripCategory: undefined };
    return base;
  };

  const onSubmit = (data: ExpenseFormData) => {
    if (!user) return;
    // Editing a past month changes historical reports — confirm first.
    if (isPastMonthExpense) {
      setPendingPastEdit(data);
      return;
    }
    updateExpenseMutation.mutate(buildPayload(data));
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
      <div>
        <Label htmlFor="title">العنوان</Label>
        <Input id="title" {...form.register('title')} placeholder="مثال: غداء عمل" />
        {form.formState.errors.title && <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">المبلغ (د.ع)</Label>
          <Controller
            name="amount"
            control={form.control}
            render={({ field }) => (
              <Input
                id="amount"
                inputMode="numeric"
                placeholder="25,000"
                value={field.value ? Number(field.value).toLocaleString('en-US') : ''}
                onChange={(e) => {
                  const raw = normalizeDigits(e.target.value).replace(/,/g, '').replace(/\D/g, '');
                  field.onChange(raw ? Number(raw) : 0);
                }}
              />
            )}
          />
          {form.formState.errors.amount && <p className="text-sm text-destructive mt-1">{form.formState.errors.amount.message}</p>}
        </div>
        <div>
          <Label htmlFor="category">الفئة</Label>
          {selectedTrip || belongsToClosedTrip ? (
            <Select value={tripCategory} disabled={belongsToClosedTrip}
                    onValueChange={v => setTripCategory(v as TripCategory)}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIP_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{TRIP_CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
          <Controller
            name="category"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="اختر فئة" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                       <span className="mr-2">{getIconComponent(cat.icon)}</span>
                       <span>{cat.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          )}
          {form.formState.errors.category && <p className="text-sm text-destructive mt-1">{form.formState.errors.category.message}</p>}
        </div>
      </div>

      {/* ─── سفراتي: وسم/فكّ وسم مصروف قائم ─── */}
      {belongsToClosedTrip ? (
        <p className="text-xs text-muted-foreground">هذا المصروف ضمن سفرة منتهية — وسمه لا يتغيّر.</p>
      ) : (
        <TripExpenseToggle activeTrips={activeTrips} selectedTripId={selectedTripId} onSelect={setSelectedTripId} />
      )}
      
      <div>
        <Label htmlFor="date">التاريخ</Label>
        <Controller
          name="date"
          control={form.control}
          render={({ field }) => (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !field.value && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? format(field.value, "PPP", { locale: arIQ }) : <span>اختر تاريخاً</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  initialFocus
                  dir="rtl"
                  locale={arIQ}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                />
              </PopoverContent>
            </Popover>
          )}
        />
        {form.formState.errors.date && <p className="text-sm text-destructive mt-1">{form.formState.errors.date.message}</p>}
      </div>

      <div className="flex items-center space-x-2 space-x-reverse">
        <Controller
            name="isOutOfBudget"
            control={form.control}
            render={({ field }) => (
                <Checkbox
                    id="isOutOfBudget"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                />
            )}
        />
        <Label htmlFor="isOutOfBudget">مصروف خارج الميزانية</Label>
      </div>

      {form.watch('isOutOfBudget') && (
        <div>
          <Label htmlFor="outOfBudgetDetails">تفاصيل المصروف خارج الميزانية</Label>
          <Input id="outOfBudgetDetails" {...form.register('outOfBudgetDetails')} placeholder="سبب الخروج عن الميزانية" />
        </div>
      )}
      
      <Button type="submit" className="w-full" disabled={updateExpenseMutation.isPending}>
        {updateExpenseMutation.isPending ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin"/> جاري التحديث...</> : <><PencilIcon className="ml-2 h-4 w-4" /> تحديث المصروف</>}
      </Button>

      {/* Past-month edit confirmation — editing closed months changes historical reports */}
      <AlertDialog open={!!pendingPastEdit} onOpenChange={(open) => { if (!open) setPendingPastEdit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ تعديل شهر منتهٍ</AlertDialogTitle>
            <AlertDialogDescription>
              هذا المصروف من {expenseMonthLabel || 'شهر سابق'} — تعديله سيغيّر تقاريرك وإحصاءاتك السابقة بأثر رجعي. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPastEdit) {
                  updateExpenseMutation.mutate(buildPayload(pendingPastEdit));
                }
                setPendingPastEdit(null);
              }}
            >
              نعم، عدّل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </form>
  );
}
