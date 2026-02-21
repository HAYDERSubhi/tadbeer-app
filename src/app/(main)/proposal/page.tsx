
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    LayoutRocket, 
    Cpu, 
    Bot, 
    ShieldCheck, 
    BarChart3, 
    Zap, 
    CreditCard,
    ArrowLeft,
    CheckCircle2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function ProposalPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4 py-8 border-b">
                <Image src="/logo.png" alt="Tadbeer Logo" width={80} height={80} className="rounded-2xl shadow-lg" />
                <h1 className="text-3xl font-bold tracking-tight">مشروع استحواذ: تطبيق تدبير (Tadbeer)</h1>
                <p className="text-xl text-muted-foreground max-w-2xl">
                    الجيل القادم من الإدارة المالية الشخصية المدعومة بالذكاء الاصطناعي للسوق العراقي.
                </p>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/"><ArrowLeft className="ml-2 h-4 w-4" /> العودة للتطبيق</Link>
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90">تحميل ملف PDF</Button>
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
                    <Card key={i} className="text-center p-4">
                        <stat.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="font-bold">{stat.value}</p>
                    </Card>
                ))}
            </div>

            {/* Main Sections */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <LayoutRocket className="text-primary" /> لماذا Qi Card؟
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-primary" /> التكامل مع البطاقة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed">
                            يتيح التطبيق لشركة Qi Card ربط مصاريف البطاقة الإلكترونية مع المصاريف النقدية للمستخدم، مما يجعل تطبيق Qi Card المرجع الأول والوحيد للمواطن العراقي في كل معاملاته المالية.
                        </CardContent>
                    </Card>
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-primary" /> بيانات استهلاكية دقيقة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed">
                            الذكاء الاصطناعي في "تدبير" يحلل سلوك الإنفاق بدقة (طعام، وقود، تسوق). هذه البيانات هي كنز لشركة Qi Card لتقديم قروض شخصية أو عروض كاش باك مخصصة لكل مستخدم.
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Features List */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold">المميزات التقنية المنجزة</h2>
                <ul className="grid gap-3">
                    {[
                        "محرك تسجيل المصاريف بالصوت باللهجة العراقية.",
                        "نظام تحليل الفواتير الورقية وتحويلها لبيانات رقمية.",
                        "المدرب المالي الذكي بنظام التنبيه المبكر.",
                        "مخطط الأهداف المالية بعيد المدى.",
                        "دعم كامل للـ PWA للعمل على الموبايل بدون متجر تطبيقات.",
                        "لوحة إحصائيات تفاعلية متقدمة (Charts).",
                    ].map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 bg-muted/50 p-3 rounded-lg border">
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                            <span className="text-sm font-medium">{feature}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Tech Footer */}
            <footer className="pt-10 text-center border-t">
                <p className="text-muted-foreground text-sm">تم تطوير هذا المشروع ليكون جاهزاً للربط الفوري مع أنظمة Qi Card البرمجية (APIs).</p>
                <div className="flex justify-center gap-4 mt-4 opacity-50 grayscale hover:opacity-100 transition-all">
                    <p className="text-xs font-mono">NEXT.JS</p>
                    <p className="text-xs font-mono">FIREBASE</p>
                    <p className="text-xs font-mono">GOOGLE AI</p>
                    <p className="text-xs font-mono">PWA</p>
                </div>
            </footer>
        </div>
    );
}
