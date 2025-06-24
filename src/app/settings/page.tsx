
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTheme } from 'next-themes';
import { PaletteIcon, SlidersHorizontalIcon, DatabaseZapIcon, InfoIcon, Moon, Sun, SaveIcon, LinkIcon, Trash2Icon, FolderKanban, UserCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Expense, UserProfile } from '@/types';
import * as XLSX from 'xlsx';
import { CATEGORIES } from '@/lib/constants';

interface UserBudgetSettings {
  totalBudget: number;
  weeklyBudget: number;
  zeroSpendDaysTarget: number;
}

const COLUMN_MAP_CONFIG = {
  title: { label: 'اسم التاجر' },
  amount: { label: 'المبلغ' },
  category: { label: 'الفئة' },
  date: { label: 'التاريخ' },
  description: { label: 'الوصف' },
  isOutOfBudget: { label: 'خارج الميزانية' },
  outOfBudgetDetails: { label: 'تفاصيل خارج الميزانية' },
};


const REQUIRED_FIELDS: (keyof typeof COLUMN_MAP_CONFIG)[] = ['amount'];
// Changed key to prevent conflicts with old string-based map format
const LOCAL_STORAGE_MAP_KEY = 'userColumnMap_v2_indexBased'; 

// Helper function to get Excel-like column names (A, B, C, ...)
const getColumnName = (colIndex: number): string => {
  let name = '';
  let dividend = colIndex + 1;
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - 1) / 26);
  }
  return name;
};


