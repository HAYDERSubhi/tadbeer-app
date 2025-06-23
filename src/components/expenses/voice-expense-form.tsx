"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { StopCircleIcon, AlertTriangleIcon, CheckCircle2Icon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { recordExpenseWithVoice, RecordExpenseWithVoiceOutput } from '@/ai/flows/record-expense-voice';
import { useToast } from "@/hooks/use-toast";
import type { Expense } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DialogClose } from '@/components/ui/dialog';

export default function VoiceExpenseForm() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [transcribedData, setTranscribedData] = useState<RecordExpenseWithVoiceOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const processAudio = useCallback(async (dataUri: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await recordExpenseWithVoice({ voiceRecordingDataUri: dataUri });
      setTranscribedData(result);
    } catch (e) {
      console.error("Error processing voice:", e);
      setError("حدث خطأ أثناء تحليل الصوت. حاول مرة أخرى.");
      toast({ title: "خطأ في التحليل", description: "لم نتمكن من تحليل التسجيل الصوتي.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  const startRecording = useCallback(async () => {
    if (!isMounted) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("الوصول إلى الميكروفون غير مدعوم في هذا المتصفح.");
      toast({ title: "خطأ", description: "الوصول إلى الميكروفون غير مدعوم.", variant: "destructive" });
      return;
    }
    
    setTranscribedData(null);
    setError(null);
    setAudioDataUri(null);
    setRecordingTime(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const dataUri = reader.result as string;
          setAudioDataUri(dataUri);
          if (dataUri) {
            processAudio(dataUri);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast({ title: "بدء التسجيل", description: "تحدث الآن لتسجيل مصروفك..." });
      
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Error starting recording:", err);
      setIsRecording(false);
      setError("لم يتمكن من بدء التسجيل. تأكد من صلاحيات الميكروفون.");
      toast({ title: "خطأ في التسجيل", description: "تأكد من صلاحيات الميكروفون.", variant: "destructive" });
    }
  }, [isMounted, toast, processAudio]);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      toast({ title: "انتهاء التسجيل", description: "جاري معالجة الصوت..." });
    }
  }, [isRecording, toast]);
  
  useEffect(() => {
    setIsMounted(true);
    startRecording();

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [startRecording]);
  
  const handleSaveExpense = () => {
    if (!transcribedData || !isMounted) return;

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      title: transcribedData.description || `مصروف صوتي (${transcribedData.category})`,
      amount: transcribedData.amount,
      category: transcribedData.category.toLowerCase().replace(/\s+/g, '') || 'other',
      date: transcribedData.date ? new Date(transcribedData.date).toISOString() : new Date().toISOString(),
      description: transcribedData.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const existingExpenses: Expense[] = JSON.parse(localStorage.getItem('expenses') || '[]');
      localStorage.setItem('expenses', JSON.stringify([...existingExpenses, newExpense]));
      
      toast({
        title: "تمت الإضافة بنجاح!",
        description: `تم إضافة مصروف "${newExpense.title}" بمبلغ ${newExpense.amount} د.ع.`,
      });
      setTranscribedData(null);
      setAudioDataUri(null);
      window.dispatchEvent(new CustomEvent('expensesUpdated'));
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
    return (
        <div className="flex justify-center items-center p-8 min-h-[220px]">
            <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center space-y-2 text-primary">
          <Loader2Icon className="h-8 w-8 animate-spin" />
          <p>جاري تحليل الصوت...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex flex-col items-center space-y-4 text-destructive">
          <AlertTriangleIcon className="h-8 w-8" />
          <p className="text-center">{error}</p>
          <Button onClick={startRecording} variant="outline">
            حاول مرة أخرى
          </Button>
        </div>
      );
    }
    
    if (transcribedData) {
       return (
        <Card className="border-none shadow-none w-full">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2Icon className="h-6 w-6 text-green-500" />
              تم تحليل المصروف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-0">
            <div>
              <Label>المبلغ:</Label>
              <Input type="text" readOnly value={`${transcribedData.amount.toLocaleString()} د.ع`} />
            </div>
            <div>
              <Label>الفئة:</Label>
              <Input type="text" readOnly value={transcribedData.category} />
            </div>
            <div>
              <Label>التاريخ:</Label>
              <Input type="text" readOnly value={new Date(transcribedData.date).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })} />
            </div>
            {transcribedData.description && (
              <div>
                <Label>الوصف:</Label>
                <Input type="text" readOnly value={transcribedData.description} />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between p-0 pt-4 mt-2">
            <Button variant="outline" onClick={startRecording}>
              <RefreshCwIcon className="ml-2 h-4 w-4"/>
              تسجيل جديد
            </Button>
            <DialogClose asChild>
              <Button onClick={handleSaveExpense}>حفظ المصروف</Button>
            </DialogClose>
          </CardFooter>
        </Card>
      );
    }
    
    if (isRecording) {
      return (
        <div className="flex flex-col items-center justify-center space-y-6 w-full">
          <div className="text-center">
             <p className="text-sm text-muted-foreground animate-pulse">استمع الآن...</p>
             <p className="text-5xl font-mono tracking-wider text-foreground mt-1">
              {formatTime(recordingTime)}
            </p>
          </div>
          <Button
            onClick={stopRecording}
            variant="destructive"
            size="lg"
            className="w-full"
          >
            <StopCircleIcon className="ml-2 h-5 w-5" />
            إيقاف التسجيل
          </Button>
        </div>
      );
    }

    return (
        <div className="flex flex-col items-center space-y-2 text-primary">
          <Loader2Icon className="h-8 w-8 animate-spin" />
          <p>الاستعداد للتسجيل...</p>
        </div>
    );
  };


  return (
    <div className="p-1 space-y-4 min-h-[220px] w-full flex items-center justify-center">
      {renderContent()}
    </div>
  );
}
