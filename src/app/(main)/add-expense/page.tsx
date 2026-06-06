// src/app/(main)/add-expense/page.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Save, CalendarIcon, Loader2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpense } from '@/services/firestore';
import { useDebounce } from '@/hooks/use-debounce';
import { recordExpenseAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { useCategories } from '@/hooks/use-categories';
import { Textarea } from '@/components/ui/textarea';
import { useAppData } from '@/hooks/use-app-data';
import { useCurrency } from '@/hooks/use-currency';

const expenseSchema = z.object({
  title: z.string().min(1, { message: 'العنوان مطلوب' }),
  amount: z.coerce.number().min(0.01, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  category: z.string().min(1, { message: 'الفئة مطلوبة' }),
  date: z.date({ required_error: 'التاريخ مطلوب' }),
  isOutOfBudget: z.boolean().optional(),
  outOfBudgetDetails: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

const formatNumberWithCommas = (value: string | number | undefined) => {
    if (value === null || value === undefined || value === '') return '';
    const numericString = String(value).replace(/,/g, '');
    const number = Number(numericString);
    if (isNaN(number)) return '';
    return new Intl.NumberFormat('en-US').format(number);
};

const parseFormattedNumber = (value: string | undefined) => {
    if (!value) return '';
    return value.replace(/,/g, '');
};

export default function AddExpensePage() {
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { categories, getIconComponent } = useCategories();
    const { expenses, householdId } = useAppData();
    const { format: formatCurrency } = useCurrency();

    const [isCategorizing, setIsCategorizing] = useState(false);
    const [showFrequent, setShowFrequent] = useState(false);

    // Build frequent expenses from history (top 6 most used)
    const frequentExpenses = useMemo(() => {
        const freq: Record<string, { title: string; amount: number; category: string; count: number }> = {};
        expenses.forEach(e => {
            const key = e.title.toLowerCase().trim();
            if (!freq[key]) freq[key] = { title: e.title, amount: e.amount, category: e.category, count: 0 };
            freq[key].count++;
        });
        return Object.values(freq)
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }, [expenses]);
    
    const form = useForm<ExpenseFormData>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            title: '',
            amount: undefined,
            category: '',
            date: new Date(),
            isOutOfBudget: false,
            outOfBudgetDetails: '',
        },
    });

    const expenseTitle = form.watch('title');
    const debouncedTitle = useDebounce(expenseTitle, 500);

    const categoryMapForAI = useMemo(() => {
        return categories.reduce((acc, cat) => {
            acc[cat.id] = cat.name;
            return acc;
        }, {} as Record<string, string>);
    }, [categories]);

    useEffect(() => {
        if (!debouncedTitle) {
          return;
        }

        const getCategorySuggestion = async () => {
          setIsCategorizing(true);
          try {
            const result = await recordExpenseAction({
              expenseText: debouncedTitle,
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
    }, [debouncedTitle, categoryMapForAI, form]);
    
    const addExpenseMutation = useMutation({
        mutationFn: (newExpense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>) =>
            addExpense(user!.uid, newExpense, householdId),
        onMutate: async (newExpenseData) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['expenses', user?.uid] });

            // Snapshot the previous value
            const previousExpenses = queryClient.getQueryData<Expense[]>(['expenses', user?.uid]);

            // Optimistically update to the cache
            if (previousExpenses) {
                queryClient.setQueryData<Expense[]>(['expenses', user?.uid], [
                    {
                        ...newExpenseData,
                        id: `temp-${Date.now()}`,
                        uid: user!.uid,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    },
                    ...previousExpenses,
                ]);
            }

            // Return a context object with the snapshotted value
            return { previousExpenses };
        },
        onError: (err, newExpense, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousExpenses) {
                queryClient.setQueryData(['expenses', user?.uid], context.previousExpenses);
            }
            toast({
                title: "خطأ في الحفظ",
                description: "عذراً، تعذر حفظ المصروف. يرجى التحقق من الاتصال.",
                variant: "destructive",
            });
        },
        onSettled: () => {
            // Always refetch after error or success to keep server sync
            queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
        },
        onSuccess: (_, variables) => {
            toast({
              title: "تمت الإضافة بنجاح!",
              description: `تم إضافة مصروف "${variables.title}".`,
            });

            // ── Duplicate detection (household only) ──────────────────────
            if (householdId) {
                const now = new Date();
                const limit24h = 24 * 60 * 60 * 1000; // 24 hours in ms
                const duplicate = expenses.find(e => {
                    if (e.uid === user!.uid) return false; // same user — skip
                    if (e.amount !== variables.amount) return false;
                    if (e.category !== variables.category) return false;
                    try {
                        const diff = Math.abs(now.getTime() - new Date(e.date).getTime());
                        return diff <= limit24h;
                    } catch { return false; }
                });
                if (duplicate) {
                    setTimeout(() => {
                        toast({
                            title: '⚠️ مصروف مكرر محتمل!',
                            description: `تم تسجيل نفس المبلغ والفئة من عضو آخر في العائلة خلال آخر 24 ساعة. هل هذا مصروف مختلف؟`,
                            variant: 'destructive',
                        });
                    }, 600);
                }
            }
            // ──────────────────────────────────────────────────────────────

            form.reset();
            router.push('/');
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

    const selectedCategory = form.watch('category');

    return (
        <div className="flex flex-col h-full">
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-6 p-4 overflow-y-auto pb-28">

                {/* Frequent Expenses Suggestions */}
                {frequentExpenses.length > 0 && (
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => setShowFrequent(v => !v)}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                            <Clock className="h-3.5 w-3.5" />
                            <span>مصاريف متكررة</span>
                            {showFrequent ? <ChevronUp className="h-3 w-3 mr-auto" /> : <ChevronDown className="h-3 w-3 mr-auto" />}
                        </button>
                        {showFrequent && (
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in">
                                {frequentExpenses.map((exp, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                            form.setValue('title', exp.title, { shouldValidate: true });
                                            form.setValue('amount', exp.amount, { shouldValidate: true });
                                            form.setValue('category', exp.category, { shouldValidate: true });
                                            setShowFrequent(false);
                                        }}
                                        className="flex items-center justify-between p-2 rounded-lg border bg-muted/40 hover:bg-muted/80 transition-colors text-right"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium truncate">{exp.title}</p>
                                            <p className="text-[10px] text-muted-foreground">{formatCurrency(exp.amount)}</p>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground/60 mr-1 shrink-0">{exp.count}×</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4">
                     <div className="relative">
                        <Input {...form.register('title')} placeholder="اسم السلعة/الخدمة" />
                    </div>
                    {form.formState.errors.title && <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>}

                    <div className="relative">
                        <Controller
                            name="amount"
                            control={form.control}
                            render={({ field: { onChange, value, ...restField } }) => (
                                <Input
                                    {...restField}
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="المبلغ"
                                    value={value === 0 ? '' : formatNumberWithCommas(value)}
                                    onChange={(e) => {
                                        const parsed = parseFormattedNumber(e.target.value);
                                        if (parsed === '' || !isNaN(Number(parsed))) {
                                            onChange(parsed === '' ? 0 : Number(parsed));
                                        }
                                    }}
                                />
                            )}
                        />
                    </div>
                    {form.formState.errors.amount && <p className="text-sm text-destructive mt-1">{form.formState.errors.amount.message}</p>}

                    <Controller
                        name="date"
                        control={form.control}
                        render={({ field }) => (
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal relative pr-10", !field.value && "text-muted-foreground")}>
                                         <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <span>التاريخ:</span>
                                        {field.value ? <span className="mr-2 font-semibold">{format(field.value, "dd/MM/yyyy")}</span> : <span>اختر تاريخاً</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus dir="rtl" locale={ar} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} />
                                </PopoverContent>
                            </Popover>
                        )}
                    />
                     {form.formState.errors.date && <p className="text-sm text-destructive mt-1">{form.formState.errors.date.message}</p>}
                    
                    <div className="flex items-center space-x-2 space-x-reverse pt-2">
                        <Controller
                            name="isOutOfBudget"
                            control={form.control}
                            render={({ field }) => ( <Checkbox id="isOutOfBudget" checked={field.value} onCheckedChange={field.onChange} /> )}
                        />
                        <Label htmlFor="isOutOfBudget" className="cursor-pointer">مصروف خارج الميزانية</Label>
                    </div>

                    {form.watch('isOutOfBudget') && (
                        <div className="relative">
                            <Textarea {...form.register('outOfBudgetDetails')} placeholder="سبب الخروج عن الميزانية" className="min-h-[60px]" />
                        </div>
                    )}

                    <div className="relative">
                        <Textarea
                            {...form.register('description')}
                            placeholder="ملاحظة (اختياري) — مثال: غداء مع العمل"
                            className="min-h-[60px] text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 text-center">
                        {categories.map((cat) => (
                            <div 
                                key={cat.id} 
                                onClick={() => form.setValue('category', cat.id, { shouldValidate: true })}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all duration-200",
                                    selectedCategory === cat.id 
                                        ? 'border-primary bg-primary/10 shadow-lg scale-105'
                                        : 'border-transparent bg-muted/60 hover:border-primary/50'
                                )}
                            >
                                <span className={cn("flex items-center justify-center w-12 h-12 text-2xl rounded-full transition-colors", selectedCategory === cat.id ? 'bg-primary/20 text-primary' : 'bg-background')}>
                                    {getIconComponent(cat.icon)}
                                </span>
                                <p className="text-xs font-medium break-words">{cat.name}</p>
                            </div>
                        ))}
                    </div>
                     {form.formState.errors.category && <p className="text-sm text-destructive mt-1 text-center">{form.formState.errors.category.message}</p>}
                </div>
            </form>

            <div className="fixed bottom-16 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
                 <Button onClick={form.handleSubmit(onSubmit)} className="w-full h-14 text-lg" disabled={addExpenseMutation.isPending}>
                    {addExpenseMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                    <span className="mr-2">حفظ المصروف</span>
                </Button>
            </div>
        </div>
    );
}
