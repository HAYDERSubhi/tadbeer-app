
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import { FilePenLine, FileScan, CreditCard, Loader2Icon, Mic, AlertTriangleIcon, Link2, Bell } from "lucide-react";
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
  const [transcript, setTranscript] = useState('');
  
  const recognitionRef = useRef<any | null>(null);
  
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
            description: `تم التسجيل صوتيًا: "${transcript}"`,
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
  
  
  const handleToggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isVoiceRecording) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      setVoiceError(null);
      recognitionRef.current.start();
    }
  }, [isVoiceRecording]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'ar-IQ';

        recognitionRef.current.onstart = () => setIsVoiceRecording(true);
        recognitionRef.current.onend = () => {
          setIsVoiceRecording(false);
          // When recording stops, process the final transcript
          setTranscript(prev => {
            if (prev.trim()) {
              processTranscript(prev.trim());
            }
            return '';
          });
        };
        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          let errorMsg = `خطأ في التعرف على الصوت: ${event.error}`;
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            errorMsg = 'الرجاء السماح بالوصول للميكروفون.';
          }
          setVoiceError(errorMsg);
          setIsVoiceRecording(false);
        };

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                  finalTranscript += event.results[i][0].transcript;
              } else {
                  interimTranscript += event.results[i][0].transcript;
              }
          }
          // Use final transcript to update the state
          if (finalTranscript) {
             setTranscript(prev => prev + ' ' + finalTranscript);
          }
        };

    } else {
        setVoiceError("متصفحك لا يدعم خاصية التعرف على الصوت.");
    }
    
    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
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
                      <CreditCard className="h-16 w-16 text-primary" />
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

  const VoiceButtonContent = () => {
    if (voiceError) {
      return (
          <div onClick={(e) => { e.stopPropagation(); setVoiceError(null); handleToggleRecording() }} className="flex flex-col items-center justify-center gap-2 text-destructive">
              <AlertTriangleIcon className="h-6 w-6" />
              <span className="text-xs text-center">{voiceError.length > 30 ? 'خطأ. انقر للمحاولة' : voiceError}</span>
          </div>
      );
    }
    if (isVoiceLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-2">
                <Loader2Icon className="h-6 w-6 animate-spin" />
                <span>جاري التحليل...</span>
            </div>
        )
    }
    if (isVoiceRecording) {
      return (
          <div className="flex flex-col items-center justify-center gap-2 text-destructive">
            <Mic className="h-6 w-6 animate-pulse" />
            <span className='truncate max-w-full px-1'>{transcript || '...يتم الاستماع'}</span>
          </div>
      );
    }
    return (
        <div className="flex flex-col items-center justify-center gap-2">
            <Mic className="h-6 w-6" />
            <span>سجل بالصوت</span>
        </div>
    );
  };

  return (
    <Card id="expense-input-methods">
      <CardHeader>
        <CardTitle>أضف معاملة جديدة</CardTitle>
      </CardHeader>
      <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
                  <DialogTrigger asChild>
                      <Button variant="outline" className="h-24 flex-col gap-2">
                          <FilePenLine className="h-6 w-6" />
                          <span>إدخال يدوي</span>
                      </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] max-h-[90dvh] overflow-y-auto">
                      <DialogHeader><DialogTitle as="h2">إدخال يدوي</DialogTitle></DialogHeader>
                      <ManualExpenseForm setOpen={setIsManualEntryOpen} />
                  </DialogContent>
              </Dialog>

              <Dialog open={isVoiceEntryOpen} onOpenChange={setIsVoiceEntryOpen}>
                <Button variant="outline" className="h-24 flex-col gap-2 relative" onClick={handleToggleRecording} disabled={!recognitionRef.current || isVoiceLoading}>
                    <VoiceButtonContent />
                </Button>
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

              <Button variant="outline" className="h-24 flex-col gap-2" asChild>
                  <Link href="/receipts">
                      <FileScan className="h-6 w-6" />
                      <span>تحليل فاتورة</span>
                  </Link>
              </Button>

              <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
                  <DialogTrigger asChild>
                      <Button variant="outline" className="h-24 flex-col gap-2">
                          <CreditCard className="h-6 w-6" />
                          <span>بطاقة إلكترونية</span>
                      </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    {renderCardDialogContent()}
                  </DialogContent>
                </Dialog>
          </div>
      </CardContent>
    </Card>
  );
}

    
