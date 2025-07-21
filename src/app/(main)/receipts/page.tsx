
// src/app/(main)/receipts/page.tsx
"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileScan, Loader2, XCircle, Trash2, PlusCircle, Sparkles, AlertTriangleIcon, Camera, Check, X, ArrowRight, Crop, ZoomIn, Receipt, Calendar as CalendarIcon, Pencil } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { analyzeDetailedReceipt, AnalyzeDetailedReceiptOutput } from '@/ai/flows/analyze-detailed-receipt';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpense } from '@/services/firestore';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import type { Point, Area } from 'react-easy-crop';
import getCroppedImg from '@/lib/crop-image';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { cn } from '@/lib/utils';


type EditableItem = AnalyzeDetailedReceiptOutput['items'][0] & { id: string };

type ViewState = 'initial' | 'camera' | 'cropping';

export default function DetailedReceiptPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // State for overall page flow
    const [viewState, setViewState] = useState<ViewState>('initial');
    
    // State for images
    const [images, setImages] = useState<{ id: string, src: string }[]>([]);
    const [imageToCrop, setImageToCrop] = useState<{ id: string, src: string } | null>(null);

    // State for analysis results
    const [analyzedItems, setAnalyzedItems] = useState<EditableItem[]>([]);
    const [storeInfo, setStoreInfo] = useState<{ name: string; date: string | null }>({ name: '', date: null });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const photoRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Cropper State
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const categoryMap = useMemo(() => {
        return Object.entries(defaultCategories).reduce((acc, [id, { name }]) => {
            acc[id] = name;
            return acc;
        }, {} as Record<string, string>);
    }, []);

    useEffect(() => {
        let isMounted = true;
    
        const stopStream = () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };

        if (viewState !== 'camera') {
            stopStream();
            return;
        }

        const startCameraStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (isMounted && videoRef.current) {
                    streamRef.current = stream;
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch (err) {
                console.error("Error accessing camera", err);
                if (isMounted) {
                    toast({ title: "خطأ في الكاميرا", description: "لم نتمكن من الوصول إلى الكاميرا. يرجى التحقق من الأذونات.", variant: "destructive"});
                    setViewState('initial');
                }
            }
        };
    
        startCameraStream();
    
        return () => {
            isMounted = false;
            stopStream();
        };
    }, [viewState, toast]);


    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const confirmCrop = useCallback(async () => {
        if (!imageToCrop || !croppedAreaPixels) return;
        try {
            const croppedImage = await getCroppedImg(imageToCrop.src, croppedAreaPixels);
            setImages(prev => prev.map(img => img.id === imageToCrop.id ? { ...img, src: croppedImage } : img));
            setImageToCrop(null);
            setZoom(1);
            setCrop({ x: 0, y: 0 });
            setViewState('initial');
        } catch (e) {
            console.error(e);
            toast({ title: "خطأ في الاقتصاص", description: "لم نتمكن من اقتصاص الصورة.", variant: "destructive" });
        }
    }, [imageToCrop, croppedAreaPixels, toast]);
    
    const startCropping = (image: { id: string, src: string }) => {
        setImageToCrop(image);
        setViewState('cropping');
    }

    const cancelCrop = () => {
        setImageToCrop(null);
        setViewState('initial');
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                setImages(prev => [...prev, { id: crypto.randomUUID(), src: reader.result as string }]);
            };
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Reset input
        }
    };
    
    const takePhoto = () => {
        if (!videoRef.current || !photoRef.current) return;
        
        const video = videoRef.current;
        const photo = photoRef.current;
        
        photo.width = video.videoWidth;
        photo.height = video.videoHeight;
        
        const ctx = photo.getContext('2d');
        ctx?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        const dataUri = photo.toDataURL('image/jpeg');
        setImages(prev => [...prev, { id: crypto.randomUUID(), src: dataUri }]);
        setViewState('initial');
    }
    
    const removeImage = (id: string) => {
        setImages(prev => prev.filter((img) => img.id !== id));
    };

    const handleAnalyze = async () => {
        if (images.length === 0) {
            toast({ title: "لا توجد صور", description: "الرجاء إضافة صورة واحدة على الأقل.", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalyzedItems([]);
        try {
            const result = await analyzeDetailedReceipt({
                receiptImages: images.map(img => img.src),
                categories: categoryMap,
            });
            const transactionDate = result.transactionDate ? format(new Date(result.transactionDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
            setStoreInfo({ name: result.storeName || '', date: transactionDate });
            setAnalyzedItems(result.items.map(item => ({ ...item, id: crypto.randomUUID() })));
        } catch (e: any) {
            console.error("Error during detailed analysis:", e);
            setError("حدث خطأ أثناء تحليل الفاتورة. الرجاء التأكد من أن الصور واضحة وحاول مرة أخرى.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleItemChange = (id: string, field: keyof EditableItem, value: string | number) => {
        setAnalyzedItems(prev => prev.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'price') {
                    updatedItem.price = Number(value) || 0;
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
    
    const addMultipleExpensesMutation = useMutation({
        mutationFn: (expenses: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[]) => {
            if (!user) throw new Error("User not authenticated");
            const promises = expenses.map(exp => addExpense(user!.uid, exp));
            return Promise.all(promises);
        },
        onSuccess: (result, variables) => {
            queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
            toast({
                title: "تم الحفظ بنجاح!",
                description: `تم حفظ ${variables.length} مصروف جديد بنجاح.`,
            });
             // Reset state
            setImages([]);
            setAnalyzedItems([]);
            setStoreInfo({name: '', date: null});
        },
        onError: () => {
            toast({
                title: "خطأ في الحفظ",
                description: "لم يتم حفظ المصاريف. الرجاء المحاولة مرة أخرى.",
                variant: "destructive",
            });
        }
    });

    const handleSaveAll = () => {
        if (!user) return;

        const expensesToSave: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[] = analyzedItems.map(item => {
            return {
                title: item.name,
                amount: item.price,
                category: item.suggestedCategory,
                date: storeInfo.date ? new Date(storeInfo.date).toISOString() : new Date().toISOString(),
                description: `عنصر من فاتورة ${storeInfo.name || 'ممسوحة'}.`,
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

        addMultipleExpensesMutation.mutate(expensesToSave);
    }

    if (viewState === 'camera') {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
                <header className="absolute top-0 left-0 right-0 p-4 flex items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                    <Button variant="ghost" size="icon" onClick={() => setViewState('initial')} className="text-white hover:bg-white/10 hover:text-white">
                        <ArrowRight />
                    </Button>
                </header>
                <div className="flex-1 relative">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                    <canvas ref={photoRef} className="hidden" />
                </div>
                <footer className="absolute bottom-0 left-0 right-0 p-4 flex justify-center items-center z-10 bg-gradient-to-t from-black/50 to-transparent pb-24">
                    <button onClick={takePhoto} className="w-20 h-20 rounded-full border-4 border-white bg-white/30 hover:bg-white/50 p-0 flex items-center justify-center transition-transform active:scale-95" aria-label="التقاط صورة">
                       <Camera className="h-8 w-8 text-white" />
                    </button>
                </footer>
            </div>
        );
    }
    
    if (viewState === 'cropping' && imageToCrop) {
        return (
            <div className="fixed inset-0 z-50 bg-background flex flex-col">
                <header className="p-4 flex justify-between items-center border-b">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Crop className="h-5 w-5 text-primary" /> اقتصاص الفاتورة</h2>
                    <Button variant="ghost" size="icon" onClick={cancelCrop}><X /></Button>
                </header>
                <div className="flex-1 relative bg-muted/50">
                    <Cropper
                        image={imageToCrop.src}
                        crop={crop}
                        zoom={zoom}
                        aspect={3 / 4}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                        showGrid={true}
                    />
                </div>
                <div className="p-4 border-t space-y-4 pb-24">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="zoom-slider" className="flex items-center gap-2"><ZoomIn /> تكبير</Label>
                        <Slider id="zoom-slider" value={[zoom]} onValueChange={([val]) => setZoom(val)} min={1} max={3} step={0.1} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <Button variant="ghost" onClick={cancelCrop}>إلغاء</Button>
                       <Button onClick={confirmCrop}><Check className="ml-2 h-4 w-4" /> تأكيد الاقتصاص</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24">
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <FileScan className="h-6 w-6 text-primary" />
                    فواتيري
                </h1>
                <p className="text-muted-foreground mt-1">
                    قم بمسح فواتيرك الطويلة ودع الذكاء الاصطناعي يحللها لك.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        تحليل الفواتير المفصلة
                    </CardTitle>
                    <CardDescription>
                       التقط صورًا واضحة أو قم برفعها من جهازك. يمكنك إضافة صور متعددة، وتعديلها إذا لزم الأمر.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button variant="outline" size="lg" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="ml-2" />
                            رفع ملف
                        </Button>
                        <Button variant="outline" size="lg" onClick={() => setViewState('camera')}>
                            <Camera className="ml-2" />
                            استخدام الكاميرا
                        </Button>
                    </div>
                    <Input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    
                    {images.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-2">الصور المضافة ({images.length}):</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mt-2">
                                {images.map((img) => (
                                    <div key={img.id} className="relative group aspect-[3/4]">
                                        <Image src={img.src} alt="معاينة الفاتورة" layout="fill" objectFit="cover" className="rounded-md border" data-ai-hint="receipt paper" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end items-center p-1 gap-1">
                                             <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-7 w-7 rounded-full z-10"
                                                onClick={() => startCropping(img)}
                                            >
                                                <Crop className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-7 w-7 rounded-full z-10"
                                                onClick={() => removeImage(img.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <Button onClick={handleAnalyze} disabled={isLoading || images.length === 0} className="w-full" size="lg">
                        {isLoading ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : <Sparkles className="ml-2 h-5 w-5" />}
                        بدء التحليل الذكي
                    </Button>
                </CardContent>
            </Card>

            {isLoading && (
                 <Card className="text-center py-12">
                    <CardContent className="flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        <p className="text-muted-foreground">جاري تحليل الفاتورة... قد يستغرق هذا بعض الوقت.</p>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 border rounded-lg bg-muted/50">
                            <div className="space-y-1">
                                <Label htmlFor="storeName">اسم المتجر (اختياري)</Label>
                                <Input id="storeName" value={storeInfo.name} onChange={e => setStoreInfo(prev => ({...prev, name: e.target.value}))} placeholder="اسم المحل أو السوق" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="transactionDate">تاريخ الفاتورة</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                        id="transactionDate"
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal bg-background", !storeInfo.date && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {storeInfo.date ? format(new Date(storeInfo.date), "PPP", { locale: arIQ }) : <span>اختر تاريخاً</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={storeInfo.date ? new Date(storeInfo.date) : new Date()}
                                            onSelect={(date) => setStoreInfo(prev => ({...prev, date: date ? format(date, 'yyyy-MM-dd') : null}))}
                                            initialFocus
                                            dir="rtl"
                                            locale={arIQ}
                                            disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-3">
                            {analyzedItems.map((item, index) => (
                                <div key={item.id} className="p-3 border rounded-lg space-y-3 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center">
                                       <p className='font-semibold flex items-center gap-2'>
                                            <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs'>{index + 1}</span>
                                            العنصر
                                        </p>
                                       <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                       </Button>
                                    </div>
                                    <div className='space-y-2'>
                                        <Label htmlFor={`name-${item.id}`}>اسم العنصر</Label>
                                        <Input id={`name-${item.id}`} value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                         <div className='space-y-2'>
                                            <Label htmlFor={`price-${item.id}`}>السعر</Label>
                                            <Input id={`price-${item.id}`} type="number" value={item.price} onChange={e => handleItemChange(item.id, 'price', e.target.value)} />
                                        </div>
                                         <div className='space-y-2'>
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
                                </div>
                            ))}
                        </div>
                         <Button variant="outline" onClick={handleAddItem}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة عنصر يدويًا
                        </Button>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSaveAll} className="w-full" disabled={addMultipleExpensesMutation.isPending}>
                            {addMultipleExpensesMutation.isPending ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحفظ... </> : `حفظ كل المصاريف (${analyzedItems.length})`}
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