export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [totalBudgetInput, setTotalBudgetInput] = useState<string>("");
  const [weeklyBudgetInput, setWeeklyBudgetInput] = useState<string>("");
  const [zeroSpendDaysTargetInput, setZeroSpendDaysTargetInput] = useState<string>("");
  
  const [isMappingColumns, setIsMappingColumns] = useState(false);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  // NEW: columnMap now stores field -> column INDEX
  const [columnMap, setColumnMap] = useState<Record<string, number | null>>({});
  const [parsedDataCache, setParsedDataCache] = useState<any[][]>([]);

  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});
  const [userProfile, setUserProfile] = useState<Partial<UserProfile>>({});

  // Helper functions for number formatting
  const formatNumberWithCommas = (value: string | number | undefined) => {
    if (value === null || value === undefined || value === '') return '';
    const numericString = String(value).replace(/,/g, '');
    const number = Number(numericString);
    if (isNaN(number)) return '';
    if (number === 0) return '0';
    return new Intl.NumberFormat('en-US').format(number);
  };

  const parseFormattedNumber = (value: string | undefined) => {
    if (!value) return '';
    return value.replace(/,/g, '');
  };

  const handleNumericInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericString = parseFormattedNumber(rawValue);

    // Only allow numbers
    if (numericString !== '' && isNaN(Number(numericString))) {
        return;
    }
    setter(formatNumberWithCommas(numericString));
  };
  
  const handleCategoryBudgetChange = (id: string, value: string) => {
    const numericString = parseFormattedNumber(value);
    if (numericString !== '' && isNaN(Number(numericString))) {
        return;
    }
    setCategoryBudgets(prev => ({...prev, [id]: formatNumberWithCommas(numericString)}));
  }

  useEffect(() => {
    setMounted(true);
    // Load general budget settings
    const storedBudget = localStorage.getItem('userBudgetSettings');
    if (storedBudget) {
      try {
        const budgetData = JSON.parse(storedBudget) as UserBudgetSettings;
        setTotalBudgetInput(formatNumberWithCommas(budgetData.totalBudget));
        setWeeklyBudgetInput(formatNumberWithCommas(budgetData.weeklyBudget));
        setZeroSpendDaysTargetInput(budgetData.zeroSpendDaysTarget?.toString() || '4');
      } catch {
        // handle error
      }
    }

    // Load category budgets
    const storedCategoryBudgets = localStorage.getItem('categoryBudgets');
    if (storedCategoryBudgets) {
        try {
            const budgets = JSON.parse(storedCategoryBudgets);
            // Convert numbers to strings for input fields
            const stringBudgets = Object.entries(budgets).reduce((acc, [key, value]) => {
                acc[key] = formatNumberWithCommas(value as number);
                return acc;
            }, {} as Record<string, string>);
            setCategoryBudgets(stringBudgets);
        } catch {
            // handle error
        }
    }
    
     // Load user profile
    const storedUserProfile = localStorage.getItem('userProfile');
    if (storedUserProfile) {
      try {
        setUserProfile(JSON.parse(storedUserProfile));
      } catch {
        // handle error
      }
    }

  }, []);
  
  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    setUserProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = () => {
    // Basic validation
    const income = parseFloat(parseFormattedNumber(userProfile.monthlyIncome?.toString()));
    const familySize = parseInt(userProfile.familySize?.toString() || "0", 10);
    
    if (isNaN(income) || income < 0 || isNaN(familySize) || familySize < 0) {
       toast({
        title: "خطأ في الإدخال",
        description: "الرجاء إدخال أرقام صحيحة وموجبة للملف الشخصي.",
        variant: "destructive",
      });
      return;
    }
    
    const profileToSave: UserProfile = {
      monthlyIncome: income,
      familySize: familySize
    };

    localStorage.setItem('userProfile', JSON.stringify(profileToSave));
    toast({
      title: "تم الحفظ",
      description: "تم حفظ بيانات ملفك الشخصي بنجاح.",
    });
  };

  const handleSaveBudget = () => {
    const total = parseFloat(parseFormattedNumber(totalBudgetInput) || "0");
    const weekly = parseFloat(parseFormattedNumber(weeklyBudgetInput) || "0");
    const zeroSpendDays = parseInt(zeroSpendDaysTargetInput || "0", 10);

    if (isNaN(total) || total < 0 || isNaN(weekly) || weekly < 0 || isNaN(zeroSpendDays) || zeroSpendDays < 0) {
      toast({
        title: "خطأ في الإدخال",
        description: "الرجاء إدخال أرقام موجبة وصحيحة للميزانية والأهداف.",
        variant: "destructive",
      });
      return;
    }

    const newBudgetSettings: UserBudgetSettings = { 
        totalBudget: total, 
        weeklyBudget: weekly, 
        zeroSpendDaysTarget: zeroSpendDays 
    };
    localStorage.setItem('userBudgetSettings', JSON.stringify(newBudgetSettings));
    toast({
      title: "تم الحفظ",
      description: "تم حفظ إعدادات الميزانية بنجاح.",
    });
    window.dispatchEvent(new CustomEvent('budgetUpdated'));
  };

  const handleSaveCategoryBudgets = () => {
    const numericBudgets = Object.entries(categoryBudgets).reduce((acc, [key, value]) => {
        const amount = parseFloat(parseFormattedNumber(value));
        if (!isNaN(amount) && amount >= 0) {
            acc[key] = amount;
        }
        return acc;
    }, {} as Record<string, number>);

    localStorage.setItem('categoryBudgets', JSON.stringify(numericBudgets));
    toast({
      title: "تم الحفظ",
      description: "تم حفظ ميزانيات الفئات بنجاح.",
    });
    window.dispatchEvent(new CustomEvent('budgetUpdated'));
  };

  const handleExport = () => {
    if (!mounted) return;

    let expenses: Expense[] = [];
    try {
      const expensesJSON = localStorage.getItem('expenses');
      if (expensesJSON) {
          const parsed = JSON.parse(expensesJSON);
          if(Array.isArray(parsed)) expenses = parsed;
      }
    } catch {
       toast({ title: "خطأ", description: "بيانات المصاريف تالفة ولا يمكن تصديرها.", variant: "destructive" });
       return;
    }
    
    if (expenses.length === 0) {
      toast({ title: "لا توجد بيانات", description: "ليس لديك أي مصاريف مسجلة لتصديرها.", variant: "destructive" });
      return;
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

    XLSX.writeFile(workbook, "masroofat-expenses.xlsx");
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

        // Auto-map from saved indices if they are valid for the current file
        const savedMap: Record<string, number | null> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MAP_KEY) || '{}');
        const autoMap: Record<string, number | null> = {};
        
        for (const [field] of Object.entries(COLUMN_MAP_CONFIG)) {
          const savedIndex = savedMap[field];
          if (savedIndex !== null && savedIndex !== undefined && savedIndex < headers.length) {
             autoMap[field] = savedIndex;
          }
        }
        
        setColumnMap(autoMap);
        setIsMappingColumns(true);
        if (Object.keys(autoMap).length > 0) {
          toast({
            title: "يرجى تأكيد ربط الأعمدة",
            description: "إذا قمت بالاستيراد من قبل، فقد تم حفظ اختياراتك.",
          });
        }

      } catch (error: any) {
        console.error("Failed to parse file:", error);
        toast({ title: "فشل الاستيراد", description: error.message || "حدث خطأ أثناء قراءة الملف.", variant: "destructive" });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const processAndSaveExpenses = () => {
      const missingRequired = REQUIRED_FIELDS.filter(field => columnMap[field] === null || columnMap[field] === undefined);
      if (missingRequired.length > 0) {
          toast({
              title: "حقول مطلوبة مفقودة",
              description: `يرجى ربط الحقول التالية: ${missingRequired.map(f => COLUMN_MAP_CONFIG[f as keyof typeof COLUMN_MAP_CONFIG].label).join(', ')}`,
              variant: "destructive",
          });
          return;
      }
      
      const categoryNameToIdMap = new Map<string, string>();
      Object.entries(CATEGORIES).forEach(([id, catData]) => {
          // Normalize to handle subtle character differences (e.g. ي vs ى)
          const normalizedName = catData.name.trim().normalize("NFKD");
          categoryNameToIdMap.set(normalizedName, id);
      });

      const newExpenses: Expense[] = [];

      parsedDataCache.forEach((row, rowIndex) => {
        if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
            return; // Skip empty rows
        }

        const getCellData = (fieldName: keyof typeof COLUMN_MAP_CONFIG): any => {
            const colIndex = columnMap[fieldName];
            if (colIndex === null || colIndex === undefined) return null;
            return row[colIndex];
        };
        
        const importedTitle = String(getCellData('title') || '').trim();
        const importedDescription = String(getCellData('description') || '').trim();
        
        let title = importedTitle;
        if (!title) {
          title = importedDescription || `مصروف مستورد - صف ${rowIndex + 2}`;
        }

        const rawAmount = getCellData('amount');
        const amount = rawAmount !== null ? parseFloat(String(rawAmount).replace(/[^0-9.-]+/g,"")) || 0 : 0;
        
        const rawCategoryName = String(getCellData('category') || '').trim().normalize("NFKD");
        const foundCategoryId = categoryNameToIdMap.get(rawCategoryName) || 'other';

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
        
        const newExp: Expense = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          title: title,
          amount: amount,
          category: foundCategoryId,
          date: date,
          description: importedDescription || undefined,
          isOutOfBudget: ['نعم', 'yes', 'true', true, '1', 1].includes(String(getCellData('isOutOfBudget') || '').trim().toLowerCase()),
          outOfBudgetDetails: String(getCellData('outOfBudgetDetails') || '').trim() || undefined,
        };
        
        newExpenses.push(newExp);
      });

      if (newExpenses.length === 0) {
        toast({
            title: "لم يتم استيراد أي بيانات",
            description: "لم يتم العثور على أي صفوف صالحة في الملف. يرجى التأكد من ربط الأعمدة المطلوبة بشكل صحيح.",
            variant: "destructive",
        });
        return;
      }
      
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
          console.error("Could not parse existing expenses from localStorage. Overwriting.", e);
          toast({
            title: "تحذير",
            description: "تم العثور على بيانات سابقة تالفة، سيتم الكتابة فوقها.",
            variant: "destructive"
          });
      }
      
      const combinedExpenses = [...existingExpenses, ...newExpenses];
      localStorage.setItem('expenses', JSON.stringify(combinedExpenses));
      localStorage.setItem(LOCAL_STORAGE_MAP_KEY, JSON.stringify(columnMap));
      
      toast({
        title: "اكتمل الاستيراد",
        description: `تم استيراد ${newExpenses.length} مصروف بنجاح.`,
      });

      setIsMappingColumns(false);
      window.dispatchEvent(new CustomEvent('expensesUpdated'));
  };
  
  const handleDeleteAllData = () => {
    if (!mounted) return;

    try {
      localStorage.removeItem('expenses');
      localStorage.removeItem('goals');
      localStorage.removeItem('userProfile');
      localStorage.removeItem(LOCAL_STORAGE_MAP_KEY);
      localStorage.removeItem('userBudgetSettings');
      localStorage.removeItem('categoryBudgets');

      setTotalBudgetInput("0");
      setWeeklyBudgetInput("0");
      setZeroSpendDaysTargetInput("4");
      setCategoryBudgets({});
      setUserProfile({});
      
      toast({
        title: "تم الحذف بنجاح",
        description: "تم تصفير التطبيق وحذف جميع البيانات.",
      });

      window.dispatchEvent(new CustomEvent('expensesUpdated'));
      window.dispatchEvent(new CustomEvent('budgetUpdated'));

    } catch (error) {
      console.error("Failed to delete data:", error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من حذف البيانات. الرجاء المحاولة مرة أخرى.",
        variant: "destructive",
      });
    }
  };


  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-24">
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
            <UserCircle className="h-6 w-6 text-primary" />
            الملف الشخصي
          </CardTitle>
          <CardDescription>هذه المعلومات تساعد في تخصيص النصائح والخطط المالية لك.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="monthlyIncome">الدخل الشهري التقريبي (د.ع)</Label>
            <Input
              id="monthlyIncome"
              type="text"
              inputMode="decimal"
              value={formatNumberWithCommas(userProfile.monthlyIncome)}
              onChange={(e) => handleProfileChange('monthlyIncome', parseFormattedNumber(e.target.value))}
              onFocus={(e) => { if (e.target.value === '0') handleProfileChange('monthlyIncome', ''); }}
              onBlur={(e) => { if (parseFormattedNumber(e.target.value) === '') handleProfileChange('monthlyIncome', '0'); }}
              placeholder="مثال: 1,500,000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="familySize">عدد أفراد الأسرة</Label>
            <Input
              id="familySize"
              type="number"
              value={userProfile.familySize || ''}
              onChange={(e) => handleProfileChange('familySize', e.target.value)}
              onFocus={(e) => { if (e.target.value === '0') handleProfileChange('familySize', ''); }}
              onBlur={(e) => { if (e.target.value === '') handleProfileChange('familySize', '0'); }}
              placeholder="مثال: 4"
              min="1"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveProfile} className="w-full">
            <SaveIcon className="ml-2 h-4 w-4" />
            حفظ الملف الشخصي
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontalIcon className="h-6 w-6 text-primary" />
            إعدادات الميزانية والأهداف
          </CardTitle>
          <CardDescription>قم بتعيين ميزانيتك الشهرية الإجمالية والأهداف التحفيزية.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="totalBudget">إجمالي الميزانية الشهرية (د.ع)</Label>
            <Input
              id="totalBudget"
              type="text"
              inputMode="decimal"
              value={totalBudgetInput}
              onChange={handleNumericInputChange(setTotalBudgetInput)}
              onFocus={(e) => { if (e.target.value === '0') setTotalBudgetInput(''); }}
              onBlur={(e) => { if (parseFormattedNumber(e.target.value) === '') setTotalBudgetInput('0'); }}
              placeholder="مثال: 5,000,000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weeklyBudget">الميزانية الأسبوعية المتوقعة (د.ع)</Label>
            <Input
              id="weeklyBudget"
              type="text"
              inputMode="decimal"
              value={weeklyBudgetInput}
              onChange={handleNumericInputChange(setWeeklyBudgetInput)}
              onFocus={(e) => { if (e.target.value === '0') setWeeklyBudgetInput(''); }}
              onBlur={(e) => { if (parseFormattedNumber(e.target.value) === '') setWeeklyBudgetInput('0'); }}
              placeholder="مثال: 1,000,000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zeroSpendDaysTarget">الهدف لأيام الإنفاق المنخفض (شهرياً)</Label>
            <Input
              id="zeroSpendDaysTarget"
              type="number"
              value={zeroSpendDaysTargetInput}
              onChange={(e) => setZeroSpendDaysTargetInput(e.target.value)}
              onFocus={(e) => { if (e.target.value === '0') setZeroSpendDaysTargetInput(''); }}
              onBlur={(e) => { if (e.target.value === '') setZeroSpendDaysTargetInput('0'); }}
              placeholder="مثال: 4"
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
            <FolderKanban className="h-6 w-6 text-primary" />
            ميزانيات الفئات
          </CardTitle>
          <CardDescription>حدد ميزانية شهرية مخصصة لكل فئة لتتبع أدق.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[40vh] overflow-y-auto pr-3">
          {Object.entries(CATEGORIES).map(([id, category]) => (
            <div key={id} className="flex items-center gap-4">
                <span className="flex items-center gap-2 w-1/3">
                    <span className="text-xl">{category.icon}</span>
                    <Label htmlFor={`category-${id}`}>{category.name}</Label>
                </span>
              <Input
                id={`category-${id}`}
                type="text"
                inputMode="decimal"
                value={categoryBudgets[id] || ''}
                onChange={(e) => handleCategoryBudgetChange(id, e.target.value)}
                onFocus={(e) => { if (e.target.value === '0') handleCategoryBudgetChange(id, ''); }}
                onBlur={(e) => { if (parseFormattedNumber(e.target.value) === '') handleCategoryBudgetChange(id, '0'); }}
                placeholder="0"
                className="flex-1"
              />
            </div>
          ))}
        </CardContent>
        <CardFooter>
            <Button onClick={handleSaveCategoryBudgets} className="w-full">
                <SaveIcon className="ml-2 h-4 w-4" />
                حفظ ميزانيات الفئات
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
                        value={columnMap[field] !== null && columnMap[field] !== undefined ? String(columnMap[field]) : '_EMPTY_'}
                        onValueChange={(value) => {
                          const newIndex = value === '_EMPTY_' ? null : parseInt(value, 10);
                          setColumnMap(prev => ({ ...prev, [field]: newIndex }));
                        }}
                    >
                        <SelectTrigger id={`map-${field}`} className="col-span-2">
                            <SelectValue placeholder="اختر عمودًا..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_EMPTY_">-- لا يوجد --</SelectItem>
                            {fileHeaders.map((header, index) => (
                                <SelectItem key={index} value={String(index)}>
                                  {`العمود ${getColumnName(index)}: ${header || '(فارغ)'}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
            ))}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsMappingColumns(false)}>إلغاء</Button>
              <Button onClick={processAndSaveExpenses}>تأكيد و استيراد البيانات</Button>
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
        <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button className="w-full" variant="outline" onClick={handleExport}>تصدير البيانات (Excel)</Button>
                <Button className="w-full" variant="outline" onClick={handleImportClick}>استيراد البيانات (Excel)</Button>
                <Input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
            </div>
            <div className="sm:col-span-2 p-4 text-center text-muted-foreground border rounded-lg">
                سيتم إضافة إدارة التصنيفات هنا قريباً.
            </div>

            <div className="pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button className="w-full" variant="destructive">
                        <Trash2Icon className="ml-2 h-4 w-4" />
                        حذف جميع البيانات (تصفير التطبيق)
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بيانات المصاريف والميزانية والأهداف والملف الشخصي بشكل دائم من هذا الجهاز.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAllData}>نعم، قم بالحذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                  استخدم هذا الخيار لبدء سجل مصاريف جديد من الصفر.
              </p>
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
          <p>جميع الحقوق محفوظة لتطبيق مصروفات © {new Date().getFullYear()}</p>
        </CardContent>
      </Card>

    </div>
  );
}
