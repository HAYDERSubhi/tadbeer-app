
import { ShieldCheck, DatabaseZap, UserCheck, Sparkles, Users, BarChart3, Trash2, Bell, Mail } from 'lucide-react';
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
                    <p className="mt-4 text-lg text-muted-foreground">آخر تحديث: 27 تموز 2026</p>
                </div>

                <div className="space-y-6 rounded-lg border bg-card p-6 text-card-foreground">
                    <p className="text-base leading-relaxed">
                        نحن في تطبيق «تدبير» نأخذ خصوصيتك على محمل الجد. نلتزم بحماية بياناتك الشخصية والمالية وتوفير بيئة آمنة وموثوقة لإدارة أموالك. توضح هذه السياسة بالتفصيل ما هي البيانات التي نجمعها، ولماذا، ومع مَن تُشارَك، وكيف تحذفها متى شئت.
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <ShieldCheck className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">مبدأنا الأساسي: خصوصيتك أولاً</h2>
                                <p className="mt-2 text-muted-foreground">
                                    أنت المالك الوحيد لبياناتك ولك السيطرة الكاملة عليها. نحن <strong>لا نبيع بياناتك ولا نؤجّرها</strong>، ولا نشارك بياناتك المالية مع أي طرف ثالث لأغراض تسويقية أو إعلانية.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <UserCheck className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">البيانات التي نجمعها</h2>
                                <ul className="mt-2 list-disc list-inside space-y-2 text-muted-foreground">
                                    <li>
                                        <strong>بيانات الحساب:</strong> بريدك الإلكتروني واسمك المعروض عند إنشاء حساب. إذا سجّلت الدخول بحساب Google، نستلم من Google بريدك واسمك وصورتك الشخصية فقط — ولا نصل إطلاقاً إلى كلمة مرور حسابك في Google.
                                    </li>
                                    <li>
                                        <strong>الدخول كضيف:</strong> يمكنك استخدام التطبيق بدون بريد إلكتروني عبر «حساب ضيف»، وعندها لا نجمع أي بيانات تعريفية عنك. ⚠️ تنبيه مهم: حساب الضيف مرتبط بجهازك ومتصفّحك فقط، وحذف بيانات المتصفّح أو التطبيق يعني <strong>فقدان بياناتك نهائياً بلا إمكانية استرجاع</strong>. لحماية بياناتك، رقِّ حسابك إلى حساب دائم من داخل التطبيق.
                                    </li>
                                    <li>
                                        <strong>البيانات المالية:</strong> ما تدخله بنفسك من مصاريف ودخل وأهداف وميزانيات وديون وأقساط وخطط. هذه البيانات مرتبطة بحسابك.
                                    </li>
                                    <li>
                                        <strong>صور الإيصالات:</strong> إذا اخترت تصوير إيصال، تُرفع الصورة إلى خدمة التخزين السحابي الخاصة بحسابك لاستخراج بياناتها.
                                    </li>
                                    <li>
                                        <strong>التسجيل الصوتي:</strong> إذا اخترت تسجيل مصروف بصوتك، يُسجَّل المقطع الصوتي ويُعالَج لتحويله إلى نص. لا نستمع إلى تسجيلاتك ولا نحتفظ بها لأغراض أخرى.
                                    </li>
                                    <li>
                                        <strong>بيانات استخدام مجهولة:</strong> إحصاءات عامة عن الاستخدام (الصفحات المزارة، نوع الجهاز، تقريب الموقع الجغرافي على مستوى الدولة) لتحسين أداء التطبيق.
                                    </li>
                                </ul>
                                <p className="mt-3 text-muted-foreground">
                                    <strong>لا نطلب ولا نجمع</strong> أرقام بطاقاتك المصرفية أو بيانات حساباتك البنكية أو جهات اتصالك أو موقعك الدقيق، ولا نربط التطبيق بأي حساب بنكي.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <DatabaseZap className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">أين تُخزَّن بياناتك وكيف تُحمى</h2>
                                <p className="mt-2 text-muted-foreground">
                                    يعتمد التطبيق على خدمات Google Firebase الآمنة. بياناتك المالية تُخزَّن في قاعدة بيانات محمية بقواعد أمان صارمة تضمن أن كل مستخدم يصل إلى بياناته الخاصة فقط عبر حسابه المصادَق عليه. البيانات مشفَّرة أثناء النقل والتخزين، وقد تُخزَّن على خوادم Google خارج بلد إقامتك.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <Sparkles className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">مزايا الذكاء الاصطناعي</h2>
                                <p className="mt-2 text-muted-foreground">
                                    بعض مزايا التطبيق (استخراج بيانات الإيصال، التسجيل الصوتي، المستشار المالي، تحليل أنماط الإنفاق) تعمل عبر خدمة <strong>Google Gemini</strong>. عند استخدامك لهذه المزايا تحديداً، يُرسَل المحتوى اللازم لها فقط — صورة الإيصال، أو المقطع الصوتي، أو ملخّص مصاريفك — إلى Google لمعالجته وإرجاع النتيجة. هذه المزايا <strong>اختيارية</strong>، ويمكنك استخدام التطبيق كاملاً بالإدخال اليدوي بدونها. لا تُستخدم بياناتك لتدريب نماذج الذكاء الاصطناعي.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <Users className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">المشاركة العائلية</h2>
                                <p className="mt-2 text-muted-foreground">
                                    إذا أنشأت «أسرة» أو انضممت إلى واحدة بإرادتك، فإن المصاريف والميزانية والأهداف المشتركة <strong>تصبح مرئية لجميع أعضاء الأسرة</strong>. هذا هو الغرض من الميزة. عند مغادرتك الأسرة تعود بياناتك التي أنشأتها إلى حسابك الشخصي.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <BarChart3 className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">القياس والإعلان</h2>
                                <p className="mt-2 text-muted-foreground">
                                    نستخدم <strong>Google Analytics</strong> و<strong>Meta Pixel</strong> لقياس أداء التطبيق وفعالية حملاتنا الإعلانية. هذه الأدوات تجمع بيانات استخدام مجهولة (فتح صفحة، إنشاء حساب، تسجيل مصروف) وقد تستخدم ملفات تعريف الارتباط. <strong>لا تُرسَل أي بيانات مالية</strong> — لا مبالغ ولا تفاصيل مصاريف — إلى هذه الخدمات إطلاقاً؛ نُرسل وقوع الحدث فقط لا محتواه.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <Bell className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">الإشعارات والملاحظات</h2>
                                <p className="mt-2 text-muted-foreground">
                                    إذا وافقت على الإشعارات، نحفظ معرّفاً تقنياً لجهازك لإرسال التذكيرات والملخّصات، ويمكنك إيقافها في أي وقت من الإعدادات. وإذا أرسلت ملاحظة عبر نموذج «شاركنا رأيك»، يصلنا نصّ الملاحظة مع اسمك وبريدك لنتمكن من الرد ومعالجتها.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <Trash2 className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">حذف حسابك وبياناتك</h2>
                                <p className="mt-2 text-muted-foreground">
                                    تستطيع حذف حسابك وكل بياناتك نهائياً بنفسك في أي وقت: افتح التطبيق ← <strong>الإعدادات</strong> ← <strong>حذف الحساب نهائياً</strong>. يؤدي ذلك إلى حذف حسابك وجميع مصاريفك وأهدافك وإيصالاتك وإعداداتك بشكل لا يمكن التراجع عنه.
                                </p>
                                <p className="mt-2 text-muted-foreground">
                                    ويمكنك بدلاً من ذلك طلب الحذف بمراسلتنا على البريد أدناه، وننفّذه خلال 30 يوماً. نحتفظ ببياناتك ما دام حسابك قائماً فقط.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <Mail className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">حقوقك والتواصل معنا</h2>
                                <p className="mt-2 text-muted-foreground">
                                    لك الحق في الوصول إلى بياناتك أو تصحيحها أو حذفها أو سحب موافقتك في أي وقت. التطبيق غير موجّه للأطفال دون سن 13 عاماً ولا نجمع بياناتهم عن قصد. قد نحدّث هذه السياسة، وسننشر أي تحديث على هذه الصفحة مع تعديل تاريخ «آخر تحديث» أعلاه.
                                </p>
                                <p className="mt-3 text-foreground">
                                    لأي سؤال أو طلب يخص خصوصيتك، راسلنا على:{' '}
                                    <a href="mailto:hello@tadbeer.app" className="font-semibold text-primary underline underline-offset-4">hello@tadbeer.app</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
  );
}
