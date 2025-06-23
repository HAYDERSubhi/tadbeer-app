
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTheme } from 'next-themes';
import { PaletteIcon, SlidersHorizontalIcon, ListTreeIcon, CreditCardIcon, DatabaseZapIcon, InfoIcon, Moon, Sun, SaveIcon, LinkIcon } from "lucide-react";
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
import { CATEGORIES } from '@/lib/constants';

interface UserBudgetSettings {
  totalBudget: number;
  weeklyBudget: number;
}

const COLUMN_MAP_CONFIG = {
  title: { label: 'اسم التاجر', alternatives: ['اسم التاجر', 'merchant name', 'title'] },
  amount: { label: 'المبلغ', alternatives: ['المبلغ', 'amount', 'price', 'total'] },
  category: { label: 'الفئة', alternatives: ['الفئة', 'category'] },
  date: { label: 'التاريخ', alternatives: ['التاريخ', 'date'] },
  description: { label: 'الوصف', alternatives: ['الوصف', 'description', 'ملاحظات', 'notes'] },
  isOutOfBudget: { label: 'خارج الميزانية', alternatives: ['خارج الميزانية', 'is out of budget'] },
  outOfBudgetDetails: { label: 'تفاصيل خارج الميزانية', alternatives: ['تفاصيل خارج الميزانية', 'out of budget details']},
};

const REQUIRED_FIELDS: (keyof typeof COLUMN_MAP_CONFIG)[] = ['title', 'amount'];
const LOCAL_STORAGE_MAP_KEY = 'userColumnMap';


