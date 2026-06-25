# تدبير — دليل المشروع (Source of Truth)

> هذا الملف يُحمَّل تلقائياً في بداية كل جلسة. الهدف: ألّا يعتمد Claude على الذاكرة أو المحادثات، بل على الكود الفعلي.

## ⛔ القاعدة الإلزامية الأولى

**الكود الموجود على القرص هو المصدر الوحيد للحقيقة.** المحادثات السابقة والافتراضات والذاكرة كلها معلومات مساعدة قد تكون قديمة.

- **ممنوع** تأكيد وجود أو غياب أي ميزة قبل قراءة ملفها الفعلي. عبارة "غير موجود" ممنوعة قبل البحث.
- قبل أي تعديل: حدّد الملفات المتأثرة، اقرأها **كاملةً**، افحص أماكن استدعائها، ثم اقترح قبل التنفيذ.
- لا تنشئ ملفاً/دالة/مزوّداً جديداً إذا وُجد بديل يؤدي نفس الوظيفة — أعد الاستخدام وحافظ على النمط المعماري.
- عند تعارض المحادثة مع الكود: الكود هو المرجع الرسمي.
- إن كان ملف مفقوداً أو غير واضح: توقّف واطلبه، لا تخمّن.

## 🔍 أمر الجرد السريع (شغّله قبل أي نقاش عن الميزات)

```powershell
$s="src"
Get-ChildItem "$s\app" -Recurse -Filter "page.tsx" | % { $_.DirectoryName.Replace("$s\app","").Replace("\","/") }   # الشاشات
Get-ChildItem "$s\app\api" -Recurse -Filter "route.ts" | % { $_.DirectoryName.Replace("$s\app\api","") }            # APIs
Get-ChildItem "$s\ai\flows" -Filter "*.ts" | % { $_.BaseName }                                                       # تدفقات AI
Get-ChildItem "$s\hooks","$s\lib","$s\services" -Filter "*.ts*" | % { $_.BaseName }                                  # المنطق
```

---

## الهوية التقنية
Next.js 15.2.8 (App Router) · React 18 · TypeScript صارم (`ignoreBuildErrors:true`) · PWA (`@ducanh2912/next-pwa`, NetworkFirst) · Firebase (Auth+Firestore+Storage) · firebase-admin **مثبّت على ^12 عمداً** (jose@6 يكسره) · Genkit + Gemini 2.5-flash · Web Push + 4 Vercel Cron · RTL عربي · v1.2.0.

## نماذج البيانات (`src/types/index.ts` — 15 كياناً)
Expense · Goal · Income · UserSettings · Category · Household · HouseholdMember · Debt · InstallmentPlan · WeddingPlan · Silftna · EarnedBadge · RecurringPayment · UserBudgetSettings · NotificationSettings.

## ⚠️ المعمارية الجوهرية — المسار المزدوج (Dual-Path)
كل بيانات قد تكون شخصية أو عائلية حسب `householdId`:
```
users/{uid}/...        ← شخصي
households/{hhId}/...   ← مشترك (عائلة)
```
- كل دالة في `services/firestore.ts` تقبل `householdId?` لتقرّر المسار.
- `getUserSettings` يدمج: المشترك (ميزانية/فئات/دخل) + الشخصي (نبرة/إشعارات/عملة).
- `_moveSubcollection` (انسخ ثم احذف) = قلب الانضمام/المغادرة، يمنع فقدان البيانات.
- كل مستند يحفظ `uid` منشئه (ضروري لاسترجاع البيانات عند مغادرة العائلة).

