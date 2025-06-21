
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTheme } from 'next-themes';
import { PaletteIcon, SlidersHorizontalIcon, ListTreeIcon, CreditCardIcon, DatabaseZapIcon, InfoIcon, Moon, Sun, SaveIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Expense } from '@/types';
import * as XLSX from 'xlsx';

interface UserBudgetSettings {
  totalBudget: number;
  weeklyBudget: number;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [totalBudgetInput, setTotalBudgetInput] = useState<string>("");
  const [weeklyBudgetInput, setWeeklyBudgetInput] = useState<string>("");
  const [currentBudget, setCurrentBudget] = useState<UserBudgetSettings | null>(null);

  useEffect(() => {
    setMounted(true);
    const storedBudget = localStorage.getItem('userBudgetSettings');
    if (storedBudget) {
      const budgetData = JSON.parse(storedBudget) as UserBudgetSettings;
      setCurrentBudget(budgetData);
      setTotalBudgetInput(budgetData.totalBudget.toString());
      setWeeklyBudgetInput(budgetData.weeklyBudget.toString());
    } else {
      setTotalBudgetInput("0");
      setWeeklyBudgetInput("0");
    }
  }, []);

  const handleSaveBudget = () => {
    const totalString = totalBudgetInput.trim() === "" ? "0" : totalBudgetInput.trim();
    const weeklyString = weeklyBudgetInput.trim() === "" ? "0" : weeklyBudgetInput.trim();

    const total = parseFloat(totalString);
    const weekly = parseFloat(weeklyString);

    if (isNaN(total) || total < 0 || isNaN(weekly) || weekly < 0) {
      let errorDescription = "الرجاء إدخال أرقام موجبة وصحيحة للميزانية.";
      if ((isNaN(total) || total < 0) && (isNaN(weekly) || weekly < 0)) {
        errorDescription = "الرجاء إدخال قيم صحيحة للميزانية الشهرية والأسبوعية.";
      } else if (isNaN(total) || total < 0) {
        errorDescription = "الرجاء إدخال قيمة صحيحة للميزانية الشهرية.";
      } else if (isNaN(weekly) || weekly < 0) {
        errorDescription = "الرجاء إدخال قيمة صحيحة للميزانية الأسبوعية.";
      }

      toast({
        title: "خطأ في الإدخال",
        description: errorDescription,
        variant: "destructive",
      });
      return;
    }

    const newBudgetSettings: UserBudgetSettings = { totalBudget: total, weeklyBudget: weekly };
    localStorage.setItem('userBudgetSettings', JSON.stringify(newBudgetSettings));
    setCurrentBudget(newBudgetSettings);
    toast({
      title: "تم الحفظ",
      description: "تم حفظ إعدادات الميزانية بنجاح.",
    });
    window.dispatchEvent(new CustomEvent('budgetUpdated'));
  };

