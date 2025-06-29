// src/app/(main)/goals/page.tsx
"use client";

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Goal } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Target, PlusCircle, Trash2Icon, Loader2Icon, Flag, CalendarIcon, ChevronsRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, differenceInMonths, isFuture } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addGoal, deleteGoal } from '@/services/firestore';
import { useAppData } from '@/hooks/use-app-data';


const goalSchema = z.object({
  name: z.string().min(3, { message: 'اسم الهدف مطلوب (3 أحرف على الأقل)' }),
  targetAmount: z.coerce.number().min(1, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  targetDate: z.date({ required_error: 'تاريخ الهدف مطلوب' }).refine(date => isFuture(date), { message: "يجب أن يكون التاريخ في المستقبل" }),
});

type GoalFormData = z.infer<typeof goalSchema>;

export default function GoalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { goals } = useAppData();

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: '',
      targetAmount: 0,
    },
  });
  
  const addGoalMutation = useMutation({
    mutationFn: (newGoal: Omit<Goal, 'id' | 'createdAt' | 'uid'>) => addGoal(user!.uid, newGoal),
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['goals', user?.uid] });
        toast({
          title: "تم إضافة الهدف!",
          description: `هدف "${variables.name}" أضيف بنجاح.`,
        });
        form.reset();
    },
    onError: () => {
         toast({
          title: "خطأ",
          description: "لم يتمكن من إضافة الهدف.",
          variant: "destructive",
        });
    }
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (goalId: string) => deleteGoal(user!.uid, goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', user?.uid] });
      toast({
        title: "تم الحذف",
        description: "تم حذف الهدف المالي بنجاح.",
      });
    }
  });

  const handleAddGoal = (data: GoalFormData) => {
    if (!user) return;
    
    const newGoalData = {
      name: data.name,
      targetAmount: data.targetAmount,
      targetDate: data.targetDate.toISOString(),
    };
    addGoalMutation.mutate(newGoalData);
  };
  
  const handleDeleteGoal = (goalId: string) => {
    if (!user) return;
    deleteGoalMutation.mutate(goalId);
  };
  
  const calculateMonthsLeft = (targetDate: string) => {
    const months = differenceInMonths(new Date(targetDate), new Date());
    return months <= 0 ? 1 : months; // Ensure at least 1 month
  };

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            أهدافي المالية
        </h1>
        <p className="text-muted-foreground mt-2">
            أضف أهدافك الكبيرة هنا، ودع المخطط الذكي يساعدك على تحقيقها.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-6 w-6" />
            إضافة هدف جديد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleAddGoal)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ما هو هدفك؟</Label>
              <Input id="name" {...form.register('name')} placeholder="مثال: شراء سيارة جديدة، السفر إلى أوروبا" />
              {form.formState.errors.name && <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetAmount">كم المبلغ المطلوب؟ (د.ع)</Label>
              <Input id="targetAmount" type="number" {...form.register('targetAmount')} placeholder="مثال: 15,000,000" />
              {form.formState.errors.targetAmount && <p className="text-sm text-destructive mt-1">{form.formState.errors.targetAmount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>متى تريد تحقيق الهدف؟</Label>
               <Controller
                  name="targetDate"
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
                          {field.value ? format(field.value, "PPP", { locale: arIQ }) : <span>اختر تاريخ الهدف</span>}
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
                          disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              {form.formState.errors.targetDate && <p className="text-sm text-destructive mt-1">{form.formState.errors.targetDate.message}</p>}
            </div>
             <Button type="submit" className="w-full" disabled={addGoalMutation.isPending}>
                {addGoalMutation.isPending ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin" /> جاري الإضافة...</> : 'أضف الهدف'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">قائمة الأهداف</h2>
        {goals.length === 0 ? (
          <Card className='text-center py-12'>
            <CardContent className="flex flex-col items-center gap-4">
                <Flag className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">لا توجد أهداف محددة بعد. ابدأ بإضافة هدفك الأول!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map(goal => {
               const monthsLeft = calculateMonthsLeft(goal.targetDate);
               const monthlySavings = goal.targetAmount / monthsLeft;
               return (
                  <Card key={goal.id} className="flex flex-col">
                    <CardHeader className='pb-4'>
                      <CardTitle className='flex justify-between items-start'>
                        <span className="truncate pr-4">{goal.name}</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive">
                                <Trash2Icon className="h-4 w-4" />
                             </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                سيتم حذف هذا الهدف بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteGoal(goal.id)}>نعم، قم بالحذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </CardTitle>
                      <CardDescription>
                        تاريخ الهدف: {format(new Date(goal.targetDate), 'MMMM yyyy', { locale: arIQ })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2">
                        <p className="text-3xl font-bold text-primary">{goal.targetAmount.toLocaleString()} د.ع</p>
                        <p className="text-sm text-muted-foreground">
                            تحتاج لتوفير ما يقارب <span className="font-bold text-foreground">{monthlySavings.toLocaleString(undefined, {maximumFractionDigits: 0})} د.ع</span> شهريًا.
                        </p>
                    </CardContent>
                    <CardFooter>
                      <Button asChild className="w-full">
                         <Link href={`/planner?goalId=${goal.id}`}>
                            اذهب إلى المخطط الذكي
                            <ChevronsRight className="mr-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
               )
            })}
          </div>
        )}
      </div>

    </div>
  );
}
