
import { ShieldCheck, DatabaseZap, UserCheck } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <Link href="/" className="text-xl font-bold text-primary">تدبير</Link>
            </div>
        </header>

        <main className="container mx-auto max-w-4xl px-4 py-8 sm:py-12">
            <div className="space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">سياسة الخصوصية لتطبيق تدبير</h1>
                    <p className="mt-4 text-lg text-muted-foreground">آخر تحديث: 15 يوليو 2024</p>
                </div>

                <div className="space-y-6 rounded-lg border bg-card p-6 text-card-foreground">
                    <p className="text-base leading-relaxed">
                        نحن في تطبيق "تدبير" نأخذ خصوصيتك على محمل الجد. نلتزم بحماية بياناتك الشخصية والمالية وتوفير بيئة آمنة وموثوقة لإدارة أموالك. توضح هذه السياسة كيفية التعامل مع بياناتك.
                    </p>

                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <ShieldCheck className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">مبدأنا الأساسي: خصوصيتك أولاً</h2>
                                <p className="mt-2 text-muted-foreground">
                                    أنت المالك الوحيد لبياناتك ولك السيطرة الكاملة عليها. نحن لا نبيع بياناتك أو نشاركها مع أي طرف ثالث لأغراض التسويق.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <DatabaseZap className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">عزل البيانات باستخدام قواعد Firebase</h2>
                                <p className="mt-2 text-muted-foreground">
                                    يعتمد تطبيقنا على خدمات Google Firebase الآمنة. بياناتك المالية (المصاريف، الدخل، الأهداف) يتم تخزينها في قاعدة بيانات محمية بقواعد أمان صارمة. هذه القواعد تضمن أن كل مستخدم يمكنه الوصول إلى بياناته الخاصة فقط من خلال حسابه المصادق عليه. لا يمكن لأي مستخدم آخر، ولا حتى مطوري التطبيق، الوصول إلى بياناتك من خلال التطبيق.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <UserCheck className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">البيانات التي نجمعها</h2>
                                <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground">
                                    <li><strong>بيانات الحساب:</strong> بريدك الإلكتروني عند إنشاء حساب.</li>
                                    <li><strong>البيانات المالية:</strong> البيانات التي تدخلها يدويًا مثل المصاريف والأهداف، وهي مرتبطة بحسابك فقط.</li>
                                    <li><strong>بيانات تحليلية مجهولة:</strong> قد نجمع بيانات استخدام مجهولة المصدر (مثل الصفحات التي تتم زيارتها) لتحسين أداء التطبيق وتجربة المستخدم. هذه البيانات لا ترتبط بهويتك الشخصية.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                     <div className="pt-4 text-center text-sm text-muted-foreground">
                        إذا كان لديك أي أسئلة حول سياسة الخصوصية، فلا تتردد في التواصل معنا.
                    </div>
                </div>
            </div>
        </main>
    </div>
  );
}
