
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTheme } from 'next-themes';
import { PaletteIcon, SlidersHorizontalIcon, DatabaseZapIcon, InfoIcon, Moon, Sun, SaveIcon, LinkIcon, Trash2Icon, FolderKanban, UserCircle, PlusCircle, Loader2Icon } from "lucide-react";
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
import type { Expense, UserProfile, FamilyMember, UserSettings } from '@/types';
import * as XLSX from 'xlsx';
import { CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserSettings, updateUserSettings, getExpenses, addExpense, deleteCollection } from '@/services/firestore';

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
const LOCAL_STORAGE_MAP_KEY = 'userColumnMap_v2_indexBased'; 

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [totalBudgetInput, setTotalBudgetInput] = useState<string>("");
  const [zeroSpendDaysTargetInput, setZeroSpendDaysTargetInput] = useState<string>("");
  
  const [isMappingColumns, setIsMappingColumns] = useState(false);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, number | null>>({});
  const [parsedDataCache, setParsedDataCache] = useState<any[][]>([]);

  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState('');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  const { data: userSettings, isLoading: isSettingsLoading } = useQuery({
      queryKey: ['userSettings', user?.uid],
      queryFn: () => getUserSettings(user!.uid),
      enabled: !!user,
  });
  
  const { data: expenses, isLoading: isExpensesLoading } = useQuery<Expense[]>({
    queryKey: ['expenses', user?.uid],
    queryFn: () => getExpenses(user!.uid),
    enabled: !!user,
  });

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
    if (userSettings) {
      setTotalBudgetInput(formatNumberWithCommas(userSettings.budget?.totalBudget));
      setZeroSpendDaysTargetInput(userSettings.budget?.zeroSpendDaysTarget?.toString() || '4');
      
      const stringBudgets = Object.entries(userSettings.categoryBudgets || {}).reduce((acc, [key, value]) => {
          acc[key] = formatNumberWithCommas(value as number);
          return acc;
      }, {} as Record<string, string>);
      setCategoryBudgets(stringBudgets);

      if (userSettings.profile) {
        setMonthlyIncomeInput(formatNumberWithCommas(userSettings.profile.monthlyIncome));
        setFamilyMembers(userSettings.profile.familyMembers || [{ id: crypto.randomUUID(), type: 'adult', age: 30 }]);
      } else {
        setFamilyMembers([{ id: crypto.randomUUID(), type: 'adult', age: 30 }]);
      }
    }
  }, [userSettings]);
  
  const handleAddMember = () => {
    setFamilyMembers(prev => [...prev, { id: crypto.randomUUID(), type: 'child', age: 0 }]);
  };
  
  const handleRemoveMember = (id: string) => {
    if (familyMembers.length > 1) {
      setFamilyMembers(prev => prev.filter(m => m.id !== id));
    } else {
      toast({
        title: "لا يمكن الحذف",
        description: "يجب أن يبقى فرد واحد على الأقل في الملف الشخصي.",
        variant: "destructive",
      });
    }
  };

  const handleMemberChange = (id: string, field: keyof Omit<FamilyMember, 'id'>, value: string | number) => {
    setFamilyMembers(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const updateSettingsMutation = useMutation({
      mutationFn: (newSettings: Partial<UserSettings>) => updateUserSettings(user!.uid, newSettings),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
          toast({
              title: "تم الحفظ",
              description: "تم تحديث إعداداتك بنجاح.",
          });
      },
      onError: () => {
          toast({
              title: "خطأ",
              description: "فشل تحديث الإعدادات.",
              variant: "destructive",
          });
      }
  });

  const handleSaveProfile = () => {
    const income = parseFloat(parseFormattedNumber(monthlyIncomeInput));
    if (isNaN(income) || income < 0) {
       toast({ title: "خطأ في الإدخال", description: "الرجاء إدخال رقم صحيح وموجب للدخل الشهري.", variant: "destructive" });
       return;
    }
    const areAgesValid = familyMembers.every(m => m.age >= 0 && m.age < 150);
    if (!areAgesValid) {
        toast({ title: "خطأ في الإدخال", description: "الرجاء إدخال أعمار صحيحة لجميع أفراد الأسرة.", variant: "destructive" });
        return;
    }
    const profileToSave: UserProfile = { monthlyIncome: income, familyMembers: familyMembers };
    updateSettingsMutation.mutate({ profile: profileToSave });
  };

  const handleSaveBudget = () => {
    const total = parseFloat(parseFormattedNumber(totalBudgetInput) || "0");
    const zeroSpendDays = parseInt(zeroSpendDaysTargetInput || "0", 10);

    if (isNaN(total) || total < 0 || isNaN(zeroSpendDays) || zeroSpendDays < 0) {
      toast({ title: "خطأ في الإدخال", description: "الرجاء إدخال أرقام موجبة وصحيحة للميزانية والأهداف.", variant: "destructive" });
      return;
    }
    updateSettingsMutation.mutate({ budget: { totalBudget: total, zeroSpendDaysTarget: zeroSpendDays, weeklyBudget: 0 } });
  };

  const handleSaveCategoryBudgets = () => {
    const numericBudgets = Object.entries(categoryBudgets).reduce((acc, [key, value]) => {
        const amount = parseFloat(parseFormattedNumber(value));
        if (!isNaN(amount) && amount >= 0) acc[key] = amount;
        return acc;
    }, {} as Record<string, number>);
    updateSettingsMutation.mutate({ categoryBudgets: numericBudgets });
  };
  
  const addMultipleExpensesMutation = useMutation({
    mutationFn: (newExpenses: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[]) => {
      if (!user) throw new Error("User not authenticated");
      const promises = newExpenses.map(exp => addExpense(user.uid, exp));
      return Promise.all(promises);
    },
    onSuccess: (results) => {
        queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
        toast({
          title: "اكتمل الاستيراد",
          description: `تم استيراد ${results.length} مصروف بنجاح.`,
        });
        setIsMappingColumns(false);
    },
    onError: () => {
      toast({ title: "فشل الاستيراد", description: "حدث خطأ أثناء حفظ البيانات.", variant: "destructive" });
    }
  });

  const handleExport = () => {
    if (!expenses || expenses.length === 0) {
      toast({ title: "لا توجد بيانات", description: "ليس لديك أي مصاريف مسجلة لتصديرها.", variant: "destructive" });
      return;
    }
    
    const dataToExport = expenses.map((exp) => ({
      'اسم التاجر': exp.title,
      'المبلغ': exp.amount,
      'الفئة': CATEGORIES[exp.category as keyof typeof CATEGORIES]?.name || exp.category,
      'التاريخ': new Date(exp.date),
      'الوصف': exp.description || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "مصروفات");
    worksheet['!cols'] = [ { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 40 } ];
    XLSX.writeFile(workbook, "masroofat-expenses.xlsx");
    toast({ title: "تم التصدير بنجاح", description: "تم تصدير بيانات مصاريفك إلى ملف Excel." });
  };

  const handleImportClick = () => {
    setIsMappingColumns(false);
    setColumnMap({});
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      } catch (error: any) {
        toast({ title: "فشل الاستيراد", description: error.message || "حدث خطأ أثناء قراءة الملف.", variant: "destructive" });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const processAndSaveExpenses = () => {
      if (!user) return;
      const missingRequired = REQUIRED_FIELDS.filter(field => columnMap[field] === null || columnMap[field] === undefined);
      if (missingRequired.length > 0) {
          toast({ title: "حقول مطلوبة مفقودة", description: `يرجى ربط الحقول التالية: ${missingRequired.map(f => COLUMN_MAP_CONFIG[f as keyof typeof COLUMN_MAP_CONFIG].label).join(', ')}`, variant: "destructive" });
          return;
      }
      const categoryNameToIdMap = new Map<string, string>();
      Object.entries(CATEGORIES).forEach(([id, catData]) => {
          const normalizedName = catData.name.trim().normalize("NFKD");
          categoryNameToIdMap.set(normalizedName, id);
      });
      const newExpenses: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[] = [];
      parsedDataCache.forEach((row, rowIndex) => {
        if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) return;
        const getCellData = (fieldName: keyof typeof COLUMN_MAP_CONFIG): any => {
            const colIndex = columnMap[fieldName];
            return (colIndex === null || colIndex === undefined) ? null : row[colIndex];
        };
        const title = String(getCellData('title') || `مصروف مستورد - صف ${rowIndex + 2}`).trim();
        const amount = parseFloat(String(getCellData('amount')).replace(/[^0-9.-]+/g,"")) || 0;
        const categoryName = String(getCellData('category') || '').trim().normalize("NFKD");
        const category = categoryNameToIdMap.get(categoryName) || 'other';
        const rawDate = getCellData('date');
        let date = new Date().toISOString();
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) date = rawDate.toISOString();
        else if (typeof rawDate === 'string' && rawDate && !isNaN(new Date(rawDate).getTime())) date = new Date(rawDate).toISOString();
        newExpenses.push({ title, amount, category, date, description: String(getCellData('description') || '').trim() || undefined });
      });

      if (newExpenses.length === 0) {
        toast({ title: "لم يتم استيراد أي بيانات", description: "لم يتم العثور على أي صفوف صالحة.", variant: "destructive" });
        return;
      }
      addMultipleExpensesMutation.mutate(newExpenses);
      localStorage.setItem(LOCAL_STORAGE_MAP_KEY, JSON.stringify(columnMap));
  };
  
  const deleteAllDataMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      await deleteCollection(user.uid, 'expenses');
      await deleteCollection(user.uid, 'goals');
      await updateUserSettings(user.uid, {
        budget: { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 },
        categoryBudgets: {},
        profile: { monthlyIncome: 0, familyMembers: [{ id: crypto.randomUUID(), type: 'adult', age: 30 }] }
      });
    },
    onSuccess: () => {
      queryClient.clear();
      toast({ title: "تم الحذف بنجاح", description: "تم تصفير التطبيق وحذف جميع البيانات." });
      // Reset local state after successful deletion
      setTotalBudgetInput("0");
      setZeroSpendDaysTargetInput("4");
      setCategoryBudgets({});
      setMonthlyIncomeInput('');
      setFamilyMembers([{ id: crypto.randomUUID(), type: 'adult', age: 30 }]);
      queryClient.invalidateQueries(); // Force refetch of all data, which should now be empty/default
    },
    onError: () => {
      toast({ title: "خطأ", description: "لم نتمكن من حذف البيانات.", variant: "destructive" });
    }
  });

  const handleDeleteAllData = () => {
    if (!user) return;
    deleteAllDataMutation.mutate();
  };

  if (isSettingsLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;

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
              value={monthlyIncomeInput}
              onChange={handleNumericInputChange(setMonthlyIncomeInput)}
              onFocus={(e) => { if (e.target.value === '0') setMonthlyIncomeInput(''); }}
              onBlur={(e) => { if (parseFormattedNumber(e.target.value) === '') setMonthlyIncomeInput('0'); }}
              placeholder="مثال: 1,500,000"
            />
          </div>
          <div className="space-y-3">
             <Label>أفراد الأسرة (بمن فيهم أنت)</Label>
             <div className="space-y-3 rounded-lg border p-4">
                {familyMembers.map((member, index) => (
                  <div key={member.id} className="flex items-center gap-2 animate-in fade-in">
                    <span className='text-muted-foreground'>{index + 1}.</span>
                    <Select value={member.type} onValueChange={(value) => handleMemberChange(member.id, 'type', value)}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="adult">بالغ</SelectItem>
                            <SelectItem value="child">طفل</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="العمر"
                      value={member.age}
                      onChange={(e) => handleMemberChange(member.id, 'age', parseInt(e.target.value) || 0)}
                      className="w-[100px]"
                      min="0"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member.id)} disabled={familyMembers.length <= 1}>
                        <Trash2Icon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))}
                 <Button variant="outline" onClick={handleAddMember} className="w-full">
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة فرد
                </Button>
             </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveProfile} className="w-full" disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending && <Loader2Icon className='ml-2 h-4 w-4 animate-spin' />}
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
          <Button onClick={handleSaveBudget} className="w-full" disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending && <Loader2Icon className='ml-2 h-4 w-4 animate-spin' />}
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
            <Button onClick={handleSaveCategoryBudgets} className="w-full" disabled={updateSettingsMutation.isPending}>
                {updateSettingsMutation.isPending && <Loader2Icon className='ml-2 h-4 w-4 animate-spin' />}
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
              <Button onClick={processAndSaveExpenses} disabled={addMultipleExpensesMutation.isPending}>
                  {addMultipleExpensesMutation.isPending && <Loader2Icon className="ml-2 h-4 w-4 animate-spin" />}
                  تأكيد واستيراد البيانات
              </Button>
          </CardFooter>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZapIcon className="h-6 w-6 text-primary" />
            إدارة البيانات
          </CardTitle>
           <CardDescription>تصدير بيانات المصاريف إلى ملف Excel أو استيرادها منه.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button className="w-full" variant="outline" onClick={handleExport} disabled={isExpensesLoading}>تصدير البيانات (Excel)</Button>
                <Button className="w-full" variant="outline" onClick={handleImportClick}>استيراد البيانات (Excel)</Button>
                <Input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
            </div>

            <div className="pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button className="w-full" variant="destructive" disabled={deleteAllDataMutation.isPending}>
                        {deleteAllDataMutation.isPending && <Loader2Icon className="ml-2 h-4 w-4 animate-spin" />}
                        <Trash2Icon className="ml-2 h-4 w-4" />
                        حذف جميع البيانات (تصفير التطبيق)
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بيانات المصاريف والأهداف والإعدادات بشكل دائم من حسابك السحابي.
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
          <p>إصدار التطبيق: 1.1.0 (Cloud Sync)</p>
          <p>جميع الحقوق محفوظة لشركة مصروفات © {new Date().getFullYear()}</p>
        </CardContent>
      </Card>

    </div>
  );
}
