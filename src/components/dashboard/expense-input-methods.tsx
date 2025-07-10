
// src/components/dashboard/expense-input-methods.tsx
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import { FilePenLine, FileScan, CreditCardIcon, Loader2Icon, Mic, StopCircleIcon, AlertTriangleIcon, Link2, Bell } from "lucide-react";
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import type { Expense, LinkedCard } from '@/types';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { recordExpenseWithText, RecordExpenseWithTextOutput } from '@/ai/flows/record-expense-text';
import { simulateCardTransactions } from '@/ai/flows/simulate-card-transactions';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpense, updateUserSettings } from '@/services/firestore';
import { useAppData } from '@/hooks/use-app-data';

const linkCardSchema = z.object({
  name: z.string().min(3, { message: 'اسم البطاقة مطلوب (3 أحرف على الأقل)' }),
  last4: z.string().length(4, { message: 'يجب أن يكون 4 أرقام' }).regex(/^\d{4}$/, { message: 'أرقام فقط' }),
});

type LinkCardFormData = z.infer<typeof linkCardSchema>;

const DEFAULT_LINKED_CARD: LinkedCard | null = null;

export default function ExpenseInputMethods() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { expenses, userSettings } = useAppData();

  const linkedCard = useMemo(() => userSettings?.linkedCard || DEFAULT_LINKED_CARD, [userSettings]);

  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isVoiceEntryOpen, setIsVoiceEntryOpen] = useState(false);
  const [voiceExpenseData, setVoiceExpenseData] = useState<Partial<Expense> | null>(null);

  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [isSyncingCard, setIsSyncingCard] = useState(false);

  // Voice recording state
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any | null>(null);
  const finalTranscriptRef = useRef('');
  
  const cardForm = useForm<LinkCardFormData>({
    resolver: zodResolver(linkCardSchema),
    defaultValues: { name: '', last4: '' }
  });
  
  const addMultipleExpensesMutation = useMutation({
        mutationFn: (expenses: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[]) => {
            if (!user) throw new Error("User not authenticated");
            const promises = expenses.map(exp => addExpense(user!.uid, exp));
            return Promise.all(promises);
        },
        onSuccess: (result, variables) => {
            queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
            toast({
                title: "تمت المزامنة بنجاح!",
                description: `تمت إضافة ${variables.length} معاملة جديدة من بطاقتك.`,
            });
        },
        onError: () => {
            toast({
                title: "خطأ في المزامنة",
                description: "لم يتم حفظ المعاملات. الرجاء المحاولة مرة أخرى.",
                variant: "destructive",
            });
        }
    });

  const categoryMap = useMemo(() => {
      return Object.entries(defaultCategories).reduce((acc, [id, { name }]) => {
          acc[id] = name;
          return acc;
      }, {} as Record<string, string>);
  }, []);

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) {
        setIsVoiceLoading(false);
        return;
    }
    
    setIsVoiceLoading(true);
    setVoiceError(null);

    try {
        const analysisResult: RecordExpenseWithTextOutput = await recordExpenseWithText({
            expenseText: transcript,
            categories: categoryMap,
        });

        if (!analysisResult || !analysisResult.amount || analysisResult.amount <= 0) {
            throw new Error("لم يتمكن الذكاء الاصطناعي من تحليل مبلغ صحيح من النص. يرجى المحاولة بصوت أوضح.");
        }

        const newExpenseData: Partial<Expense> = {
            title: analysisResult.description || `مصروف صوتي`,
            amount: analysisResult.amount,
            category: analysisResult.category,
            date: analysisResult.date ? new Date(analysisResult.date).toISOString() : new Date().toISOString(),
            description: analysisResult.description,
        };

        setVoiceExpenseData(newExpenseData);
        setIsVoiceEntryOpen(true);
        
    } catch (e: any) {
        console.error("Error processing voice expense:", e);
        const errorMessage = e?.message || "حدث خطأ أثناء تحليل المصروف. حاول مرة أخرى.";
        setVoiceError(errorMessage);
        toast({ title: "خطأ في التحليل", description: errorMessage, variant: "destructive"});
    } finally {
        setIsVoiceLoading(false);
    }
  }, [categoryMap, toast]);
  
  
  const handleStartRecording = useCallback(() => {
    if (recognitionRef.current) {
        try {
            finalTranscriptRef.current = '';
            setVoiceError(null);
            recognitionRef.current.start();
        } catch (e) {
            console.error("Could not start recognition", e);
            setVoiceError("فشل بدء التعرف. هل تم منح الإذن؟");
        }
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
  }, []);


  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // Stop after first final result
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'ar-IQ';

        recognitionRef.current.onstart = () => {
            setIsVoiceRecording(true);
            setVoiceError(null);
        };

        recognitionRef.current.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            finalTranscriptRef.current = transcript;
        };

        recognitionRef.current.onend = () => {
            setIsVoiceRecording(false);
            if (finalTranscriptRef.current.trim()) {
              processTranscript(finalTranscriptRef.current);
            }
        };
        
        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          let errorMsg = `خطأ في التعرف على الصوت: ${event.error}`;
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            errorMsg = 'الرجاء السماح بالوصول للميكروفون.';
          } else if (event.error === 'no-speech') {
            errorMsg = 'لم يتم اكتشاف أي كلام. حاول مرة أخرى.';
          }
          setVoiceError(errorMsg);
          setIsVoiceRecording(false);
        };

    } else {
        setVoiceError("متصفحك لا يدعم خاصية التعرف على الصوت.");
    }
    
    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }
    }
  }, [processTranscript]);
  
  const updateSettingsMutation = useMutation({
      mutationFn: (newSettings: Partial<any>) => updateUserSettings(user!.uid, newSettings),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
          toast({
              title: "تم الحفظ",
              description: "تم ربط بطاقتك بنجاح.",
          });
          setIsCardDialogOpen(false);
      },
      onError: () => {
          toast({ title: "خطأ", description: "فشل ربط البطاقة.", variant: "destructive" });
      }
  });

  const onLinkCardSubmit = (data: LinkCardFormData) => {
    updateSettingsMutation.mutate({ linkedCard: data });
  };
  
  const handleSyncCard = async () => {
      setIsSyncingCard(true);
      try {
        const lastCardTransaction = expenses.filter(e => e.description?.startsWith("معاملة بطاقة:")).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        const result = await simulateCardTransactions({
          categories: categoryMap,
          lastTransactionDate: lastCardTransaction?.date
        });

        if (result.transactions.length > 0) {
            const expensesToSave: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[] = result.transactions.map(item => ({
                title: item.title,
                amount: item.amount,
                category: item.category,
                date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
                description: `معاملة بطاقة: ${item.description || item.title}`,
            }));
            await addMultipleExpensesMutation.mutateAsync(expensesToSave);
        } else {
             toast({
                title: "لا توجد معاملات جديدة",
                description: "بطاقتك محدثة. لم يتم العثور على معاملات جديدة.",
            });
        }
      } catch (e) {
          console.error("Card sync failed", e);
          toast({ title: "خطأ في المزامنة", description: "فشل الاتصال بالذكاء الاصطناعي.", variant: "destructive" });
      } finally {
          setIsSyncingCard(false);
      }
  }

  const renderCardDialogContent = () => {
      if(linkedCard) {
          return (
            <>
              <DialogHeader>
                  <DialogTitle as="h2" className='text-center'>{linkedCard.name}</DialogTitle>
                  <DialogDescription className='text-center'>
                    بطاقة إلكترونية مرتبطة | **** **** **** {linkedCard.last4}
                  </DialogDescription>
              </DialogHeader>
              <div className='p-6 text-center space-y-6'>
                  <div className='flex flex-col items-center gap-2'>
                      <CreditCardIcon className="h-16 w-16 text-primary" />
                  </div>
                  <Button onClick={handleSyncCard} disabled={isSyncingCard || addMultipleExpensesMutation.isPending} className="w-full" size="lg">
                     {isSyncingCard ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin"/> جاري المزامنة...</> : <><Bell className="ml-2 h-4 w-4"/> مزامنة المعاملات</>}
                  </Button>
              </div>
            </>
          );
      }

      return (
        <>
        <DialogHeader>
          <DialogTitle as="h2">ربط بطاقة إلكترونية (محاكاة)</DialogTitle>
          <DialogDescription>
            هذه الميزة هي محاكاة آمنة. أدخل أي معلومات لربط بطاقة افتراضية وتجربة مزامنة المعاملات التي يولدها الذكاء الاصطناعي.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={cardForm.handleSubmit(onLinkCardSubmit)} className="space-y-4 p-1 pt-4">
            <div>
              <Label htmlFor="card-name">اسم البطاقة</Label>
              <Input id="card-name" {...cardForm.register('name')} placeholder="مثال: بطاقة المصرف" />
              {cardForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{cardForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="card-last4">آخر 4 أرقام</Label>
              <Input id="card-last4" type="text" maxLength={4} {...cardForm.register('last4')} placeholder="1234" inputMode='numeric' />
              {cardForm.formState.errors.last4 && <p className="text-sm text-destructive mt-1">{cardForm.formState.errors.last4.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={updateSettingsMutation.isPending}>
                {updateSettingsMutation.isPending ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin"/> جاري الربط...</> : <><Link2 className="ml-2 h-4 w-4" /> ربط البطاقة</>}
            </Button>
        </form>
        </>
      );
  }

  const handleToggleRecording = () => {
    if (isVoiceRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  return (
    <div id="expense-input-methods" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
            onClick={handleToggleRecording}
            disabled={!recognitionRef.current || isVoiceLoading}
            className={cn(
                "flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50"
            )}
            aria-label={isVoiceRecording ? "إيقاف التسجيل" : voiceError ? "محاولة مرة أخرى" : "بدء التسجيل الصوتي"}
        >
            {voiceError ? (
                <div onClick={(e) => { e.stopPropagation(); setVoiceError(null); }} className="flex flex-col items-center justify-center gap-3">
                    <AlertTriangleIcon className="h-8 w-8 text-destructive" />
                    <p className="text-sm font-semibold text-center">{voiceError}</p>
                    <p className="text-xs text-destructive/80 mt-1">اضغط للمحاولة مرة أخرى</p>
                </div>
            ) : isVoiceLoading ? (
                 <div className="flex flex-col items-center justify-center gap-3">
                    <span className="w-16 h-16 rounded-full flex items-center justify-center">
                        <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
                    </span>
                    <p className="font-semibold">جاري التحليل...</p>
                 </div>
            ) : (
                 <div className="flex flex-col items-center justify-center gap-3">
                    <span className="w-16 h-16 rounded-full flex items-center justify-center transition-colors">
                        {isVoiceRecording ? (
                            <div className="relative h-8 w-8 text-red-500">
                               <div className="h-4 w-4 bg-red-500 rounded-full animate-pulse"></div>
                            </div>
                        ) : (
                            <Mic className="h-8 w-8 text-green-600 dark:text-green-300" />
                        )}
                    </span>
                    <p className="font-semibold h-5 truncate">
                        {isVoiceRecording ? "...يتم التسجيل" : "سجل بالصوت"}
                    </p>
                 </div>
            )}
        </button>
        
        <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
          <DialogTrigger asChild>
            <div className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40 cursor-pointer hover:bg-muted/50">
              <span className="w-16 h-16 rounded-full flex items-center justify-center">
                 <FilePenLine className="h-8 w-8 text-blue-600 dark:text-blue-300" />
              </span>
              <p className="font-semibold">إدخال يدوي</p>
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] max-h-[90dvh] overflow-y-auto">
            <DialogHeader><DialogTitle as="h2">إدخال يدوي</DialogTitle></DialogHeader>
            <ManualExpenseForm setOpen={setIsManualEntryOpen} />
          </DialogContent>
        </Dialog>
        
        <Dialog open={isVoiceEntryOpen} onOpenChange={setIsVoiceEntryOpen}>
          <DialogContent className="sm:max-w-[425px] max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle as="h2">مراجعة المصروف الصوتي</DialogTitle>
                <DialogDescription>
                    يرجى مراجعة البيانات التي تم تحليلها من تسجيلك الصوتي قبل حفظها.
                </DialogDescription>
            </DialogHeader>
            <ManualExpenseForm setOpen={setIsVoiceEntryOpen} initialData={voiceExpenseData} />
          </DialogContent>
        </Dialog>

        <Link href="/receipts" className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40 hover:bg-muted/50">
          <span className="w-16 h-16 rounded-full flex items-center justify-center">
             <FileScan className="h-8 w-8 text-teal-600 dark:text-teal-300" />
          </span>
          <p className="font-semibold">تحليل فاتورة</p>
        </Link>
        
        <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
            <DialogTrigger asChild>
              <div className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40 cursor-pointer hover:bg-muted/50">
                <span className="w-16 h-16 rounded-full flex items-center justify-center">
                   <CreditCardIcon className="h-8 w-8 text-amber-600 dark:text-amber-300" />
                </span>
                <p className="font-semibold">بطاقة إلكترونية</p>
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              {renderCardDialogContent()}
            </DialogContent>
          </Dialog>
    </div>
  );
}