## إدارة الحالة
- React Query: `staleTime:5د` · `gcTime:30د` · `refetchOnWindowFocus:false` · `retry:1`.
- `AppDataProvider` (`hooks/use-app-data.tsx`) يجمع كل شيء في context واحد.
- ⚠️ queryKey المصاريف بالضبط: `['expenses', uid, householdId, 'recent']` — أماكن أخرى تعتمد عليه.
- المصاريف تُحمَّل لآخر **6 أشهر فقط** (أداء). لكامل المصاريف استخدم `getExpenses` مباشرة (كما في شاشة expenses).
- ترتيب المزوّدين: `Theme → Query → Auth → SwUpdater` (`components/providers.tsx`).

## المسارات (14 شاشة)
**محمية (10):** `/` · expenses · stats · report · planner · receipts · achievements · settings · add-expense · tools/* — الحماية في `(main)/layout.tsx`.
**عامة (4):** landing · login · signup · privacy.
**شريط سفلي (5):** الرئيسية · المصاريف · الإحصائيات · الأدوات · الأهداف (`components/layout/page-navigation.tsx`).

## الأدوات السبع (`src/app/(main)/tools/`)
| الأداة | التخزين |
|---|---|
| currency (تحويل عملات + سعر سوق عراقي) | API + LocalStorage |
| debts (دفتر ديون) | Firestore |
| habit-cost (تكلفة العادات) | محلي |
| installment (أقساطي — يدعم القروض السابقة) | Firestore |
| silftna (جمعية دوّارة) | Firestore + Storage |
| wedding (حاسبة زواج) | Firestore |
| worth-it (هل يستحق؟) | محلي |

منطق الحساب: `lib/tools-calc.ts` · `lib/silftna.ts` · `lib/billing-utils.ts` · أسعار الصرف: `hooks/use-exchange-rates.ts`.

## طبقة الذكاء (9 تدفقات في `src/ai/flows/` · 10 APIs في `src/app/api/`)
استخراج إيصال · اتجاهات شهرية · أنماط إنفاق · محادثة (مستشار الجيب) · مدرب · مخطط · تسجيل نصي · تسجيل صوتي · ملخص إحصائي (**هذا بلا AI — حساب نقي بـ date-fns**).
- كلها `gemini-2.5-flash` (`ai/genkit.ts`)، `maxDuration:60`.
- الأخطاء تُرجع `status 200` مع `{ok:false, error}` (للتوافقية).
- `thinkingBudget:0` في الكل ما عدا التسجيل الصوتي (512).
- إشعارات: subscribe/send/month-end عبر web-push + VAPID + CRON_SECRET.

## أنظمة مساعدة
- **أوسمة (8، `lib/badges.ts`):** first_expense · week_logger · zero_day · family_leader · month_saver · big_saver · social_pro · report_viewer.
- **إشعارات ذكية (5، `hooks/use-smart-notifications.tsx`):** تذكير يومي · ملخص شهري · تنبيه ميزانية 90% · تذكير فواتير · سلسلة صفرية. منع التكرار عبر localStorage.
- **توطين عراقي (`lib/arabic-date.ts`):** كانون/شباط/آذار... + 12 فئة افتراضية (`lib/constants.ts`).
- معالجة صارمة UTC vs محلي في السلاسل (`use-logging-streak` · `use-zero-streak`).
- كشف التكرار المركزي: `lib/duplicate-check.ts`. تحويل صوت→WAV: `lib/audio-to-wav.ts`.

## أوامر التطوير
`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run genkit:dev`.

## نقاط تستحق الانتباه (وقت الكتابة 2026-06-25)
- `public/worker-360c95188cebdce7.js` غير متتبَّع في git — SW قديم متبقٍّ.
- `public/og-image.png` ≈ 1.6 ميغا (كبير).
- `public/white logo.png` فيه مسافة في الاسم.
- `pptxgenjs` و`xlsx` مثبّتتان لكن غير مستخدمتين في الأدوات السبع (تصدير محتمل).

## قواعد مقفلة (لا تعدّلها إلا بطلب صريح)
أدوات: currency · worth-it · installment · habit-cost — نسخ نهائية مقفلة. راجع ملفات الذاكرة قبل المساس بها.
