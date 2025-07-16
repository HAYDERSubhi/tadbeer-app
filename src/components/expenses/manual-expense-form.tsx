
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
import { CalendarIcon, Loader2Icon } from 'lucide-react';
import { format } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { CATEGORIES } from '@/lib/constants';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpense } from '@/services/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { categorizeExpenseAction } from '@/app/actions';

const expenseSchema = z.object({
  title: z.string().min(1, { message: 'العنوان مطلوب' }),
  amount: z.coerce.number().min(1, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  category: z.string().min(1, { message: 'الفئة مطلوبة' }),
  date: z.date({ required_error: 'التاريخ مطلوب' }),
  description: z.string().optional(),
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      amount: 0,
      category: '',
      date: new Date(),
      description: '',
      isOutOfBudget: false,
      outOfBudgetDetails: '',
    },
  });

  const categoryMap = useMemo(() => {
    return Object.entries(CATEGORIES).reduce((acc, [id, { name }]) => {
      acc[id] = name;
      return acc;
    }, {} as Record<string, string>);
  }, []);

  const [isCategorizing, setIsCategorizing] = useState(false);
  const expenseTitle = form.watch('title');
  const debouncedTitle = useDebounce(expenseTitle, 500);

  useEffect(() => {
    // Don't categorize if the user has already manually selected a category
    // or if the title is empty.
    if (!debouncedTitle || form.getValues('category')) {
      return;
    }

    const getCategorySuggestion = async () => {
      setIsCategorizing(true);
      try {
        const result = await categorizeExpenseAction({
          expenseTitle: debouncedTitle,
          categories: categoryMap,
        });
        if (result.suggestedCategory) {
          form.setValue('category', result.suggestedCategory, { shouldValidate: true });
        }
      } catch (error) {
        console.error("Failed to get category suggestion:", error);
      } finally {
        setIsCategorizing(false);
      }
    };

    getCategorySuggestion();
  }, [debouncedTitle, categoryMap, form]);


  useEffect(() => {
    if (initialData) {
      form.reset({
        title: initialData.title || '',
        amount: initialData.amount || 0,
        category: initialData.category || '',
        date: initialData.date ? new Date(initialData.date) : new Date(),
        description: initialData.description || '',
        isOutOfBudget: initialData.isOutOfBudget || false,
        outOfBudgetDetails: initialData.outOfBudgetDetails || '',
      });
    } else {
      form.reset({
        title: '',
        amount: 0,
        category: '',
        date: new Date(),
        description: '',
        isOutOfBudget: false,
        outOfBudgetDetails: '',
      });
    }
  }, [initialData, form]);

  const addExpenseMutation = useMutation({
    mutationFn: (newExpense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>) => addExpense(user!.uid, newExpense),
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
        toast({
          title: "تمت الإضافة بنجاح!",
          description: `تم إضافة مصروف "${variables.title}" بمبلغ ${variables.amount.toLocaleString()} د.ع.`,
        });
        form.reset();
        setOpen(false);
    },
    onError: () => {
        toast({
          title: "خطأ في الحفظ",
          description: "لم يتم حفظ المصروف. الرجاء المحاولة مرة أخرى.",
          variant: "destructive",
        });
    }
  });

  const onSubmit = (data: ExpenseFormData) => {
    if (!user) return;

    const newExpenseData = {
      ...data,
      date: data.date.toISOString(),
    };
    addExpenseMutation.mutate(newExpenseData);
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-6 pt-0">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
            <Label htmlFor="title">العنوان</Label>
            <Input 
                id="title" 
                {...form.register('title')} 
                placeholder="مثال: غداء عمل"
                autoFocus={false}
                key={initialData?.title || 'new'}
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
            <Label htmlFor="category">الفئة</Label>
            <Controller
                name="category"
                control={form.control}
                render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="category" className={cn(isCategorizing && 'animate-pulse')}>
                    <SelectValue placeholder={isCategorizing ? 'جاري التصنيف...' : 'اختر فئة'} />
                    </SelectTrigger>
                    <SelectContent>
                    {Object.values(CATEGORIES).map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                )}
            />
            {form.formState.errors.category && <p className="text-sm text-destructive mt-1">{form.formState.errors.category.message}</p>}
            </div>
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

        <div>
            <Label htmlFor="description">الوصف (اختياري)</Label>
            <Input id="description" {...form.register('description')} placeholder="تفاصيل إضافية عن المصروف" />
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
        
        <Button type="submit" className="w-full" disabled={addExpenseMutation.isPending}>
            {addExpenseMutation.isPending ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin"/> جاري الحفظ...</> : 'حفظ المصروف'}
        </Button>
        
        </form>
    </div>
  );
}
