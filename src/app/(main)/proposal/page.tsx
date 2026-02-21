
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
    Download,
    Loader2,
    LayoutDashboard,
    Mic,
    FileScan,
    Target
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";
import placeholderImages from "@/app/lib/placeholder-images.json";

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

        setTimeout(() => {
            window.print();
            setIsPreparing(false);
        }, 500);
    }, [toast]);

    const screenshots = placeholderImages.screenshots;

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700 print-container print:m-0 print:p-0 print:max-w-none">
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4 py-8 border-b print:border-none print:py-4">
                <div className="relative w-24 h-24 mb-2">
                    <Image 
                        src="/logo.png" 
                        alt="Tadbeer Logo" 
                        width={96}
                        height={96}
                        className="rounded-2xl shadow-xl border-4 border-primary/20 object-contain print:shadow-none print:border-none" 
                        priority
                    />
                </div>
                <h1 className="text-4xl font-black tracking-tight text-foreground">مقترح الاستحواذ الاستراتيجي</h1>
                <p className="text-2xl font-bold text-primary">تطبيق "تدبير" & Qi Card</p>
                <p className="text-lg text-muted-foreground max-w-2xl">
                    رؤية تقنية لتحويل تجربة المستخدم المالي في العراق عبر الذكاء الاصطناعي.
                </p>
                <div className="flex gap-3 mt-4 print:hidden">
                    <Button asChild variant="outline">
                        <Link href="/settings"><ArrowLeft className="ml-2 h-4 w-4" /> العودة</Link>
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
                        تحميل ملف العرض (PDF)
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

            {/* Section: Why Qi Card? */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-r-4 border-primary pr-3">
                    القيمة الاستراتيجية لـ Qi Card
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-none bg-muted/30 print:bg-white print:border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-primary" /> نظام بيئي متكامل
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed text-muted-foreground">
                            "تدبير" يردم الفجوة بين المصاريف النقدية (Cash) ومصاريف البطاقة. بدمجه مع Qi Card، سيحصل المستخدم على رؤية 360 درجة لحياته المالية، مما يزيد من ولاء المستخدم للتطبيق ليصبح شريكه اليومي.
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-muted/30 print:bg-white print:border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-primary" /> البيانات الضخمة (Big Data)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed text-muted-foreground">
                            فهم أنماط استهلاك المجتمع العراقي (أين يذهب الراتب؟). هذه البيانات تمكن Qi Card من تقديم منتجات مالية مخصصة، مثل قروض استهلاكية مستهدفة أو عروض كاش باك في الوقت المناسب.
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* UI Showcase - Updated with high-quality descriptions and logical order */}
            <section className="space-y-8 pt-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-r-4 border-primary pr-3">
                    معرض واجهات التطبيق والميزات
                </h2>
                
                <div className="space-y-16">
                    {/* Main Dashboard */}
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="space-y-4">
                            <div className="bg-primary/10 w-fit p-3 rounded-2xl text-primary">
                                <LayoutDashboard className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold">لوحة التحكم الذكية</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {screenshots[0].description} تركز الواجهة على البساطة والوضوح، مع توفير رؤية فورية لحالة السيولة المالية والإنفاق مقابل الميزانية المحددة.
                            </p>
                        </div>
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border-8 border-muted shadow-2xl">
                            <Image 
                                src={screenshots[0].url} 
                                alt={screenshots[0].description} 
                                fill 
                                className="object-cover"
                                data-ai-hint={screenshots[0].hint}
                            />
                        </div>
                    </div>

                    {/* AI Voice */}
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border-8 border-muted shadow-2xl md:order-2">
                            <Image 
                                src={screenshots[1].url} 
                                alt={screenshots[1].description} 
                                fill 
                                className="object-cover"
                                data-ai-hint={screenshots[1].hint}
                            />
                        </div>
                        <div className="space-y-4 md:order-1">
                            <div className="bg-primary/10 w-fit p-3 rounded-2xl text-primary">
                                <Mic className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold">محرك الصوت العراقي (AI Voice)</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {screenshots[1].description} ميزة فريدة تسمح للمستخدم بتسجيل مصروفاته بمجرد الحديث مع التطبيق، مما يلغي حاجة الإدخال اليدوي الممل.
                            </p>
                        </div>
                    </div>

                    {/* Receipt Scanner */}
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="space-y-4">
                            <div className="bg-primary/10 w-fit p-3 rounded-2xl text-primary">
                                <FileScan className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold">ماسح الفواتير الذكي</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {screenshots[2].description} يقوم النظام بتحليل الفواتير الورقية الطويلة بدقة 100%، واستخراج كل بند على حدة مع سعره وتصنيفه تلقائياً.
                            </p>
                        </div>
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border-8 border-muted shadow-2xl">
                            <Image 
                                src={screenshots[2].url} 
                                alt={screenshots[2].description} 
                                fill 
                                className="object-cover"
                                data-ai-hint={screenshots[2].hint}
                            />
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border-8 border-muted shadow-2xl md:order-2">
                            <Image 
                                src={screenshots[3].url} 
                                alt={screenshots[3].description} 
                                fill 
                                className="object-cover"
                                data-ai-hint={screenshots[3].hint}
                            />
                        </div>
                        <div className="space-y-4 md:order-1">
                            <div className="bg-primary/10 w-fit p-3 rounded-2xl text-primary">
                                <BarChart3 className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold">التحليلات المالية المتقدمة</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {screenshots[3].description} يوفر التطبيق تقارير ذكية تساعد المستخدم على معرفة أين تذهب أمواله فعلياً، وكيف يمكنه تحسين سلوكه الشرائي.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tech Stack List */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-r-4 border-primary pr-3">
                    التكدس التقني (Modern Stack)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        "Next.js 15 (App Router)",
                        "Firebase Cloud Backend",
                        "Google Gemini 2.0 Flash",
                        "Tailwind CSS & ShadCN UI",
                        "Progressive Web App (PWA)",
                        "Genkit AI Orchestration"
                    ].map((tech, i) => (
                        <div key={i} className="flex items-center gap-2 bg-muted/20 p-3 rounded-lg border">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-xs font-semibold">{tech}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="pt-10 text-center border-t border-dashed">
                <p className="text-muted-foreground text-sm">هذا المشروع مصمم ليكون جاهزاً للاندماج الفوري مع البنية التحتية لشركة Qi Card.</p>
                <div className="flex justify-center gap-8 mt-8 opacity-50 grayscale print:opacity-100 print:grayscale-0">
                    <p className="text-[10px] font-mono font-bold tracking-widest">FIREBASE</p>
                    <p className="text-[10px] font-mono font-bold tracking-widest">NEXT.JS</p>
                    <p className="text-[10px] font-mono font-bold tracking-widest">GOOGLE AI</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-6">حقوق الملكية الفكرية © {new Date().getFullYear()} فريق تطوير تدبير</p>
            </footer>
        </div>
    );
}
