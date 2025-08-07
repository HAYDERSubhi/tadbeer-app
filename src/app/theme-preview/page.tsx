
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Home, Palette, DollarSign, CreditCard, AlertTriangle, CheckCircle } from "lucide-react";
import './theme.css';

export default function ThemePreviewPage() {
  return (
    <div className="theme-preview-container p-4 sm:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground">معاينة ثيم "النعناع الأخضر"</h1>
        <p className="text-muted-foreground mt-2 text-lg">هذه معاينة لكيف ستبدو المكونات الرئيسية في التطبيق بالهوية البصرية الجديدة.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Column 1: Cards & Basic Elements */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Home className="text-primary"/> بطاقة رئيسية</CardTitle>
              <CardDescription>هذا هو الشكل الجديد للبطاقات. لاحظ الظل الناعم وعدم وجود حدود.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>هذا نص عادي داخل البطاقة لاختبار إمكانية القراءة والتباين.</p>
              <div className="flex items-center space-x-2 space-x-reverse">
                <Label htmlFor="theme-switch">مفتاح تبديل</Label>
                <Switch id="theme-switch" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">زر أساسي</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>المدخلات والنماذج</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">الإسم</Label>
                <Input id="name" placeholder="أدخل اسمك..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">الفئة</Label>
                <Select>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="اختر فئة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="food">طعام</SelectItem>
                    <SelectItem value="transport">مواصلات</SelectItem>
                    <SelectItem value="bills">فواتير</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Buttons & Indicators */}
        <div className="space-y-8">
           <Card>
            <CardHeader>
                <CardTitle>الأزرار</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col items-start">
                <Button>أساسي (Primary)</Button>
                <Button variant="secondary">ثانوي (Secondary)</Button>
                <Button variant="outline">مخطط (Outline)</Button>
                <Button variant="destructive">حذف (Destructive)</Button>
                <Button variant="ghost">شبح (Ghost)</Button>
                <Button variant="link">رابط (Link)</Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>المؤشرات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>شريط التقدم</Label>
                    <Progress value={60} />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge>شارة أساسية</Badge>
                    <Badge variant="secondary">شارة ثانوية</Badge>
                    <Badge variant="destructive">شارة حذف</Badge>
                    <Badge variant="outline">شارة مخططة</Badge>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Complex Components & Colors */}
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>لوحة الألوان</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground"><Palette /></div>
                        <div>
                            <p className="font-bold">Primary (الأساسي)</p>
                            <p className="text-sm text-muted-foreground">اللون الأخضر الزمردي للثقة والاستقرار.</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground"><CreditCard /></div>
                        <div>
                            <p className="font-bold">Accent (التمييز)</p>
                            <p className="text-sm text-muted-foreground">لون النعناع الفاتح للتفاعلات.</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center text-foreground"><DollarSign /></div>
                        <div>
                            <p className="font-bold">Background (الخلفية)</p>
                            <p className="text-sm text-muted-foreground">لون الخلفية الرئيسي للتطبيق.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
           
             <Card>
                <CardHeader>
                    <CardTitle>تنبيهات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="p-4 rounded-lg bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5"/>
                        <div>
                            <h4 className="font-bold">نجاح</h4>
                            <p className="text-sm">هذا هو شكل رسائل النجاح.</p>
                        </div>
                     </div>
                     <div className="p-4 rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20 flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5"/>
                         <div>
                            <h4 className="font-bold">خطأ</h4>
                            <p className="text-sm">هذا هو شكل رسائل الخطأ والتحذير.</p>
                        </div>
                     </div>
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}
