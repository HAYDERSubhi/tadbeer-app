
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Rocket, 
    Cpu, 
    Bot, 
    ShieldCheck, 
    BarChart3, 
    Zap, 
    CreditCard,
    ArrowLeft,
    CheckCircle2,
    FileText,
    Download,
    Loader2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";

export default function ProposalPage() {
    const { toast } = useToast();
    const [isPreparing, setIsPreparing] = useState(false);

    const handleDownloadPDF = useCallback(() => {
        if (typeof window === 'undefined') return;
        
        setIsPreparing(true);
        
        toast({
            title: "جاري تحضير المستند...",
            description: "ستفتح نافذة الطباعة الآن. اختر 'حفظ بتنسيق PDF'.",
        });

        // تقليل التأخير لضمان استجابة أسرع
        setTimeout(() => {
            window.print();
            setIsPreparing(false);
        }, 500);
    }, [toast]);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700 print:p-0 print:pb-0">
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4 py-8 border-b print:border-none print:py-4">
                <div className="relative w-24 h-24 mb-2">
                    <Image 
                        src="/logo.png" 
                        alt="Tadbeer Logo" 
                        fill
                        className="rounded-2xl shadow-xl border-4 border-primary/20 object-contain print:shadow-none print:border-none" 
                        priority
                    />
                </div>
                <h1 className="text-4xl font-black tracking-tight text-foreground">مقترح الاستحواذ: تطبيق تدبير</h1>
                <p className="text-xl text-muted-foreground max-w-2xl">
                    الجيل القادم من الإدارة المالية الشخصية المدعومة بالذكاء الاصطناعي للسوق العراقي.
                </p>
                <div className="flex gap-3 mt-4 print:hidden">
                    <Button asChild variant="outline">
                        <Link href="/settings"><ArrowLeft className="ml-2 h-4 w-4" /> العودة للإعدادات</Link>
                    </Button>
                    <Button 
                        onClick={handleDownloadPDF} 
                        disabled={isPreparing}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isPreparing ? (
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="ml-2 h-4 w-4" />
                        )}
                        تحميل المستند (PDF)
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "دعم اللهجة", value: "عراقي 100%", icon: Bot },
                    { label: "التقنية", value: "Next.js 15", icon: Zap },
                    { label: "الأمان", value: "Firebase", icon: ShieldCheck },
                    { label: "الذكاء", value: "Gemini 2.0", icon: Cpu },
                ].map((stat, i) => (
                    <Card key={i} className="text-center p-4 border-primary/10 bg-card/50 print:bg-white print:border">
                        <stat.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                        <p className="font-bold text-sm">{stat.value}</p>
                    </Card>
                ))}
            </div>

            {/* Main Sections */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Rocket className="text-primary h-6 w-6" /> القيمة الاستراتيجية لـ Qi Card
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-primary/20 bg-primary/5 hover:shadow-md transition-all print:bg-white print:shadow-none">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-primary" /> التكامل مع البطاقة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed text-muted-foreground">
                            يتيح التطبيق لشركة Qi Card ربط مصاريف البطاقة الإلكترونية مع المصاريف النقدية للمستخدم، مما يجعل تطبيق Qi Card المرجع الأول والوحيد للمواطن العراقي في كل معاملاته المالية.
                        </CardContent>
                    </Card>
                    <Card className="border-primary/20 bg-primary/5 hover:shadow-md transition-all print:bg-white print:shadow-none">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-primary" /> بيانات استهلاكية دقيقة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed text-muted-foreground">
                            الذكاء الاصطناعي في "تدبير" يحلل سلوك الإنفاق بدقة (طعام، وقود، تسوق). هذه البيانات هي كنز لشركة Qi Card لتقديم قروض شخصية أو عروض كاش باك مخصصة لكل مستخدم.
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Features List */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="text-primary h-6 w-6" /> الحلول التقنية المبتكرة
                </h2>
                <div className="grid gap-3">
                    {[
                        { t: "محرك الصوت العراقي", d: "تسجيل المصاريف بالصوت باللهجة الدارجة بدقة عالية." },
                        { t: "ماسح الفواتير الذكي", d: "تحويل الصور الورقية إلى بيانات رقمية مهيكلة فوراً." },
                        { t: "المدرب المالي (كرومي)", d: "نظام نصائح ذكي بلهجة ودودة لزيادة الثقافة المالية." },
                        { t: "مخطط الأهداف الذكي", d: "رسم خارطة طريق لتحقيق الأهداف الكبرى بناءً على الدخل." },
                        { t: "دعم الـ PWA", d: "يعمل كتطبيق موبايل دون الحاجة للتحميل من المتجر." },
                    ].map((feature, i) => (
                        <div key={i} className="flex items-start gap-4 bg-muted/30 p-4 rounded-xl border hover:border-primary/30 transition-colors print:bg-white">
                            <div className="bg-primary/10 p-2 rounded-lg text-primary print:border">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">{feature.t}</h3>
                                <p className="text-xs text-muted-foreground">{feature.d}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Tech Footer */}
            <footer className="pt-10 text-center border-t">
                <p className="text-muted-foreground text-sm">تم تطوير هذا المشروع ليكون جاهزاً للربط الفوري مع أنظمة Qi Card البرمجية عبر (APIs).</p>
                <div className="flex justify-center gap-6 mt-6 opacity-40 grayscale hover:opacity-100 transition-all cursor-default print:opacity-100 print:grayscale-0">
                    <p className="text-[10px] font-mono font-bold tracking-widest">NEXT.JS 15</p>
                    <p className="text-[10px] font-mono font-bold tracking-widest">FIREBASE CLOUD</p>
                    <p className="text-[10px] font-mono font-bold tracking-widest">GOOGLE GEMINI AI</p>
                    <p className="text-[10px] font-mono font-bold tracking-widest">GENKIT FLOWS</p>
                </div>
            </footer>
        </div>
    );
}
