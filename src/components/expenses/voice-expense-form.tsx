"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MicIcon, StopCircleIcon, AlertTriangleIcon, CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { recordExpenseWithVoice, RecordExpenseWithVoiceOutput } from '@/ai/flows/record-expense-voice';
import { useToast } from "@/hooks/use-toast";
import type { Expense } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DialogClose } from '@/components/ui/dialog';

export default function VoiceExpenseForm() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [transcribedData, setTranscribedData] = useState<RecordExpenseWithVoiceOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);


  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("الوصول إلى الميكروفون غير مدعوم في هذا المتصفح.");
      toast({ title: "خطأ", description: "الوصول إلى الميكروفون غير مدعوم.", variant: "destructive" });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // Common format, adjust if needed
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAudioDataUri(reader.result as string);
          processAudio(reader.result as string);
        };
        stream.getTracks().forEach(track => track.stop()); // Stop microphone access
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTranscribedData(null);
      setError(null);
      toast({ title: "بدء التسجيل", description: "تحدث الآن لتسجيل مصروفك..." });
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("لم يتمكن من بدء التسجيل. تأكد من صلاحيات الميكروفون.");
      toast({ title: "خطأ في التسجيل", description: "تأكد من صلاحيات الميكروفون.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({ title: "انتهاء التسجيل", description: "جاري معالجة الصوت..." });
    }
  };

  const processAudio = async (dataUri: string) => {
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
  };
  
  const handleSaveExpense = () => {
    if (!transcribedData || !isMounted) return;

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      title: transcribedData.description || `مصروف صوتي (${transcribedData.category})`,
      amount: transcribedData.amount,
      category: transcribedData.category.toLowerCase().replace(/\s+/g, '') || 'other', // Simple categorization
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
    return <div className="flex justify-center items-center p-8"><Loader2Icon className="h-8 w-8 animate-spin text-primary" /></div>; 
  }

  return (
    <div className="p-1 space-y-4">
      {!transcribedData && (
        <div className="flex flex-col items-center space-y-4">
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            variant={isRecording ? "destructive" : "default"}
            size="lg"
            className="w-full"
          >
            {isRecording ? (
              <>
                <StopCircleIcon className="ml-2 h-5 w-5 animate-pulse" />
                إيقاف التسجيل
              </>
            ) : (
              <>
                <MicIcon className="ml-2 h-5 w-5" />
                {audioDataUri ? 'تسجيل مرة أخرى' : 'بدء التسجيل الصوتي'}
              </>
            )}
          </Button>
          {isRecording && <p className="text-sm text-muted-foreground">التسجيل جاري... اضغط للإيقاف.</p>}
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center space-y-2 text-primary">
          <Loader2Icon className="h-8 w-8 animate-spin" />
          <p>جاري تحليل الصوت...</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center space-y-2 text-destructive">
          <AlertTriangleIcon className="h-8 w-8" />
          <p className="text-center">{error}</p>
          <Button onClick={() => { setError(null); setAudioDataUri(null); }} variant="outline">
            حاول مرة أخرى
          </Button>
        </div>
      )}

      {transcribedData && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="h-6 w-6 text-green-500" />
              تم تحليل المصروف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => { setTranscribedData(null); setAudioDataUri(null); }}>تسجيل جديد</Button>
            <DialogClose asChild>
              <Button onClick={handleSaveExpense}>حفظ المصروف</Button>
            </DialogClose>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
