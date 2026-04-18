
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    Presentation,
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

    const handleDownloadPPTX = useCallback(async () => {
        setIsPreparing(true);
        toast({
            title: "جاري إنشاء ملف البوربوينت...",
            description: "سيتم تحميل ملف العرض التقديمي القابل للتحرير خلال لحظات.",
        });

        try {
            // Dynamic import for pptxgenjs
            const pptxgen = (await import("pptxgenjs")).default;
            const pptx = new pptxgen();
            pptx.layout = 'LAYOUT_WIDE';
            
            // Set global RTL
            pptx.rtl = true;

            // 1. Title Slide
            let slide1 = pptx.addSlide();
            slide1.background = { color: "F8FAFC" };
            slide1.addText("مقترح الاستحواذ الاستراتيجي", { 
                x: 1, y: 1.5, w: '80%', fontSize: 44, bold: true, color: "14A39A", align: "right", fontFace: "Arial" 
            });
            slide1.addText("تطبيق 'تدبير' & شركة Qi Card العراقية", { 
                x: 1, y: 2.5, w: '80%', fontSize: 28, color: "333333", align: "right" 
            });
            slide1.addText("رؤية تقنية لتحويل تجربة المستخدم المالي في العراق عبر الذكاء الاصطناعي", { 
                x: 1, y: 3.5, w: '80%', fontSize: 18, color: "666666", align: "right" 
            });
            slide1.addText("إعداد وتطوير: فريق عمل تدبير", { 
                x: 1, y: 6.5, w: '80%', fontSize: 14, color: "999999", align: "right" 
            });

            // 2. Vision & Strategic Value
            let slide2 = pptx.addSlide();
            slide2.addText("القيمة الاستراتيجية لـ Qi Card", { 
                x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true, color: "14A39A", align: "right" 
            });
            slide2.addText("• نظام بيئي متكامل: ردم الفجوة بين المصاريف النقدية ومصاريف البطاقة.", { 
                x: 0.5, y: 1.5, w: '90%', fontSize: 20, align: "right" 
            });
            slide2.addText("• البيانات الضخمة: فهم أنماط استهلاك المجتمع العراقي لتقديم قروض ومنتجات مخصصة.", { 
                x: 0.5, y: 2.5, w: '90%', fontSize: 20, align: "right" 
            });
            slide2.addText("• الشمول المالي: تعزيز ثقافة الإدخار لدى المواطن العراقي.", { 
                x: 0.5, y: 3.5, w: '90%', fontSize: 20, align: "right" 
            });

            // 3. Unique Selling Points (USPs)
            let slide3 = pptx.addSlide();
            slide3.addText("نقاط القوة والابتكار", { 
                x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true, color: "14A39A", align: "right" 
            });
            slide3.addText("1. دعم اللهجة العراقية (AI Voice Engine)", { x: 0.5, y: 1.5, fontSize: 22, bold: true, align: "right" });
            slide3.addText("2. المدرب المالي الذكي (AI Financial Coach)", { x: 0.5, y: 2.5, fontSize: 22, bold: true, align: "right" });
            slide3.addText("3. ماسح الفواتير الذكي (AI Receipt Scanner)", { x: 0.5, y: 3.5, fontSize: 22, bold: true, align: "right" });
            slide3.addText("4. المخطط المالي للأهداف", { x: 0.5, y: 4.5, fontSize: 22, bold: true, align: "right" });

            // 4. Technology Stack
            let slide4 = pptx.addSlide();
            slide4.addText("التكدس التقني (Modern Stack)", { 
                x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true, color: "14A39A", align: "right" 
            });
            slide4.addText("• Frontend: Next.js 15 (App Router)", { x: 1, y: 1.5, fontSize: 18, align: "right" });
            slide4.addText("• Backend: Google Firebase (Real-time Sync)", { x: 1, y: 2.2, fontSize: 18, align: "right" });
            slide4.addText("• AI: Google Genkit & Gemini 2.0 Flash", { x: 1, y: 2.9, fontSize: 18, align: "right" });
            slide4.addText("• Mobile: Progressive Web App (PWA)", { x: 1, y: 3.6, fontSize: 18, align: "right" });

            // 5. Save & Close
            await pptx.writeFile({ fileName: "Tadbeer_QiCard_Proposal.pptx" });
            
            toast({
                title: "تم التحميل بنجاح!",
                description: "ملف البوربوينت جاهز الآن للفتح والتعديل.",
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "خطأ في التصدير",
                description: "لم نتمكن من إنشاء ملف البوربوينت. يرجى المحاولة مرة أخرى.",
                variant: "destructive"
            });
        } finally {
            setIsPreparing(false);
        }
    }, [toast]);

    const screenshots = placeholderImages.screenshots;

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4 py-8 border-b">
                <div className="relative w-24 h-24 mb-2">
                    <Image 
                        src="/logo.png" 
                        alt="Tadbeer Logo" 
                        width={96}
                        height={96}
                        className="rounded-2xl shadow-xl border-4 border-primary/20 object-contain" 
                        priority
                    />
                </div>
                <h1 className="text-4xl font-black tracking-tight text-foreground">مقترح الاستحواذ الاستراتيجي</h1>
                <p className="text-2xl font-bold text-primary">تطبيق "تدبير" & Qi Card</p>
                <p className="text-lg text-muted-foreground max-w-2xl">
                    رؤية تقنية لتحويل تجربة المستخدم المالي في العراق عبر الذكاء الاصطناعي.
                </p>
                <div className="flex gap-3 mt-4">
                    <Button asChild variant="outline">
                        <Link href="/settings"><ArrowLeft className="ml-2 h-4 w-4" /> العودة</Link>
                    </Button>
                    <Button 
                        onClick={handleDownloadPPTX} 
                        disabled={isPreparing}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isPreparing ? (
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Presentation className="ml-2 h-4 w-4" />
                        )}
                        تحميل بوربوينت (قابل للتعديل)
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
                    <Card key={i} className="text-center p-4 border-primary/10 bg-card/50">
                        <stat.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                        <p className="font-bold text-sm">{stat.value}</p>
                    </Card>
                ))}
            </div>

            {/* Section: Why Qi Card? */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-r-4 border-primary pr-3">
                    <Rocket className="text-primary h-6 w-6" /> القيمة الاستراتيجية لـ Qi Card
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-none bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-primary" /> نظام بيئي متكامل
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed text-muted-foreground">
                            "تدبير" يردم الفجوة بين المصاريف النقدية (Cash) ومصاريف البطاقة. بدمجه مع Qi Card، سيحصل المستخدم على رؤية 360 درجة لحياته المالية، مما يزيد من ولاء المستخدم للتطبيق ليصبح شريكه اليومي.
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-muted/30">
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

            {/* UI Showcase */}
            <section className="space-y-8 pt-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 border-r-4 border-primary pr-3">
                    <LayoutDashboard className="text-primary h-6 w-6" /> معرض واجهات التطبيق والميزات
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
                </div>
            </section>

            {/* Footer */}
            <footer className="pt-10 text-center border-t border-dashed">
                <p className="text-muted-foreground text-sm">هذا المشروع مصمم ليكون جاهزاً للاندماج الفوري مع البنية التحتية لشركة Qi Card.</p>
                <p className="text-[10px] text-muted-foreground mt-6">حقوق الملكية الفكرية © {new Date().getFullYear()} فريق تطوير تدبير</p>
            </footer>
        </div>
    );
}
