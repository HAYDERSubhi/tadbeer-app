"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { DialogClose } from '@/components/ui/dialog';
import { CATEGORIES } from '@/lib/constants';

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

export default function ManualExpenseForm() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const onSubmit = (data: ExpenseFormData) => {
    if (!isMounted) return;

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      ...data,
      date: data.date.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const existingExpenses: Expense[] = JSON.parse(localStorage.getItem('expenses') || '[]');
      localStorage.setItem('expenses', JSON.stringify([...existingExpenses, newExpense]));
      
      toast({
        title: "تمت الإضافة بنجاح!",
        description: `تم إضافة مصروف "${data.title}" بمبلغ ${data.amount} د.ع.`,
      });
      form.reset();
       // Trigger a custom event to notify the dashboard to refresh
      window.dispatchEvent(new CustomEvent('expensesUpdated'));

      // Close dialog after submission. This is a bit of a hack.
      // A better way would be to pass a close function from the Dialog.
      document.querySelector('[data-radix-dialog-close]')?.dispatchEvent(new MouseEvent('click'));


    } catch (error) {
      console.error("Failed to save expense:", error);
      toast({
        title: "خطأ في الحفظ",
        description: "لم يتم حفظ المصروف. الرجاء المحاولة مرة أخرى.",
        variant: "destructive",
      });
    }
  };
  
  if (!isMounted) {
    return <p>جاري التحميل...</p>; 
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
      <div>
        <Label htmlFor="title">العنوان</Label>
        <Input id="title" {...form.register('title')} placeholder="مثال: غداء عمل" />
        {form.formState.errors.title && <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>}
      </div>

      <div>
        <Label htmlFor="amount">المبلغ (د.ع)</Label>
        <Input id="amount" type="number" {...form.register('amount')} placeholder="مثال: 25000" />
        {form.formState.errors.amount && <p className="text-sm text-destructive mt-1">{form.formState.errors.amount.message}</p>}
      </div>

      <div>
        <Label htmlFor="category">الفئة</Label>
        <Controller
          name="category"
          control={form.control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="category">
                <SelectValue placeholder="اختر فئة" />
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
                  {field.value ? format(field.value, "PPP", { locale: arSA }) : <span>اختر تاريخاً</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  initialFocus
                  dir="rtl"
                  locale={arSA}
                />
              </PopoverContent>
            </Popover>
          )}
        />
        {form.formState.errors.date && <p className="text-sm text-destructive mt-1">{form.formState.errors.date.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">الوصف (اختياري)</Label>
        <Textarea id="description" {...form.register('description')} placeholder="تفاصيل إضافية عن المصروف" />
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
      <DialogClose asChild>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'جاري الحفظ...' : 'حفظ المصروف'}
        </Button>
      </DialogClose>
    </form>
  );
}
// Need to install date-fns if not already, it is in package.json.
// For Arabic date formatting, ar-SA locale from date-fns is commonly used.
// If specific Iraqi locale is needed, it might require custom handling or a different library.
// For now, ar-SA should be acceptable for basic date display.
