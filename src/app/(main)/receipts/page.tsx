// src/app/(main)/receipts/page.tsx
"use client";

import { useState, useRef, useMemo } from 'react';
import type { Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileScan, Loader2, XCircle, Trash2, PlusCircle, Sparkles, AlertTriangleIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { analyzeDetailedReceipt, AnalyzeDetailedReceiptOutput } from '@/ai/flows/analyze-detailed-receipt';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type EditableItem = AnalyzeDetailedReceiptOutput['items'][0] & { id: string };

export default function DetailedReceiptPage() {
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [analyzedItems, setAnalyzedItems] = useState<EditableItem[]>([]);
    const [storeInfo, setStoreInfo] = useState({ name: '', date: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const categoryMap = useMemo(() => {
        return Object.entries(defaultCategories).reduce((acc, [id, { name }]) => {
            acc[id] = name;
            return acc;
        }, {} as Record<string, string>);
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files);
            setImageFiles(prev => [...prev, ...newFiles]);

            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setImagePreviews(prev => [...prev, ...newPreviews]);
        }
    };
    
    const removeImage = (index: number) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => {
            const newPreviews = prev.filter((_, i) => i !== index);
            URL.revokeObjectURL(prev[index]); // Clean up memory
            return newPreviews;
        });
    }

    const handleAnalyze = async () => {
        if (imageFiles.length === 0) {
            toast({ title: "لا توجد صور", description: "الرجاء اختيار صورة واحدة على الأقل.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalyzedItems([]);

        try {
            const imagePromises = imageFiles.map(file => {
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = error => reject(error);
                });
            });

            const imageDataUris = await Promise.all(imagePromises);

            const result = await analyzeDetailedReceipt({
                receiptImages: imageDataUris,
                categories: categoryMap,
            });
            
            setStoreInfo({ name: result.storeName || '', date: result.transactionDate || '' });
            setAnalyzedItems(result.items.map(item => ({ ...item, id: crypto.randomUUID() })));

        } catch (e: any) {
            console.error("Error during detailed analysis:", e);
            setError("حدث خطأ أثناء تحليل الفاتورة. الرجاء التأكد من أن الصور واضحة وحاول مرة أخرى.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleItemChange = (id: string, field: keyof EditableItem, value: string) => {
        setAnalyzedItems(prev => prev.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'price') {
                    updatedItem.price = parseFloat(value) || 0;
                }
                return updatedItem;
            }
            return item;
        }));
    };
    
    const handleRemoveItem = (id: string) => {
        setAnalyzedItems(prev => prev.filter(item => item.id !== id));
    };

    const handleAddItem = () => {
        const newItem: EditableItem = {
            id: crypto.randomUUID(),
            name: '',
            price: 0,
            suggestedCategory: 'other'
        };
        setAnalyzedItems(prev => [...prev, newItem]);
    };
    
    const handleSaveAll = () => {
        const expensesToSave: Expense[] = analyzedItems.map(item => {
            return {
                id: crypto.randomUUID(),
                title: item.name,
                amount: item.price,
                category: item.suggestedCategory,
                date: storeInfo.date ? new Date(storeInfo.date).toISOString() : new Date().toISOString(),
                description: `عنصر من فاتورة ${storeInfo.name || 'ممسوحة'}.`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
        });

        if (expensesToSave.some(e => !e.title || e.amount <= 0)) {
            toast({
                title: "بيانات غير مكتملة",
                description: "يرجى التأكد من أن كل عنصر له اسم وسعر صحيح قبل الحفظ.",
                variant: "destructive"
            });
            return;
        }

        try {
            const existingExpenses: Expense[] = JSON.parse(localStorage.getItem('expenses') || '[]');
            localStorage.setItem('expenses', JSON.stringify([...existingExpenses, ...expensesToSave]));
            
            toast({
                title: "تم الحفظ بنجاح!",
                description: `تم حفظ ${expensesToSave.length} مصروف جديد بنجاح.`,
            });

            // Reset state
            setImageFiles([]);
            setImagePreviews([]);
            setAnalyzedItems([]);
            setStoreInfo({name: '', date: ''});
            
            window.dispatchEvent(new CustomEvent('expensesUpdated'));

        } catch (error) {
            toast({
                title: "خطأ في الحفظ",
                description: "لم يتم حفظ المصاريف. الرجاء المحاولة مرة أخرى.",
                variant: "destructive",
            });
        }
    }

    return (
        <div className="space-y-6 pb-24">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <FileScan className="h-7 w-7 text-primary" />
                        تحليل الفواتير المفصلة
                    </CardTitle>
                    <CardDescription>
                       التقط صورًا واضحة لكل جزء من فاتورتك الطويلة. يمكنك إضافة صور متعددة، وسيقوم الذكاء الاصطناعي بتحليلها جميعًا كمستند واحد.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div 
                        className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="h-12 w-12 text-muted-foreground" />
                        <p className="mt-2 font-semibold">اضغط هنا لإضافة صور الفاتورة</p>
                        <p className="text-sm text-muted-foreground">يمكنك اختيار صور متعددة</p>
                    </div>
                     <Input
                        type="file"
                        accept="image/*"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    
                    {imagePreviews.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-2">الصور المرفوعة ({imagePreviews.length}):</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mt-2">
                                {imagePreviews.map((src, index) => (
                                    <div key={index} className="relative group aspect-[2/3]">
                                        <Image src={src} alt={`معاينة ${index + 1}`} layout="fill" objectFit="cover" className="rounded-md border" data-ai-hint="receipt paper" />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            onClick={() => removeImage(index)}
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <Button onClick={handleAnalyze} disabled={isLoading || imageFiles.length === 0} className="w-full" size="lg">
                        {isLoading ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : <Sparkles className="ml-2 h-5 w-5" />}
                        بدء التحليل الذكي
                    </Button>
                </CardContent>
            </Card>

            {isLoading && (
                 <Card className="text-center py-12">
                    <CardContent className="flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        <p className="text-muted-foreground">جاري تحليل الفاتورة... قد يستغرق هذا بعض الوقت للفواتير الطويلة.</p>
                    </CardContent>
                </Card>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertTitle>خطأ في التحليل</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {analyzedItems.length > 0 && !isLoading && (
                <Card>
                    <CardHeader>
                        <CardTitle>مراجعة وحفظ المصاريف</CardTitle>
                        <CardDescription>
                            تم استخراج {analyzedItems.length} عنصر. راجع البيانات وقم بتصحيحها إذا لزم الأمر، ثم احفظها.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-3">
                            {analyzedItems.map((item, index) => (
                                <div key={item.id} className="p-3 border rounded-lg space-y-2 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center">
                                       <p className='font-semibold'>العنصر #{index + 1}</p>
                                       <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                       </Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className='space-y-1'>
                                            <Label htmlFor={`name-${item.id}`}>اسم العنصر</Label>
                                            <Input id={`name-${item.id}`} value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} />
                                        </div>
                                        <div className='space-y-1'>
                                            <Label htmlFor={`price-${item.id}`}>السعر</Label>
                                            <Input id={`price-${item.id}`} type="number" value={item.price} onChange={e => handleItemChange(item.id, 'price', e.target.value)} />
                                        </div>
                                    </div>
                                     <div className='space-y-1'>
                                        <Label htmlFor={`category-${item.id}`}>الفئة</Label>
                                        <Select value={item.suggestedCategory} onValueChange={(value) => handleItemChange(item.id, 'suggestedCategory', value)}>
                                            <SelectTrigger id={`category-${item.id}`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(defaultCategories).map(([id, cat]) => (
                                                    <SelectItem key={id} value={id}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                     </div>
                                </div>
                            ))}
                        </div>
                         <Button variant="outline" onClick={handleAddItem}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة عنصر يدويًا
                        </Button>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSaveAll} className="w-full">
                            حفظ كل المصاريف ({analyzedItems.length})
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
