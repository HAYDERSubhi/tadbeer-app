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
import { Upload, FileScan, Loader2, XCircle, Trash2, PlusCircle, Sparkles, AlertTriangleIcon, Camera, Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { analyzeDetailedReceipt, AnalyzeDetailedReceiptOutput } from '@/ai/flows/analyze-detailed-receipt';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpense } from '@/services/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import getCroppedImg from '@/lib/crop-image';

type EditableItem = AnalyzeDetailedReceiptOutput['items'][0] & { id: string };

export default function DetailedReceiptPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // State for the final cropped images
    const [finalImages, setFinalImages] = useState<{ id: string, src: string }[]>([]);

    // State for the image processing flow
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // State for analysis results
    const [analyzedItems, setAnalyzedItems] = useState<EditableItem[]>([]);
    const [storeInfo, setStoreInfo] = useState({ name: '', date: '' });
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
        // If the dialog is not open, ensure the camera is off and do nothing.
        if (!isCameraOpen) {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            return;
        }
    
        let isMounted = true;
    
        const startCameraStream = async () => {
            try {
                // Request camera access
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                
                // If the component is still mounted and the video element exists...
                if (isMounted && videoRef.current) {
                    // Store the stream so we can stop it later.
                    streamRef.current = stream;
                    
                    // Attach the stream to the video element.
                    videoRef.current.srcObject = stream;
                    
                    // Explicitly play the video to handle browsers where autoplay might fail.
                    videoRef.current.play().catch(err => {
                        console.error("Video play failed:", err);
                        // This could be a source of silent failure, good to log.
                    });
                }
            } catch (err) {
                console.error("Error accessing camera", err);
                if (isMounted) {
                    toast({ title: "خطأ في الكاميرا", description: "لم نتمكن من الوصول إلى الكاميرا. يرجى التحقق من الأذونات.", variant: "destructive"});
                    setIsCameraOpen(false); // Close the dialog on error
                }
            }
        };
    
        startCameraStream();
    
        // Cleanup function: runs when the component unmounts or `isCameraOpen` changes to false.
        return () => {
            isMounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, [isCameraOpen, toast]);


    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const showCroppedImage = useCallback(async () => {
        if (!imageToCrop || !croppedAreaPixels) return;
        try {
            const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
            setFinalImages(prev => [...prev, { id: crypto.randomUUID(), src: croppedImage }]);
            setImageToCrop(null);
            setZoom(1);
            setCrop({ x: 0, y: 0 });
        } catch (e) {
            console.error(e);
            toast({ title: "خطأ في الاقتصاص", description: "لم نتمكن من اقتصاص الصورة.", variant: "destructive" });
        }
    }, [imageToCrop, croppedAreaPixels, toast]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                setImageToCrop(reader.result as string);
            };
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Reset input
        }
    };
    
    const openCamera = () => {
        setIsCameraOpen(true);
    }

    const takePhoto = () => {
        if (!videoRef.current || !photoRef.current) return;
        
        const video = videoRef.current;
        const photo = photoRef.current;
        
        photo.width = video.videoWidth;
        photo.height = video.videoHeight;
        
        const ctx = photo.getContext('2d');
        ctx?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        const dataUri = photo.toDataURL('image/jpeg');
        setImageToCrop(dataUri);
        
        setIsCameraOpen(false);
    }
    
    const removeImage = (id: string) => {
        setFinalImages(prev => prev.filter((img) => img.id !== id));
    };

    const handleAnalyze = async () => {
        if (finalImages.length === 0) {
            toast({ title: "لا توجد صور", description: "الرجاء إضافة صورة واحدة على الأقل.", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalyzedItems([]);
        try {
            const result = await analyzeDetailedReceipt({
                receiptImages: finalImages.map(img => img.src),
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
            setFinalImages([]);
            setAnalyzedItems([]);
            setStoreInfo({name: '', date: ''});
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

    return (
        <div className="space-y-6 pb-24">
            {/* Camera Dialog */}
            <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
                <DialogContent className="max-w-3xl p-0">
                    <DialogHeader className="p-4">
                        <DialogTitle>التقط صورة للفاتورة</DialogTitle>
                    </DialogHeader>
                    <div className="relative bg-black">
                        <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted playsInline />
                        <canvas ref={photoRef} className="hidden" />
                    </div>
                    <DialogFooter className="p-4">
                        <Button onClick={takePhoto} size="lg" className="w-full">التقاط صورة</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cropper Dialog */}
            <Dialog open={!!imageToCrop} onOpenChange={(open) => !open && setImageToCrop(null)}>
                <DialogContent className="max-w-3xl p-0">
                    <DialogHeader className="p-4">
                        <DialogTitle>اقتصاص صورة الفاتورة</DialogTitle>
                    </DialogHeader>
                    <div className="relative h-[60vh] bg-muted">
                        {imageToCrop && (
                            <Cropper
                                image={imageToCrop}
                                crop={crop}
                                zoom={zoom}
                                aspect={3 / 4}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        )}
                    </div>
                    <DialogFooter className="p-4 flex justify-between w-full">
                        <Button variant="ghost" onClick={() => setImageToCrop(null)}>إلغاء</Button>
                        <Button onClick={showCroppedImage}><Check className="ml-2 h-4 w-4" /> تأكيد الاقتصاص</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <FileScan className="h-7 w-7 text-primary" />
                        تحليل الفواتير المفصلة
                    </CardTitle>
                    <CardDescription>
                       التقط صورًا واضحة أو قم برفعها من جهازك. يمكنك إضافة صور متعددة، وسيقوم الذكاء الاصطناعي بتحليلها جميعًا.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button variant="outline" size="lg" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="ml-2" />
                            رفع ملف
                        </Button>
                        <Button variant="outline" size="lg" onClick={openCamera}>
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
                    
                    {finalImages.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-2">الصور المضافة ({finalImages.length}):</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mt-2">
                                {finalImages.map((img) => (
                                    <div key={img.id} className="relative group aspect-[3/4]">
                                        <Image src={img.src} alt="معاينة الفاتورة" layout="fill" objectFit="cover" className="rounded-md border" data-ai-hint="receipt paper" />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            onClick={() => removeImage(img.id)}
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <Button onClick={handleAnalyze} disabled={isLoading || finalImages.length === 0} className="w-full" size="lg">
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
                        <Button onClick={handleSaveAll} className="w-full" disabled={addMultipleExpensesMutation.isPending}>
                            {addMultipleExpensesMutation.isPending ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحفظ... </> : `حفظ كل المصاريف (${analyzedItems.length})`}
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
