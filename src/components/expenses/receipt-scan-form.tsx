"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CameraIcon, UploadIcon, AlertTriangleIcon, CheckCircle2Icon, Loader2Icon, Edit2Icon } from 'lucide-react';
import { analyzeReceipt, AnalyzeReceiptOutput } from '@/ai/flows/analyze-receipt';
import { useToast } from "@/hooks/use-toast";
import type { Expense } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { DialogClose } from '@/components/ui/dialog';

export default function ReceiptScanForm() {
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [analyzedData, setAnalyzedData] = useState<AnalyzeReceiptOutput | null>(null);
  const [editableAnalyzedData, setEditableAnalyzedData] = useState<AnalyzeReceiptOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        setImageDataUri(reader.result as string);
        setAnalyzedData(null); // Reset previous analysis
        setEditableAnalyzedData(null);
        setError(null);
        processImage(reader.result as string);
      };
    }
  };

  const processImage = async (dataUri: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeReceipt({ photoDataUri: dataUri });
      setAnalyzedData(result);
      setEditableAnalyzedData(JSON.parse(JSON.stringify(result))); // Deep copy for editing
    } catch (e) {
      console.error("Error processing receipt:", e);
      setError("حدث خطأ أثناء تحليل الفاتورة. حاول مرة أخرى.");
      toast({ title: "خطأ في التحليل", description: "لم نتمكن من تحليل صورة الفاتورة.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: keyof AnalyzeReceiptOutput, value: string | number) => {
    if (editableAnalyzedData) {
      setEditableAnalyzedData(prev => {
        if (!prev) return null;
        const updated = { ...prev };
        if (field === 'amount' || (field === 'items' && typeof value === 'number')) { // This needs more robust handling for items
          (updated[field as keyof typeof updated] as any) = parseFloat(value as string);
        } else {
          (updated[field as keyof typeof updated] as any) = value;
        }
        return updated;
      });
    }
  };
  
  const handleSaveExpense = () => {
    if (!editableAnalyzedData || !isMounted) return;

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      title: editableAnalyzedData.storeName || "فاتورة ممسوحة",
      amount: editableAnalyzedData.amount,
      category: 'receipt-scan', // Or try to infer from storeName/items later
      date: editableAnalyzedData.date ? new Date(editableAnalyzedData.date).toISOString() : new Date().toISOString(),
      description: `فاتورة من ${editableAnalyzedData.storeName}. العناصر: ${editableAnalyzedData.items.map(item => `${item.name} (${item.price})`).join(', ')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    try {
      const existingExpenses: Expense[] = JSON.parse(localStorage.getItem('expenses') || '[]');
      localStorage.setItem('expenses', JSON.stringify([...existingExpenses, newExpense]));
      
      toast({
        title: "تمت الإضافة بنجاح!",
        description: `تم إضافة مصروف من فاتورة "${newExpense.title}" بمبلغ ${newExpense.amount} د.ع.`,
      });
      setAnalyzedData(null);
      setImageDataUri(null);
      setEditableAnalyzedData(null);
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
      <Input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      {!editableAnalyzedData && (
        <div className="flex flex-col items-center space-y-3">
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
              <UploadIcon className="ml-2 h-5 w-5" />
              اختر صورة من المعرض
            </Button>
            <p className="text-xs text-muted-foreground">أو</p>
            <Button onClick={() => {
                toast({title: "قيد التطوير", description: "خيار الكاميرا سيتوفر قريباً."})
            }} variant="outline" className="w-full" disabled>
              <CameraIcon className="ml-2 h-5 w-5" />
              التقط صورة بالكاميرا (قريباً)
            </Button>
        </div>
      )}

      {imageDataUri && !editableAnalyzedData && !isLoading && !error && (
         <div className="mt-4 border rounded-md p-2 flex justify-center">
            <Image src={imageDataUri} alt="معاينة الفاتورة" width={200} height={300} className="max-h-[300px] w-auto object-contain rounded-md" data-ai-hint="receipt paper" />
          </div>
      )}
      
      {isLoading && (
        <div className="flex flex-col items-center space-y-2 text-primary pt-4">
          <Loader2Icon className="h-8 w-8 animate-spin" />
          <p>جاري تحليل الفاتورة...</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center space-y-2 text-destructive pt-4">
          <AlertTriangleIcon className="h-8 w-8" />
          <p className="text-center">{error}</p>
          <Button onClick={() => { setError(null); setImageDataUri(null); }} variant="outline">
            حاول مرة أخرى
          </Button>
        </div>
      )}

      {editableAnalyzedData && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckCircle2Icon className="h-6 w-6 text-green-500" />
                    تم تحليل الفاتورة
                </div>
                {/* <Button variant="ghost" size="icon" onClick={() => { alert("Edit functionality placeholder") }}>
                    <Edit2Icon className="h-5 w-5" />
                </Button> */}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[40vh] overflow-y-auto">
            <div>
              <Label htmlFor="storeName">اسم المتجر:</Label>
              <Input id="storeName" type="text" value={editableAnalyzedData.storeName} onChange={e => handleFieldChange('storeName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="amount">المبلغ الإجمالي:</Label>
              <Input id="amount" type="number" value={editableAnalyzedData.amount} onChange={e => handleFieldChange('amount', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="date">التاريخ:</Label>
              <Input id="date" type="date" value={editableAnalyzedData.date} onChange={e => handleFieldChange('date', e.target.value)} />
            </div>
            <Label>العناصر:</Label>
            {editableAnalyzedData.items.length > 0 ? (
              editableAnalyzedData.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center border p-2 rounded-md">
                  <Input 
                    placeholder="اسم العنصر" 
                    value={item.name} 
                    onChange={e => {
                        const newItems = [...editableAnalyzedData.items];
                        newItems[index].name = e.target.value;
                        setEditableAnalyzedData({...editableAnalyzedData, items: newItems});
                    }} 
                    className="flex-1"
                   />
                  <Input 
                    type="number" 
                    placeholder="السعر" 
                    value={item.price}
                    onChange={e => {
                        const newItems = [...editableAnalyzedData.items];
                        newItems[index].price = parseFloat(e.target.value) || 0;
                        setEditableAnalyzedData({...editableAnalyzedData, items: newItems});
                    }}
                    className="w-24"
                   />
                </div>
              ))
            ) : (
                <p className="text-sm text-muted-foreground">لم يتم التعرف على عناصر.</p>
            )}
          </CardContent>
          <CardFooter className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => { setAnalyzedData(null); setImageDataUri(null); setEditableAnalyzedData(null); }}>اختر صورة أخرى</Button>
            <DialogClose asChild>
              <Button onClick={handleSaveExpense}>حفظ المصروف</Button>
            </DialogClose>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
