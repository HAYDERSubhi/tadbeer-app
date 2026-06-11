// src/components/expenses/manual-expense-form.tsx
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
import { CalendarIcon, Loader2Icon, Save } from 'lucide-react';
import { format } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';
import { cn } from '@/lib/utils';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpense } from '@/services/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { recordExpenseAction } from '@/app/actions';
import { useCategories } from '@/hooks/use-categories';
import { findDuplicateExpense } from '@/lib/duplicate-check';
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

const expenseSchema = z.object({
  title: z.string().min(1, { message: 'العنوان مطلوب' }),
  amount: z.coerce.number().min(1, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  category: z.string().min(1, { message: 'الفئة مطلوبة' }),
  date: z.date({ required_error: 'التاريخ مطلوب' }),
  isOutOfBudget: z.boolean().optional(),
  outOfBudgetDetails: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ManualExpenseFormProps {
  setOpen: (open: boolean) => void;
  initialData?: Partial<Expense> | null;
}

export default function ManualExpenseForm({ setOpen, initialData }: ManualExpenseFormProps) {
  const { user } = useAuth();
  const { householdId, expenses: recentExpenses } = useAppData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { categories, getIconComponent } = useCategories();
  // Holds the expense awaiting user confirmation when a duplicate is detected.
  const [pendingDuplicate, setPendingDuplicate] = useState<{ data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>; existingTitle: string } | null>(null);
  
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      amount: 0,
      category: '',
      date: new Date(),
      isOutOfBudget: false,
      outOfBudgetDetails: '',
    },
  });

  // Effect to reset the form whenever the initialData prop changes.
  // This is crucial for the voice input feature to correctly populate the form.
  useEffect(() => {
      form.reset({
        title: initialData?.title || '',
        amount: initialData?.amount || 0,
        category: initialData?.category || '',
        date: initialData?.date ? new Date(initialData.date) : new Date(),
        isOutOfBudget: initialData?.isOutOfBudget || false,
        outOfBudgetDetails: initialData?.outOfBudgetDetails || '',
      });
  }, [initialData, form]);

  const categoryMapForAI = useMemo(() => {
    return categories.reduce((acc, cat) => {
      acc[cat.id] = cat.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  const [isCategorizing, setIsCategorizing] = useState(false);
  const expenseTitle = form.watch('title');
  const debouncedTitle = useDebounce(expenseTitle, 500);

  useEffect(() => {
    // Only run if there is no initial data title (i.e., not voice input), 
    // there is a debounced title, and the category has not been set by the user yet.
    if (initialData?.title || !debouncedTitle || form.getValues('category')) {
      return;
    }

    const getCategorySuggestion = async () => {
      setIsCategorizing(true);
      try {
        const result = await recordExpenseAction({
          expenseText: `${debouncedTitle} 1000`, // Dummy amount to satisfy the prompt.
          categories: categoryMapForAI,
        });
        if (result.category) {
          form.setValue('category', result.category, { shouldValidate: true });
        }
      } catch (error) {
        console.error("Failed to get category suggestion:", error);
      } finally {
        setIsCategorizing(false);
      }
    };

    getCategorySuggestion();
  }, [debouncedTitle, categoryMapForAI, form, initialData]);

  const addExpenseMutation = useMutation({
    mutationFn: (newExpense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>) =>
      addExpense(user!.uid, newExpense, householdId),
    onMutate: async (newExpenseData) => {
        // Cancel any outgoing refetches for both query variants
        await queryClient.cancelQueries({ queryKey: ['expenses', user?.uid] });

        // Snapshot previous values for both 'recent' and 'all' caches
        const prevRecent = queryClient.getQueryData<Expense[]>(['expenses', user?.uid, householdId, 'recent']);
        const prevAll    = queryClient.getQueryData<Expense[]>(['expenses', user?.uid, householdId, 'all']);

        const tempExpense: Expense = {
            ...newExpenseData,
            id: `temp-${Date.now()}`,
            uid: user!.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Optimistically update both cache entries
        if (prevRecent) {
            queryClient.setQueryData<Expense[]>(
              ['expenses', user?.uid, householdId, 'recent'],
              [tempExpense, ...prevRecent],
            );
        }
        if (prevAll) {
            queryClient.setQueryData<Expense[]>(
              ['expenses', user?.uid, householdId, 'all'],
              [tempExpense, ...prevAll],
            );
        }

        // Close the dialog immediately for an "instant" feel
        setOpen(false);

        return { prevRecent, prevAll };
    },
    onError: (err, _newExpense, context) => {
        // Roll back both cache entries
        if (context?.prevRecent) {
            queryClient.setQueryData(['expenses', user?.uid, householdId, 'recent'], context.prevRecent);
        }
        if (context?.prevAll) {
            queryClient.setQueryData(['expenses', user?.uid, householdId, 'all'], context.prevAll);
        }
        toast({
            title: "خطأ في الحفظ",
            description: "عذراً، تعذر حفظ المصروف. يرجى التحقق من الاتصال.",
            variant: "destructive",
        });
    },
    onSettled: () => {
        // Always refetch to sync with server
        queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
    },
    onSuccess: (_, variables) => {
        toast({
          title: "تمت الإضافة بنجاح!",
          description: `تم إضافة مصروف "${variables.title}" بمبلغ ${variables.amount.toLocaleString()} د.ع.`,
        });
        form.reset();
    }
  });

  const onSubmit = (data: ExpenseFormData) => {
    if (!user) return;

    const newExpenseData = {
      ...data,
      date: data.date.toISOString(),
    };

    // Pre-save duplicate check: same amount + category + title + day.
    const duplicate = findDuplicateExpense(recentExpenses, newExpenseData);
    if (duplicate) {
      setPendingDuplicate({ data: newExpenseData, existingTitle: duplicate.title });
      return;
    }
    addExpenseMutation.mutate(newExpenseData);
  };
  
  const selectedCategory = form.watch('category');

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
      <div>
        <Label htmlFor="title">العنوان</Label>
        <Input 
            id="title" 
            {...form.register('title')} 
            placeholder="مثال: غداء عمل"
        />
        {form.formState.errors.title && <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">المبلغ (د.ع)</Label>
          <Input id="amount" type="number" inputMode="decimal" {...form.register('amount')} placeholder="25000" />
          {form.formState.errors.amount && <p className="text-sm text-destructive mt-1">{form.formState.errors.amount.message}</p>}
        </div>

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
      </div>
      
      <div className="space-y-3">
        <Label className={cn(isCategorizing && 'animate-pulse')}>
            {isCategorizing ? 'جاري تصنيف الفئة...' : 'الفئة'}
        </Label>
        <Controller
            name="category"
            control={form.control}
            render={({ field }) => (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-center">
                    {categories.map((cat) => (
                        <div 
                            key={cat.id} 
                            onClick={() => field.onChange(cat.id)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border-2 cursor-pointer transition-all duration-200",
                                field.value === cat.id 
                                    ? 'border-primary bg-primary/10 shadow-md scale-105'
                                    : 'border-transparent bg-muted/60 hover:border-primary/50'
                            )}
                        >
                            <span className={cn("flex items-center justify-center w-10 h-10 text-xl rounded-full transition-colors", field.value === cat.id ? 'bg-primary/20 text-primary' : 'bg-background')}>
                                {getIconComponent(cat.icon)}
                            </span>
                            <p className="text-xs font-medium break-words leading-tight">{cat.name}</p>
                        </div>
                    ))}
                </div>
            )}
        />
        {form.formState.errors.category && <p className="text-sm text-destructive mt-1 text-center">{form.formState.errors.category.message}</p>}
      </div>

      <div className="flex items-center space-x-2 space-x-reverse pt-2">
        <Controller
            name="isOutOfBudget"
            control={form.control}
            render={({ field }) => (
                <Checkbox
                    id="isOutOfBudget"
                    checked={!!field.value}
                    onCheckedChange={field.onChange}
                />
            )}
        />
        <Label htmlFor="isOutOfBudget">مصروف خارج الميزانية</Label>
      </div>

      {form.watch('isOutOfBudget') && (
        <div>
          <Label htmlFor="outOfBudgetDetails">سبب الخروج عن الميزانية</Label>
          <Input id="outOfBudgetDetails" {...form.register('outOfBudgetDetails')} />
        </div>
      )}
      
      <div className="pt-4">
        <Button type="submit" className="w-full h-12 text-base" disabled={addExpenseMutation.isPending}>
            {addExpenseMutation.isPending ? <><Loader2Icon className="ml-2 h-5 w-5 animate-spin"/> جاري الحفظ...</> : <><Save className="ml-2 h-5 w-5" /> حفظ المصروف</>}
        </Button>
      </div>

      {/* Duplicate-expense confirmation */}
      <AlertDialog open={!!pendingDuplicate} onOpenChange={(open) => { if (!open) setPendingDuplicate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ مصروف مكرر محتمل</AlertDialogTitle>
            <AlertDialogDescription>
              يوجد مصروف مسجل اليوم بنفس العنوان والمبلغ والفئة
              {pendingDuplicate ? ` ("${pendingDuplicate.existingTitle}")` : ''}.
              هل تريد الحفظ على أي حال؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDuplicate) addExpenseMutation.mutate(pendingDuplicate.data);
                setPendingDuplicate(null);
              }}
            >
              احفظ على أي حال
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </form>
  );
}
