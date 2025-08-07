
"use client"

import * as React from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Palette,
    AlertTriangle,
    Terminal,
    Rocket,
} from "lucide-react"

const colors = [
  { name: 'Primary', var: 'hsl(var(--primary))', text: 'hsl(var(--primary-foreground))' },
  { name: 'Secondary', var: 'hsl(var(--secondary))', text: 'hsl(var(--secondary-foreground))' },
  { name: 'Destructive', var: 'hsl(var(--destructive))', text: 'hsl(var(--destructive-foreground))' },
  { name: 'Muted', var: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' },
  { name: 'Accent', var: 'hsl(var(--accent))', text: 'hsl(var(--accent-foreground))' },
  { name: 'Background', var: 'hsl(var(--background))', text: 'hsl(var(--foreground))' },
  { name: 'Card', var: 'hsl(var(--card))', text: 'hsl(var(--card-foreground))' },
  { name: 'Popover', var: 'hsl(var(--popover))', text: 'hsl(var(--popover-foreground))' },
  { name: 'Border', var: 'hsl(var(--border))' },
  { name: 'Input', var: 'hsl(var(--input))' },
  { name: 'Ring', var: 'hsl(var(--ring))' },
]

export default function PreviewPage() {
  const [progress, setProgress] = React.useState(13)
  const [sliderValue, setSliderValue] = React.useState([50])

  React.useEffect(() => {
    const timer = setTimeout(() => setProgress(66), 500)
    return () => clearTimeout(timer)
  }, [])
  
  return (
    <div className="container mx-auto p-4 sm:p-8 space-y-8" dir="rtl">
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight">معاينة واجهة المستخدم</h1>
        <p className="text-muted-foreground text-lg">
          صفحة شاملة لاختبار ومعاينة جميع مكونات واجهة المستخدم في تطبيق تدبير.
        </p>
      </header>
      
      <Separator />

      {/* Colors Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Palette /> نظام الألوان</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {colors.map(color => (
            <div key={color.name} className="flex flex-col items-center">
              <div 
                className="w-full h-20 rounded-lg flex items-center justify-center border"
                style={{ backgroundColor: color.var, color: color.text }}
              >
                <span className="font-bold">Aa</span>
              </div>
              <span className="text-sm font-medium mt-2">{color.name}</span>
            </div>
          ))}
        </div>
      </section>
      
      <Separator />

      {/* Typography Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">الخطوط والأحجام</h2>
        <div className="space-y-4">
          <h1>h1. هذا عنوان من المستوى الأول</h1>
          <h2>h2. هذا عنوان من المستوى الثاني</h2>
          <h3>h3. هذا عنوان من المستوى الثالث</h3>
          <h4>h4. هذا عنوان من المستوى الرابع</h4>
          <h5>h5. هذا عنوان من المستوى الخامس</h5>
          <h6>h6. هذا عنوان من المستوى السادس</h6>
          <p className="text-lg">p.text-lg. هذا نص كبير للقراءة المريحة.</p>
          <p>p. هذا هو النص الأساسي للتطبيق، يستخدم في معظم الفقرات.</p>
          <p className="text-sm text-muted-foreground">p.text-sm.muted. هذا نص أصغر للملاحظات والمعلومات الثانوية.</p>
          <blockquote className="mt-6 border-r-4 border-primary pr-4 italic">
            "هذا اقتباس. يستخدم لإبراز نص معين أو شهادة."
          </blockquote>
        </div>
      </section>

      <Separator />

      {/* Buttons Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">الأزرار</h2>
        <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
                <Button>الافتراضي (Default)</Button>
                <Button variant="secondary">الثانوي (Secondary)</Button>
                <Button variant="destructive">التدميري (Destructive)</Button>
                <Button variant="outline">المخطط (Outline)</Button>
                <Button variant="ghost">الشبح (Ghost)</Button>
                <Button variant="link">الرابط (Link)</Button>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
                <Button size="lg">زر كبير</Button>
                <Button>زر عادي</Button>
                <Button size="sm">زر صغير</Button>
                <Button size="icon"><Rocket /></Button>
            </div>
             <div className="flex flex-wrap gap-4 items-center">
                <Button disabled>معطل (Default)</Button>
                <Button variant="secondary" disabled>معطل (Secondary)</Button>
                <Button variant="destructive" disabled>معطل (Destructive)</Button>
                <Button variant="outline" disabled>معطل (Outline)</Button>
                <Button variant="ghost" disabled>معطل (Ghost)</Button>
                <Button variant="link" disabled>معطل (Link)</Button>
            </div>
        </div>
      </section>
      
      <Separator />
      
      {/* Cards Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">البطاقات (Cards)</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>عنوان البطاقة</CardTitle>
                    <CardDescription>وصف قصير وموجز لمحتوى هذه البطاقة.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>هذا هو المحتوى الرئيسي للبطاقة. يمكن أن يحتوي على أي نوع من المعلومات التي تريد عرضها للمستخدم.</p>
                </CardContent>
                <CardFooter>
                    <Button className="w-full">زر الإجراء</Button>
                </CardFooter>
            </Card>
             <Card className="border-primary ring-2 ring-primary">
                <CardHeader>
                    <CardTitle>بطاقة محددة (Selected)</CardTitle>
                    <CardDescription>هذه البطاقة تمثل حالة الاختيار أو التركيز.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>المحتوى يبقى كما هو لكن التصميم يبرز البطاقة عن غيرها.</p>
                </CardContent>
                 <CardFooter>
                    <Button variant="outline" className="w-full">إجراء ثانوي</Button>
                </CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>بطاقة مع Skeleton</CardTitle>
                    <CardDescription>تستخدم عند تحميل البيانات.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-8 w-full" />
                </CardContent>
                 <CardFooter>
                    <Skeleton className="h-10 w-full" />
                </CardFooter>
            </Card>
        </div>
      </section>

      <Separator />
      
      {/* Forms Section */}
       <section>
        <h2 className="text-2xl font-bold mb-4">حقول الإدخال (Forms)</h2>
        <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">الاسم</Label>
                    <Input id="name" placeholder="ادخل اسمك..." />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني (خطأ)</Label>
                    <Input id="email" defaultValue="email@invalid" className="border-destructive focus-visible:ring-destructive" />
                    <p className="text-sm text-destructive">الرجاء إدخال بريد إلكتروني صالح.</p>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="message">رسالتك</Label>
                    <Textarea placeholder="اكتب رسالتك هنا." id="message" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="category-select">الفئة</Label>
                     <Select>
                        <SelectTrigger id="category-select">
                            <SelectValue placeholder="اختر فئة..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="food">طعام وشراب</SelectItem>
                            <SelectItem value="transport">مواصلات</SelectItem>
                            <SelectItem value="shopping">تسوق</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-6">
                 <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox id="terms" />
                    <Label htmlFor="terms">أوافق على الشروط والأحكام</Label>
                </div>
                <RadioGroup defaultValue="comfortable">
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="default" id="r1" />
                        <Label htmlFor="r1">الافتراضي</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="comfortable" id="r2" />
                        <Label htmlFor="r2">المريح</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="compact" id="r3" />
                        <Label htmlFor="r3">المدمج</Label>
                    </div>
                </RadioGroup>
                 <div className="flex items-center space-x-2 space-x-reverse">
                    <Switch id="airplane-mode" />
                    <Label htmlFor="airplane-mode">وضع الطيران</Label>
                </div>
                 <div className="space-y-3">
                    <Label htmlFor="slider-value">المستوى: {sliderValue[0]}</Label>
                    <Slider id="slider-value" defaultValue={sliderValue} onValueChange={setSliderValue} max={100} step={1} />
                </div>
            </div>
        </div>
       </section>

       <Separator />
       
       {/* Other Components Section */}
       <section>
        <h2 className="text-2xl font-bold mb-4">مكونات متنوعة</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Alerts */}
            <div className="space-y-4">
                <h3 className="font-semibold">تنبيهات (Alerts)</h3>
                <Alert>
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>معلومة!</AlertTitle>
                  <AlertDescription>
                    هذا تنبيه عادي لإعلام المستخدم بشيء ما.
                  </AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>خطأ!</AlertTitle>
                  <AlertDescription>
                    هذا تنبيه خطير لجذب انتباه المستخدم لمشكلة.
                  </AlertDescription>
                </Alert>
            </div>
            
            {/* Badges, Progress, Tooltip */}
            <div className="space-y-6">
                <div className="space-y-2">
                    <h3 className="font-semibold">شارات (Badges)</h3>
                    <div className="flex flex-wrap gap-2">
                       <Badge>افتراضي</Badge>
                       <Badge variant="secondary">ثانوي</Badge>
                       <Badge variant="destructive">خطير</Badge>
                       <Badge variant="outline">مخطط</Badge>
                    </div>
                </div>
                 <div className="space-y-2">
                    <h3 className="font-semibold">شريط التقدم (Progress)</h3>
                    <Progress value={progress} className="w-[80%]" />
                </div>
                <div className="space-y-2">
                     <h3 className="font-semibold">تلميح (Tooltip)</h3>
                     <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline">مرر الماوس فوقي</Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>هذا هو التلميح الذي يظهر!</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* Accordion and Tabs */}
            <div className="space-y-4">
                <Tabs defaultValue="account" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="account">الحساب</TabsTrigger>
                    <TabsTrigger value="password">كلمة المرور</TabsTrigger>
                  </TabsList>
                  <TabsContent value="account">
                    <Card>
                      <CardHeader><CardTitle>الحساب</CardTitle><CardDescription>غير إعدادات حسابك هنا.</CardDescription></CardHeader>
                      <CardContent className="space-y-2"><div className="space-y-1"><Label htmlFor="name-tab">الاسم</Label><Input id="name-tab" defaultValue="Pedro Duarte" /></div><div className="space-y-1"><Label htmlFor="username-tab">اسم المستخدم</Label><Input id="username-tab" defaultValue="@peduarte" /></div></CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="password">
                     <Card>
                      <CardHeader><CardTitle>كلمة المرور</CardTitle><CardDescription>غير كلمة المرور الخاصة بك هنا.</CardDescription></CardHeader>
                      <CardContent className="space-y-2"><div className="space-y-1"><Label htmlFor="current">الكلمة الحالية</Label><Input id="current" type="password" /></div><div className="space-y-1"><Label htmlFor="new">الكلمة الجديدة</Label><Input id="new" type="password" /></div></CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>هل هو متاح؟</AccordionTrigger>
                        <AccordionContent>
                        نعم. يلتزم بجميع معايير التصميم الحديثة.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger>هل هو مصمم بشكل جيد؟</AccordionTrigger>
                        <AccordionContent>
                        نعم. يأتي افتراضيًا مع تصميم جميل يتوافق مع رؤيتك.
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
            
            {/* Dialogs and Sheets */}
            <div className="space-y-4">
                 <h3 className="font-semibold">النوافذ المنبثقة (Dialogs)</h3>
                <div className="flex flex-wrap gap-4">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline">افتح Dialog</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                            <DialogTitle>تعديل الملف الشخصي</DialogTitle>
                            <DialogDescription>
                                قم بإجراء التغييرات على ملفك الشخصي هنا. انقر فوق حفظ عند الانتهاء.
                            </DialogDescription>
                            </DialogHeader>
                        </DialogContent>
                    </Dialog>
                     <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline">افتح Sheet</Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                            <SheetTitle>تعديل الملف الشخصي</SheetTitle>
                            <SheetDescription>
                                قم بإجراء التغييرات على ملفك الشخصي هنا. انقر فوق حفظ عند الانتهاء.
                            </SheetDescription>
                            </Header>
                        </SheetContent>
                    </Sheet>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">تنبيه حواري</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                            <AlertDialogDescription>
                                هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف بياناتك بشكل دائم.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction>متابعة</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

        </div>
       </section>

    </div>
  )
}

    