  const handleExport = () => {
    if (!mounted) return;

    const expensesJSON = localStorage.getItem('expenses');
    if (!expensesJSON || JSON.parse(expensesJSON).length === 0) {
      toast({
        title: "لا توجد بيانات",
        description: "ليس لديك أي مصاريف مسجلة لتصديرها.",
        variant: "destructive",
      });
      return;
    }

    const expenses: Expense[] = JSON.parse(expensesJSON);
    
    const dataToExport = expenses.map((exp) => ({
      'العنوان': exp.title,
      'المبلغ': exp.amount,
      'الفئة': exp.category,
      'التاريخ': new Date(exp.date),
      'الوصف': exp.description || '',
      'خارج الميزانية': exp.isOutOfBudget ? 'نعم' : 'لا',
      'تفاصيل خارج الميزانية': exp.outOfBudgetDetails || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "المصاريف");
    
    worksheet['!cols'] = [
        { wch: 30 }, // Title
        { wch: 15 }, // Amount
        { wch: 15 }, // Category
        { wch: 20 }, // Date
        { wch: 40 }, // Description
        { wch: 15 }, // Out of budget
        { wch: 40 }, // Out of budget details
    ];

    const dateColumn = 'D';
    for (let i = 2; i <= dataToExport.length + 1; i++) {
        const cellAddress = `${dateColumn}${i}`;
        if(worksheet[cellAddress]) {
            worksheet[cellAddress].t = 'd';
            worksheet[cellAddress].z = 'yyyy-mm-dd';
        }
    }


    XLSX.writeFile(workbook, "qicard-expenses.xlsx");

    toast({
      title: "تم التصدير بنجاح",
      description: "تم تصدير بيانات مصاريفك إلى ملف Excel.",
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!mounted) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          dateNF: 'yyyy-mm-dd',
          blankrows: false,
        });

        if (json.length === 0) {
          throw new Error("الملف فارغ أو لا يحتوي على بيانات.");
        }

        const fileHeaders = Object.keys(json[0]);

        const findHeader = (possibleNames: string[]): string | undefined => {
            for (const name of possibleNames) {
                const foundHeader = fileHeaders.find(h => h.trim().toLowerCase() === name.toLowerCase());
                if (foundHeader) return foundHeader;
            }
            return undefined;
        }

        const headerMap = {
            title: findHeader(['العنوان', 'title']),
            amount: findHeader(['المبلغ', 'amount']),
            category: findHeader(['الفئة', 'category']),
            date: findHeader(['التاريخ', 'date']),
            description: findHeader(['الوصف', 'description']),
            isOutOfBudget: findHeader(['خارج الميزانية', 'isoutofbudget', 'is out of budget']),
            outOfBudgetDetails: findHeader(['تفاصيل خارج الميزانية', 'out of budget details', 'outOfBudgetDetails'])
        };

        const missingHeaders: string[] = [];
        if (!headerMap.title) missingHeaders.push('العنوان');
        if (!headerMap.amount) missingHeaders.push('المبلغ');
        if (!headerMap.category) missingHeaders.push('الفئة');

        if (missingHeaders.length > 0) {
            throw new Error(`أعمدة مطلوبة مفقودة: ${missingHeaders.join(', ')}. تأكد من تطابق أسماء الأعمدة.`);
        }

        const validatedExpenses: Expense[] = json.map((row, index) => {
          const newExp: Partial<Expense> = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const title = row[headerMap.title!];
          const amount = row[headerMap.amount!];
          const category = row[headerMap.category!];

          if (title === undefined || String(title).trim() === '' || amount === undefined || String(amount).trim() === '') {
            throw new Error(`بيانات ناقصة في الصف رقم ${index + 2}. تأكد من وجود قيم في الأعمدة المطلوبة (العنوان، المبلغ).`);
          }

          newExp.title = String(title);
          
          const parsedAmount = parseFloat(String(amount).replace(/[^0-9.-]+/g,""));
          if (isNaN(parsedAmount)) {
              throw new Error(`قيمة "المبلغ" غير صالحة في الصف رقم ${index + 2}. يجب أن تكون رقماً.`);
          }
          newExp.amount = parsedAmount;

          newExp.category = String(category || 'other');

          const dateVal = headerMap.date ? row[headerMap.date] : new Date();
          if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
            newExp.date = dateVal.toISOString();
          } else if (typeof dateVal === 'string' && dateVal) {
            const parsedDate = new Date(dateVal);
            newExp.date = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
          } else {
            newExp.date = new Date().toISOString();
          }

          newExp.description = headerMap.description ? String(row[headerMap.description] || '') : undefined;
          
          const isOutOfBudgetVal = headerMap.isOutOfBudget ? row[headerMap.isOutOfBudget] : false;
          newExp.isOutOfBudget = ['نعم', 'yes', 'true', true, '1', 1].includes(String(isOutOfBudgetVal || '').trim().toLowerCase());
          
          newExp.outOfBudgetDetails = headerMap.outOfBudgetDetails ? String(row[headerMap.outOfBudgetDetails] || '') : undefined;

          return newExp as Expense;
        });

        localStorage.setItem('expenses', JSON.stringify(validatedExpenses));
        window.dispatchEvent(new CustomEvent('expensesUpdated'));
        
        toast({
          title: "تم الاستيراد بنجاح",
          description: `تم استيراد ${validatedExpenses.length} مصروف.`,
        });

      } catch (error: any) {
        console.error("Failed to import file:", error);
        toast({
          title: "فشل الاستيراد",
          description: error.message || "الملف غير صالح أو لا يتبع التنسيق الصحيح.",
          variant: "destructive",
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PaletteIcon className="h-6 w-6 text-primary" />
            تخصيص المظهر
          </CardTitle>
          <CardDescription>قم بتخصيص مظهر التطبيق ليناسب تفضيلاتك.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label htmlFor="theme-mode" className="flex items-center gap-2">
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              الوضع
            </Label>
            <Select value={theme} onValueChange={(value) => setTheme(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="اختر الوضع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">فاتح</SelectItem>
                <SelectItem value="dark">داكن</SelectItem>
                <SelectItem value="system">النظام</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label htmlFor="font-size">حجم الخط</Label>
            <Button variant="outline" disabled>متوسط (قريباً)</Button>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label htmlFor="currency-format">عرض المبالغ</Label>
            <Button variant="outline" disabled>مع فواصل (قريباً)</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontalIcon className="h-6 w-6 text-primary" />
            إعدادات الميزانية
          </CardTitle>
          <CardDescription>قم بتعيين ميزانيتك الشهرية والأسبوعية المتوقعة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="totalBudget">إجمالي الميزانية الشهرية (د.ع)</Label>
            <Input
              id="totalBudget"
              type="number"
              value={totalBudgetInput}
              onChange={(e) => setTotalBudgetInput(e.target.value)}
              placeholder="مثال: 5000000"
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weeklyBudget">الميزانية الأسبوعية المتوقعة (د.ع)</Label>
            <Input
              id="weeklyBudget"
              type="number"
              value={weeklyBudgetInput}
              onChange={(e) => setWeeklyBudgetInput(e.target.value)}
              placeholder="مثال: 1000000"
              min="0"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveBudget} className="w-full">
            <SaveIcon className="ml-2 h-4 w-4" />
            حفظ إعدادات الميزانية
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTreeIcon className="h-6 w-6 text-primary" />
            إدارة التصنيفات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">سيتم إضافة إدارة التصنيفات هنا قريباً.</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCardIcon className="h-6 w-6 text-primary" />
            إعدادات البطاقة الإلكترونية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">سيتم إضافة إعدادات البطاقة الإلكترونية هنا قريباً.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZapIcon className="h-6 w-6 text-primary" />
            الحفظ والاستيراد
          </CardTitle>
           <CardDescription>تصدير بيانات المصاريف إلى ملف Excel أو استيرادها منه.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={handleExport}>تصدير البيانات (Excel)</Button>
            <Button className="w-full" variant="outline" onClick={handleImportClick}>استيراد البيانات (Excel)</Button>
             <Input 
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls, .csv"
            />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InfoIcon className="h-6 w-6 text-primary" />
            معلومات التطبيق
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>إصدار التطبيق: 1.0.0</p>
          <p>جميع الحقوق محفوظة لشركة كي كارد © {new Date().getFullYear()}</p>
        </CardContent>
      </Card>

    </div>
  );
}

    