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
import { arIQ } from '@/lib/arabic-date';
import { cn } from '@/lib/utils';
import { normalizeDigits } from '@/lib/normalize-digits';
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
import { useCurrency } from '@/hooks/use-currency';

const expenseSchema = z.object({
  title: z.string().min(1, { message: 'العنوان مطلوب' }),
  amount: z.coerce.number().min(0.01, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  category: z.string().min(1, { message: 'الفئة مطلوبة' }),
  date: z.date({ required_error: 'التاريخ مطلوب' }),
  isOutOfBudget: z.boolean().optional(),
  outOfBudgetDetails: z.string().optional(),
  description: z.string().optional(),
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
    return normalizeDigits(value).replace(/,/g, '');
};

export default function AddExpensePage() {
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { categories, getIconComponent } = useCategories();
    const { expenses, householdId } = useAppData();
    // Holds the expense awaiting user confirmation when a duplicate is detected.
    const [pendingDuplicate, setPendingDuplicate] = useState<{ data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>; existingTitle: string } | null>(null);
    const { format: formatCurrency } = useCurrency();

    const [isCategorizing, setIsCategorizing] = useState(false);
    const [showFrequent, setShowFrequent] = useState(false);
    const [showExtras, setShowExtras] = useState(false);

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
        if (!debouncedTitle) return;

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
            await queryClient.cancelQueries({ queryKey: ['expenses', user?.uid] });

            // The real cache keys include householdId + variant ('recent'/'all').
            const prevRecent = queryClient.getQueryData<Expense[]>(['expenses', user?.uid, householdId, 'recent']);
            const prevAll    = queryClient.getQueryData<Expense[]>(['expenses', user?.uid, householdId, 'all']);

            const tempExpense: Expense = {
                ...newExpenseData,
                id: `temp-${Date.now()}`,
                uid: user!.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

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
            return { prevRecent, prevAll };
        },
        onError: (err, newExpense, context) => {
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
            queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
        },
        onSuccess: (_, variables) => {
            toast({
                title: "تمت الإضافة بنجاح!",
                description: `تم إضافة مصروف "${variables.title}".`,
            });

            // Duplicate detection (household only)
            if (householdId) {
                const now = new Date();
                const limit24h = 24 * 60 * 60 * 1000;
                const duplicate = expenses.find(e => {
                    if (e.uid === user!.uid) return false;
                    if (e.amount !== variables.amount) return false;
                    if (e.category !== variables.category) return false;
                    try {
                        return Math.abs(now.getTime() - new Date(e.date).getTime()) <= limit24h;
                    } catch { return false; }
                });
                if (duplicate) {
                    setTimeout(() => {
                        toast({
                            title: '⚠️ مصروف مكرر محتمل!',
                            description: `تم تسجيل نفس المبلغ والفئة من عضو آخر في العائلة خلال آخر 24 ساعة.`,
                            variant: 'destructive',
                        });
                    }, 600);
                }
            }

            form.reset();
            router.push('/expenses');
        },
    });

    const onSubmit = (data: ExpenseFormData) => {
        if (!user) return;
        const payload = { ...data, date: data.date.toISOString() };

        // Pre-save duplicate check: same amount + category + title + day.
        const duplicate = findDuplicateExpense(expenses, payload);
        if (duplicate) {
            setPendingDuplicate({ data: payload, existingTitle: duplicate.title });
            return;
        }
        addExpenseMutation.mutate(payload);
    };

    const selectedCategory = form.watch('category');

    return (
        <div className="flex flex-col h-full">
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-5 p-4 overflow-y-auto pb-40">

                {/* ─── 1. Frequent Expenses ─── */}
                {frequentExpenses.length > 0 && (
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => setShowFrequent(v => !v)}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                            <Clock className="h-3.5 w-3.5" />
                            <span>مصاريف متكررة</span>
                            {showFrequent
                                ? <ChevronUp className="h-3 w-3 mr-auto" />
                                : <ChevronDown className="h-3 w-3 mr-auto" />}
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

                {/* ─── 2. Category Grid — FIRST ─── */}
                <div className="space-y-2">
                    <p className={cn(
                        "text-xs font-medium text-muted-foreground flex items-center gap-1.5 h-4",
                        isCategorizing && "text-primary"
                    )}>
                        {isCategorizing ? (
                            <><Loader2 className="h-3 w-3 animate-spin shrink-0" /> جاري تصنيف الفئة تلقائياً...</>
                        ) : 'اختر الفئة'}
                    </p>

                    <div className="grid grid-cols-4 gap-2 text-center">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                onClick={() => form.setValue('category', cat.id, { shouldValidate: true })}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border-2 cursor-pointer transition-all duration-200 active:scale-95 select-none",
                                    selectedCategory === cat.id
                                        ? 'border-primary bg-primary/10 shadow-sm'
                                        : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                                )}
                            >
                                <span className={cn(
                                    "flex items-center justify-center w-11 h-11 text-xl rounded-full transition-colors",
                                    selectedCategory === cat.id
                                        ? 'bg-primary/20 text-primary'
                                        : 'bg-background text-foreground/70'
                                )}>
                                    {getIconComponent(cat.icon)}
                                </span>
                                <p className={cn(
                                    "text-[11px] font-medium leading-tight line-clamp-2",
                                    selectedCategory === cat.id ? 'text-primary' : 'text-foreground/75'
                                )}>
                                    {cat.name}
                                </p>
                            </div>
                        ))}
                    </div>

                    {form.formState.errors.category && (
                        <p className="text-sm text-destructive text-center">{form.formState.errors.category.message}</p>
                    )}
                </div>

                {/* ─── 3. Title + Amount + Date ─── */}
                <div className="space-y-3">

                    {/* Title */}
                    <div>
                        <Input
                            {...form.register('title')}
                            placeholder="اسم السلعة/الخدمة"
                            className="h-11"
                        />
                        {form.formState.errors.title && (
                            <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                        )}
                    </div>

                    {/* Amount — larger with currency suffix */}
                    <div>
                        <Controller
                            name="amount"
                            control={form.control}
                            render={({ field: { onChange, value, ...restField } }) => (
                                <div className="relative">
                                    <Input
                                        {...restField}
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="المبلغ"
                                        className="h-14 text-xl font-bold pl-14 text-right"
                                        value={value === 0 ? '' : formatNumberWithCommas(value)}
                                        onChange={(e) => {
                                            const parsed = parseFormattedNumber(e.target.value);
                                            if (parsed === '' || !isNaN(Number(parsed))) {
                                                onChange(parsed === '' ? 0 : Number(parsed));
                                            }
                                        }}
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none select-none">
                                        د.ع
                                    </span>
                                </div>
                            )}
                        />
                        {form.formState.errors.amount && (
                            <p className="text-sm text-destructive mt-1">{form.formState.errors.amount.message}</p>
                        )}
                    </div>

                    {/* Date */}
                    <Controller
                        name="date"
                        control={form.control}
                        render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start h-11 font-normal relative pr-10",
                                            !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground ml-1">التاريخ:</span>
                                        {field.value
                                            ? <span className="font-semibold">{format(field.value, "dd/MM/yyyy")}</span>
                                            : <span>اختر تاريخاً</span>
                                        }
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
                    {form.formState.errors.date && (
                        <p className="text-sm text-destructive mt-1">{form.formState.errors.date.message}</p>
                    )}
                </div>

                {/* ─── 4. Optional extras — collapsed ─── */}
                <div>
                    <button
                        type="button"
                        onClick={() => setShowExtras(v => !v)}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-1"
                    >
                        {showExtras
                            ? <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                            : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                        <span>خيارات إضافية</span>
                        <span className="text-[10px] opacity-50 mr-auto">(ملاحظة · خارج الميزانية)</span>
                    </button>

                    {showExtras && (
                        <div className="space-y-3 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2">
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
                                <Label htmlFor="isOutOfBudget" className="cursor-pointer text-sm">
                                    مصروف خارج الميزانية
                                </Label>
                            </div>

                            {form.watch('isOutOfBudget') && (
                                <Textarea
                                    {...form.register('outOfBudgetDetails')}
                                    placeholder="سبب الخروج عن الميزانية"
                                    className="min-h-[56px] text-sm"
                                />
                            )}

                            <Textarea
                                {...form.register('description')}
                                placeholder="ملاحظة (اختياري) — مثال: غداء مع العمل"
                                className="min-h-[56px] text-sm"
                            />
                        </div>
                    )}
                </div>

            </form>

            {/* ─── Fixed save button ─── */}
            <div className="fixed bottom-16 left-0 right-0 px-4 py-3 bg-background/80 backdrop-blur-sm border-t border-border">
                <Button
                    onClick={form.handleSubmit(onSubmit)}
                    className="w-full h-12 text-base"
                    disabled={addExpenseMutation.isPending}
                >
                    {addExpenseMutation.isPending
                        ? <Loader2 className="h-6 w-6 animate-spin" />
                        : <Save className="h-6 w-6" />}
                    <span className="mr-2">حفظ المصروف</span>
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
        </div>
    );
}
