
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
import { Textarea } from '@/components/ui/textarea';
import { Save, CalendarIcon, Loader2, ChevronsRight, Pencil, Tag, Hash, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpense } from '@/services/firestore';
import { useDebounce } from '@/hooks/use-debounce';
import { recordExpenseAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { useCategories } from '@/hooks/use-categories';

const expenseSchema = z.object({
  title: z.string().min(1, { message: 'العنوان مطلوب' }),
  amount: z.coerce.number().min(0.01, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  category: z.string().min(1, { message: 'الفئة مطلوبة' }),
  date: z.date({ required_error: 'التاريخ مطلوب' }),
  description: z.string().optional(),
  isOutOfBudget: z.boolean().optional(),
  outOfBudgetDetails: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

export default function AddExpensePage() {
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { categories, getIconComponent } = useCategories();

    const [isCategorizing, setIsCategorizing] = useState(false);
    
    const form = useForm<ExpenseFormData>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            title: '',
            amount: undefined,
            category: '',
            date: new Date(),
            description: '',
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
        mutationFn: (newExpense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>) => addExpense(user!.uid, newExpense),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
            toast({
              title: "تمت الإضافة بنجاح!",
              description: `تم إضافة مصروف "${variables.title}".`,
            });
            form.reset();
            router.push('/');
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

    const selectedCategory = form.watch('category');

    return (
        <div className="flex flex-col h-full">
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-6 p-4 overflow-y-auto pb-28">

                {/* Form Fields */}
                <div className="space-y-4">
                     <div className="relative">
                        <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input {...form.register('title')} placeholder="ما الذي أنفقت عليه؟ (مثال: قهوة)" className="pr-10" />
                    </div>
                    {form.formState.errors.title && <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>}

                    <div className="relative">
                        <Tag className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            {...form.register('amount')} 
                            type="number"
                            inputMode="decimal"
                            placeholder="أدخل المبلغ"
                            className="pr-10"
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
                                        {field.value ? format(field.value, "PPP", { locale: arIQ }) : <span>اختر تاريخاً</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus dir="rtl" locale={arIQ} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} />
                                </PopoverContent>
                            </Popover>
                        )}
                    />
                     {form.formState.errors.date && <p className="text-sm text-destructive mt-1">{form.formState.errors.date.message}</p>}
                    
                    <div className="relative">
                       <FileText className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                       <Textarea {...form.register('description')} placeholder="الوصف (اختياري)" className="pr-10 min-h-[60px]" />
                    </div>
                    
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
                            <Hash className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                            <Textarea {...form.register('outOfBudgetDetails')} placeholder="سبب الخروج عن الميزانية" className="pr-10 min-h-[60px]" />
                        </div>
                    )}
                </div>

                {/* Category Grid */}
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-center text-foreground">اختر فئة</h2>
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

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
                     <Button type="submit" className="w-full h-14 text-lg" disabled={addExpenseMutation.isPending}>
                        {addExpenseMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                        <span className="mr-2">حفظ المصروف</span>
                    </Button>
                </div>
            </form>
        </div>
    );
}