export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [totalBudgetInput, setTotalBudgetInput] = useState<string>("");
  const [weeklyBudgetInput, setWeeklyBudgetInput] = useState<string>("");
  
  const [isMappingColumns, setIsMappingColumns] = useState(false);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({}); // Maps field -> header name
  const [parsedDataCache, setParsedDataCache] = useState<any[][]>([]);


  useEffect(() => {
    setMounted(true);
    const storedBudget = localStorage.getItem('userBudgetSettings');
    if (storedBudget) {
      const budgetData = JSON.parse(storedBudget) as UserBudgetSettings;
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
      toast({
        title: "خطأ في الإدخال",
        description: "الرجاء إدخال أرقام موجبة وصحيحة للميزانية.",
        variant: "destructive",
      });
      return;
    }

    const newBudgetSettings: UserBudgetSettings = { totalBudget: total, weeklyBudget: weekly };
    localStorage.setItem('userBudgetSettings', JSON.stringify(newBudgetSettings));
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
      toast({ title: "لا توجد بيانات", description: "ليس لديك أي مصاريف مسجلة لتصديرها.", variant: "destructive" });
      return;
    }

    let expenses: Expense[];
    try {
      expenses = JSON.parse(expensesJSON);
    } catch {
      expenses = [];
    }
    
    const dataToExport = expenses.map((exp) => ({
      'اسم التاجر': exp.title,
      'المبلغ': exp.amount,
      'العملة': 'د.ع',
      'الفئة': CATEGORIES[exp.category as keyof typeof CATEGORIES]?.name || exp.category,
      'التاريخ': new Date(exp.date),
      'الوصف': exp.description || '',
      'طريقة الدفع': '',
      'ملاحظات': '',
      'رابط صورة الفاتورة': '',
      'خارج الميزانية': exp.isOutOfBudget ? 'نعم' : 'لا',
      'تفاصيل خارج الميزانية': exp.outOfBudgetDetails || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "المصاريف");
    
    worksheet['!cols'] = [
        { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 20 },
        { wch: 40 }, { wch: 15 }, { wch: 40 }, { wch: 30 }, { wch: 15 }, { wch: 40 },
    ];

    XLSX.writeFile(workbook, "qicard-expenses.xlsx");
    toast({ title: "تم التصدير بنجاح", description: "تم تصدير بيانات مصاريفك إلى ملف Excel." });
  };

  const handleImportClick = () => {
    setIsMappingColumns(false);
    setColumnMap({});
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
        
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        if (rows.length < 1) throw new Error("الملف فارغ أو لا يحتوي على بيانات.");

        const headers: string[] = rows[0].map(h => String(h || '').trim());
        const dataRows = rows.slice(1);

        setFileHeaders(headers);
        setParsedDataCache(dataRows);

        const savedMap = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MAP_KEY) || '{}');
        const autoMap: Record<string, string> = {};
        
        for (const [field, config] of Object.entries(COLUMN_MAP_CONFIG)) {
          const lowerCaseHeaders = headers.map(h => h.toLowerCase());
          
          if (savedMap[field] && lowerCaseHeaders.includes(savedMap[field].toLowerCase())) {
             autoMap[field] = savedMap[field];
             continue;
          }
          
          const foundHeader = headers.find(h => config.alternatives.map(a => a.toLowerCase()).includes(h.toLowerCase()));
          if (foundHeader) {
            autoMap[field] = foundHeader;
          }
        }
        
        setColumnMap(autoMap);
        setIsMappingColumns(true);
        toast({
          title: "يرجى تأكيد ربط الأعمدة",
          description: "لقد قمنا بالتعرف على بعض الأعمدة تلقائيًا. يرجى مراجعتها وتأكيدها.",
        });

      } catch (error: any) {
        console.error("Failed to parse file:", error);
        toast({ title: "فشل الاستيراد", description: error.message || "حدث خطأ أثناء قراءة الملف.", variant: "destructive" });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const processAndSaveExpenses = (dataRows: any[][], finalMap: Record<string, string>, headers: string[]) => {
      // Step 1: Create a lookup map from header name (lowercase, trimmed) to its original index.
      const headerNameToIndexMap = new Map<string, number>();
      headers.forEach((header, index) => {
          if (typeof header === 'string') {
              headerNameToIndexMap.set(header.toLowerCase().trim(), index);
          }
      });
      
      // Step 2: Create a reverse map for category names (e.g., 'طعام' -> 'food')
      const categoryNameToIdMap = new Map<string, string>();
      Object.values(CATEGORIES).forEach(cat => {
          categoryNameToIdMap.set(cat.name.toLowerCase(), cat.id);
      });

      const newExpenses: Expense[] = [];

      dataRows.forEach((row) => {
        // Skip empty rows
        if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
            return;
        }

        // Helper function to get value from a row using the app field name (e.g., 'title')
        const getCellData = (fieldName: keyof typeof COLUMN_MAP_CONFIG): any => {
            const mappedHeaderName = finalMap[fieldName];
            if (!mappedHeaderName || mappedHeaderName === '_EMPTY_') return null;

            const headerIndex = headerNameToIndexMap.get(mappedHeaderName.toLowerCase().trim());
            if (headerIndex === undefined) return null;

            return row[headerIndex];
        };

        // Step 3: Extract and process data for each field
        let title = String(getCellData('title') || '').trim();
        if (!title) {
          title = 'مصروف مستورد بدون عنوان';
        }

        const rawAmount = getCellData('amount');
        let amount = 0;
        if (rawAmount !== null && rawAmount !== undefined) {
             const parsed = parseFloat(String(rawAmount).replace(/[^0-9.-]+/g,""));
             if (!isNaN(parsed)) {
                 amount = parsed;
             }
        }

        const rawCategoryName = String(getCellData('category') || '').toLowerCase().trim();
        let category = categoryNameToIdMap.get(rawCategoryName) || 'other';

        const rawDate = getCellData('date');
        let date = new Date().toISOString();
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
          date = rawDate.toISOString();
        } else if (typeof rawDate === 'string' && rawDate) {
          const parsedDate = new Date(rawDate);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate.toISOString();
          }
        }

        const description = String(getCellData('description') || '');
        
        const rawIsOutOfBudget = getCellData('isOutOfBudget');
        const isOutOfBudget = ['نعم', 'yes', 'true', true, '1', 1].includes(String(rawIsOutOfBudget || '').trim().toLowerCase());

        const outOfBudgetDetails = String(getCellData('outOfBudgetDetails') || '');

        // Step 4: Assemble the new expense object
        const newExp: Expense = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          title: title,
          amount: amount,
          category: category,
          date: date,
          description: description || undefined,
          isOutOfBudget: isOutOfBudget,
          outOfBudgetDetails: outOfBudgetDetails || undefined,
        };
        
        newExpenses.push(newExp);
      });
      
      // Step 5: Save to localStorage
      let existingExpenses: Expense[] = [];
      try {
          const storedExpenses = localStorage.getItem('expenses');
          if (storedExpenses) {
              const parsed = JSON.parse(storedExpenses);
              if (Array.isArray(parsed)) {
                  existingExpenses = parsed;
              }
          }
      } catch (e) {
          console.error("Could not parse existing expenses from localStorage, overwriting.", e);
          toast({
            title: "تحذير",
            description: "تم العثور على بيانات تالفة، سيتم الكتابة فوقها.",
            variant: "destructive"
          });
      }
      
      const combinedExpenses = [...existingExpenses, ...newExpenses];
      localStorage.setItem('expenses', JSON.stringify(combinedExpenses));
      window.dispatchEvent(new CustomEvent('expensesUpdated'));
      localStorage.setItem(LOCAL_STORAGE_MAP_KEY, JSON.stringify(finalMap));
      
      toast({
        title: "اكتمل الاستيراد",
        description: `تم استيراد ${newExpenses.length} مصروف بنجاح.`,
      });

      setIsMappingColumns(false);
  };


  const handleConfirmMapping = () => {
    const missingRequired = REQUIRED_FIELDS.filter(field => !columnMap[field] || columnMap[field] === '_EMPTY_');
    if (missingRequired.length > 0) {
        toast({
            title: "حقول مطلوبة مفقودة",
            description: `يرجى ربط الحقول التالية: ${missingRequired.map(f => COLUMN_MAP_CONFIG[f as keyof typeof COLUMN_MAP_CONFIG].label).join(', ')}`,
            variant: "destructive",
        });
        return;
    }
    processAndSaveExpenses(parsedDataCache, columnMap, fileHeaders);
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
            <Input id="totalBudget" type="number" value={totalBudgetInput} onChange={(e) => setTotalBudgetInput(e.target.value)} placeholder="مثال: 5000000" min="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weeklyBudget">الميزانية الأسبوعية المتوقعة (د.ع)</Label>
            <Input id="weeklyBudget" type="number" value={weeklyBudgetInput} onChange={(e) => setWeeklyBudgetInput(e.target.value)} placeholder="مثال: 1000000" min="0" />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveBudget} className="w-full">
            <SaveIcon className="ml-2 h-4 w-4" />
            حفظ إعدادات الميزانية
          </Button>
        </CardFooter>
      </Card>
      
      {isMappingColumns && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-6 w-6 text-primary" />
                ربط أعمدة الملف
            </CardTitle>
            <CardDescription>
                الرجاء اختيار العمود الصحيح من ملفك لكل حقل. سيتم حفظ هذا الربط للاستيرادات المستقبلية.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(COLUMN_MAP_CONFIG).map(([field, config]) => (
                 <div key={field} className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor={`map-${field}`} className="text-right">
                        {config.label} {REQUIRED_FIELDS.includes(field as any) && <span className="text-destructive">*</span>}
                    </Label>
                    <Select
                        value={columnMap[field] || '_EMPTY_'}
                        onValueChange={(value) => setColumnMap(prev => ({...prev, [field]: value === '_EMPTY_' ? '' : value}))}
                    >
                        <SelectTrigger id={`map-${field}`} className="col-span-2">
                            <SelectValue placeholder="اختر عمودًا..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_EMPTY_">-- لا يوجد --</SelectItem>
                            {fileHeaders.map((header, index) => (
                                <SelectItem key={`${header}-${index}`} value={header}>{header}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
            ))}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsMappingColumns(false)}>إلغاء</Button>
              <Button onClick={handleConfirmMapping}>تأكيد و استيراد البيانات</Button>
          </CardFooter>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZapIcon className="h-6 w-6 text-primary" />
            البيانات والتصنيفات
          </CardTitle>
           <CardDescription>تصدير بيانات المصاريف إلى ملف Excel أو استيرادها منه. وإدارة التصنيفات.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button className="w-full" variant="outline" onClick={handleExport}>تصدير البيانات (Excel)</Button>
            <Button className="w-full" variant="outline" onClick={handleImportClick}>استيراد البيانات (Excel)</Button>
            <Input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
            <div className="sm:col-span-2 p-4 text-center text-muted-foreground border rounded-lg">
                سيتم إضافة إدارة التصنيفات هنا قريباً.
            </div>
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

    