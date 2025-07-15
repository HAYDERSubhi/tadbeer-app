
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTheme } from 'next-themes';
import { PaletteIcon, SlidersHorizontalIcon, DatabaseZapIcon, InfoIcon, Moon, Sun, SaveIcon, LinkIcon, Trash2Icon, FolderKanban, UserCircle, PlusCircle, Loader2Icon, Banknote, Repeat, PencilIcon, LogOut, AlertTriangle, WandSparkles, CalendarClock, Eye } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from "@/hooks/use-toast";
import type { Expense, UserProfile, FamilyMember, UserSettings, Income, RecurringPayment } from '@/types';
import * as XLSX from 'xlsx';
import { CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserSettings, addExpense, deleteCollection, addIncome, deleteIncome, updateIncome, updateExpense } from '@/services/firestore';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { version } from '../../../package.json';
import { useAppData } from '@/hooks/use-app-data';
import { reCategorizeAction } from '@/app/actions';
import Link from 'next/link';


const COLUMN_MAP_CONFIG = {
  title: { label: 'اسم السلعة / الوصف' },
  amount: { label: 'المبلغ' },
  category: { label: 'الفئة' },
  date: { label: 'التاريخ' },
  description: { label: 'ملاحظات (اختياري)' },
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

const incomeSchema = z.object({
  title: z.string().min(2, { message: 'اسم المصدر مطلوب' }),
  amount: z.coerce.number().min(1, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  type: z.enum(['recurring', 'one-time'], { required_error: 'النوع مطلوب' }),
  date: z.date({ required_error: 'التاريخ مطلوب' }),
});

type IncomeFormData = z.infer<typeof incomeSchema>;

const recurringPaymentSchema = z.object({
  title: z.string().min(2, { message: "اسم الدفعة مطلوب" }),
  amount: z.coerce.number().min(1, { message: "المبلغ يجب أن يكون أكبر من صفر" }),
  category: z.string().min(1, { message: "الفئة مطلوبة" }),
  frequency: z.enum(['monthly', 'quarterly', 'annually', 'one-time'], { required_error: 'تكرار الدفعة مطلوب'}),
  startDate: z.date({ required_error: 'تاريخ أول دفعة مطلوب' }),
});

type RecurringPaymentFormData = z.infer<typeof recurringPaymentSchema>;


export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, signOutUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { userSettings, expenses, incomes } = useAppData();

  const [totalBudgetInput, setTotalBudgetInput] = useState<string>("");
  const [zeroSpendDaysTargetInput, setZeroSpendDaysTargetInput] = useState<string>("");
  
  const [isMappingColumns, setIsMappingColumns] = useState(false);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, number | null>>({});
  const [parsedDataCache, setParsedDataCache] = useState<any[][]>([]);

  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  
  // State for Dialogs
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [isRecurringPaymentDialogOpen, setIsRecurringPaymentDialogOpen] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  const [deleteOptions, setDeleteOptions] = useState({
    expenses: false,
    goals: false,
    incomes: false,
    budgetSettings: false,
    profileSettings: false,
  });

  const formatNumberWithCommas = (value: string | number | undefined) => {
    if (value === null || value === undefined || value === '') return '';
    const numericString = String(value).replace(/,/g, '');
    const number = Number(numericString);
    if (isNaN(number)) return '';
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

      const initialFamilyMembers = userSettings.profile?.familyMembers;
      if (initialFamilyMembers && initialFamilyMembers.length > 0) {
        setFamilyMembers(initialFamilyMembers);
      } else {
        // If no members exist, initialize with one default member
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

  const totalRecurringIncome = useMemo(() => {
    if (!incomes) return userSettings?.profile?.monthlyIncome || 0;
    return incomes
        .filter(income => income.type === 'recurring')
        .reduce((sum, income) => sum + income.amount, 0);
  }, [incomes, userSettings]);

  useEffect(() => {
      const userProfile = userSettings?.profile;
      if (user && userProfile && incomes) {
          if (userProfile.monthlyIncome !== totalRecurringIncome) {
              const updatedProfile = { ...userProfile, monthlyIncome: totalRecurringIncome };
              updateSettingsMutation.mutate({ profile: updatedProfile });
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRecurringIncome, userSettings, incomes, user]);


  const handleSaveProfile = () => {
    const areAgesValid = familyMembers.every(m => m.age >= 0 && m.age < 150);
    if (!areAgesValid) {
        toast({ title: "خطأ في الإدخال", description: "الرجاء إدخال أعمار صحيحة لجميع أفراد الأسرة.", variant: "destructive" });
        return;
    }
    const profileToSave: UserProfile = { monthlyIncome: totalRecurringIncome, familyMembers };
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

  // --- Income Management ---
  const incomeForm = useForm<IncomeFormData>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      title: '',
      amount: 0,
      date: new Date(),
    }
  });

  const addIncomeMutation = useMutation({
    mutationFn: (newIncome: Omit<Income, 'id'|'createdAt'|'uid'>) => addIncome(user!.uid, newIncome),
    onSuccess: () => {
      toast({ title: "تمت الإضافة", description: "تم إضافة مصدر الدخل بنجاح." });
      queryClient.invalidateQueries({ queryKey: ['incomes', user?.uid] });
      setIsIncomeDialogOpen(false);
    },
    onError: () => {
       toast({ title: "خطأ", description: "فشل إضافة مصدر الدخل.", variant: "destructive" });
    }
  });

  const updateIncomeMutation = useMutation({
    mutationFn: ({ incomeId, incomeData }: { incomeId: string, incomeData: Partial<Omit<Income, 'id'|'createdAt'|'uid'>> }) => updateIncome(user!.uid, incomeId, incomeData),
    onSuccess: () => {
      toast({ title: "تم التحديث", description: "تم تحديث مصدر الدخل بنجاح." });
      queryClient.invalidateQueries({ queryKey: ['incomes', user?.uid] });
      setIsIncomeDialogOpen(false);
    },
    onError: () => {
       toast({ title: "خطأ", description: "فشل تحديث مصدر الدخل.", variant: "destructive" });
    }
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: (incomeId: string) => deleteIncome(user!.uid, incomeId),
    onSuccess: () => {
      toast({ title: "تم الحذف", description: "تم حذف مصدر الدخل." });
      queryClient.invalidateQueries({ queryKey: ['incomes', user?.uid] });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حذف مصدر الدخل.", variant: "destructive" });
    }
  });

  const onIncomeSubmit = (data: IncomeFormData) => {
    if (!user) return;
    const incomePayload = {
      ...data,
      date: data.date.toISOString(),
    };
  
    if (editingIncomeId) {
      updateIncomeMutation.mutate({ incomeId: editingIncomeId, incomeData: incomePayload });
    } else {
      addIncomeMutation.mutate(incomePayload);
    }
  };
  
  const handleEditIncomeClick = (income: Income) => {
    setEditingIncomeId(income.id);
    incomeForm.reset({
        title: income.title,
        amount: income.amount,
        type: income.type,
        date: new Date(income.date),
    });
    setIsIncomeDialogOpen(true);
  };
  
  const handleAddNewIncomeClick = () => {
    setEditingIncomeId(null);
    incomeForm.reset({ title: '', amount: 0, type: undefined, date: new Date() });
    setIsIncomeDialogOpen(true);
  };
  
  // --- Recurring Payments Management ---
  const recurringPaymentForm = useForm<RecurringPaymentFormData>({
    resolver: zodResolver(recurringPaymentSchema),
    defaultValues: {
      title: "",
      amount: 0,
      category: "subscriptions",
      frequency: "monthly",
      startDate: new Date(),
    },
  });
  
  const recurringPaymentMutation = useMutation({
    mutationFn: (newPaymentsList: RecurringPayment[]) => {
      return updateUserSettings(user!.uid, { recurringPayments: newPaymentsList });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل تحديث الدفعات الدورية.", variant: "destructive" });
    }
  });

  const handleSaveRecurringPayment = (data: RecurringPaymentFormData) => {
    const currentPayments = userSettings?.recurringPayments || [];
    let updatedPayments;

    if (editingPaymentId) {
        updatedPayments = currentPayments.map(p => 
            p.id === editingPaymentId ? { ...p, ...data, startDate: data.startDate.toISOString() } : p
        );
        toast({ title: "تم التحديث", description: "تم تحديث الدفعة الدورية بنجاح." });
    } else {
        const newPayment: RecurringPayment = { ...data, id: crypto.randomUUID(), startDate: data.startDate.toISOString() };
        updatedPayments = [...currentPayments, newPayment];
        toast({ title: "تمت الإضافة", description: "تمت إضافة الدفعة الدورية بنجاح." });
    }

    recurringPaymentMutation.mutate(updatedPayments);
    recurringPaymentForm.reset({ title: "", amount: 0, category: "subscriptions", frequency: "monthly", startDate: new Date() });
    setIsRecurringPaymentDialogOpen(false);
  };
  
  const handleDeleteRecurringPayment = (id: string) => {
    const currentPayments = userSettings?.recurringPayments || [];
    recurringPaymentMutation.mutate(currentPayments.filter(p => p.id !== id));
    toast({ title: "تم الحذف", description: "تم حذف الدفعة الدورية بنجاح." });
  };

  const handleAddNewPaymentClick = () => {
    setEditingPaymentId(null);
    recurringPaymentForm.reset({
      title: "",
      amount: 0,
      category: "subscriptions",
      frequency: "monthly",
      startDate: new Date(),
    });
    setIsRecurringPaymentDialogOpen(true);
  };
  
  const handleEditPaymentClick = (payment: RecurringPayment) => {
    setEditingPaymentId(payment.id);
    recurringPaymentForm.reset({
      ...payment,
      startDate: new Date(payment.startDate),
    });
    setIsRecurringPaymentDialogOpen(true);
  };

  const handleLogout = async () => {
    try {
        await signOutUser();
        toast({ title: 'تم تسجيل الخروج', description: 'نأمل أن نراك قريباً!' });
        // The main layout will handle the redirect to /login automatically.
    } catch (error) {
        toast({ title: 'خطأ', description: 'لم نتمكن من تسجيل خروجك.', variant: 'destructive' });
    }
  }

  // --- Data Import/Export & Reset ---
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
    onError: (e) => {
      console.error("Import error:", e);
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

        const amountStr = String(getCellData('amount') || '0').replace(/[^0-9.-]+/g,"");
        const amount = parseFloat(amountStr) || 0;

        if (amount <= 0) return;

        const titleValue = String(getCellData('title') || '').trim();
        const title = titleValue || `مصروف مستورد - صف ${rowIndex + 2}`;

        const categoryName = String(getCellData('category') || '').trim().normalize("NFKD");
        const category = categoryNameToIdMap.get(categoryName) || 'other';

        const rawDate = getCellData('date');
        let date = new Date().toISOString();
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            date = rawDate.toISOString();
        } else if (typeof rawDate === 'number' && rawDate > 0) {
            const jsDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            if (!isNaN(jsDate.getTime())) {
                date = jsDate.toISOString();
            }
        } else if (typeof rawDate === 'string' && rawDate && !isNaN(new Date(rawDate).getTime())) {
            date = new Date(rawDate).toISOString();
        }
        
        // Construct the expense payload, only including optional fields if they have a value.
        const expensePayload: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'> = {
            title,
            amount,
            category,
            date,
        };

        const descriptionValue = String(getCellData('description') || '').trim();
        if (descriptionValue) {
            expensePayload.description = descriptionValue;
        }

        const isOutOfBudgetCell = getCellData('isOutOfBudget');
        const isOutOfBudget = /^(true|1|نعم|yes)$/i.test(String(isOutOfBudgetCell).trim());
        if (isOutOfBudget) {
            expensePayload.isOutOfBudget = true;
            const outOfBudgetDetailsValue = String(getCellData('outOfBudgetDetails') || '').trim();
            if (outOfBudgetDetailsValue) {
                expensePayload.outOfBudgetDetails = outOfBudgetDetailsValue;
            }
        }
 
        newExpenses.push(expensePayload);
      });

      if (newExpenses.length === 0) {
        toast({ title: "لم يتم استيراد أي بيانات", description: "لم يتم العثور على أي صفوف صالحة.", variant: "destructive" });
        return;
      }
      addMultipleExpensesMutation.mutate(newExpenses);
      localStorage.setItem(LOCAL_STORAGE_MAP_KEY, JSON.stringify(columnMap));
  };
  
  const defaultSettings = {
      budget: { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 },
      categoryBudgets: {},
      profile: {
          monthlyIncome: 0,
          familyMembers: [{ id: crypto.randomUUID(), type: 'adult', age: 30 }]
      },
      recurringPayments: [],
  };
  
  const resetDataMutation = useMutation({
    mutationFn: async (options: typeof deleteOptions) => {
        if (!user) throw new Error("User not authenticated");
        
        const promises = [];

        if (options.expenses) promises.push(deleteCollection(user.uid, 'expenses'));
        if (options.goals) promises.push(deleteCollection(user.uid, 'goals'));
        if (options.incomes) promises.push(deleteCollection(user.uid, 'incomes'));

        const settingsToReset: Partial<UserSettings> = {};
        if (options.budgetSettings) {
            settingsToReset.budget = defaultSettings.budget;
            settingsToReset.categoryBudgets = defaultSettings.categoryBudgets;
            settingsToReset.recurringPayments = []; // Reset recurring payments as well
        }
        if (options.profileSettings) {
            settingsToReset.profile = defaultSettings.profile;
        }

        if (Object.keys(settingsToReset).length > 0) {
            promises.push(updateUserSettings(user.uid, settingsToReset));
        }

        await Promise.all(promises);
    },
    onSuccess: (_, variables) => {
        if (variables.expenses) queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
        if (variables.goals) queryClient.invalidateQueries({ queryKey: ['goals', user?.uid] });
        if (variables.incomes) queryClient.invalidateQueries({ queryKey: ['incomes', user?.uid] });
        
        if (variables.budgetSettings || variables.profileSettings || variables.incomes) {
            queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
        }

        toast({ title: "تم الحذف بنجاح", description: "تم حذف البيانات المحددة بنجاح." });
        
        if (variables.budgetSettings) {
            setTotalBudgetInput("0");
            setZeroSpendDaysTargetInput("4");
            setCategoryBudgets({});
        }
        if (variables.profileSettings) {
            setFamilyMembers([{ id: crypto.randomUUID(), type: 'adult', age: 30 }]);
        }

        setDeleteOptions({ expenses: false, goals: false, incomes: false, budgetSettings: false, profileSettings: false });
    },
    onError: () => {
      toast({ title: "خطأ", description: "لم نتمكن من حذف البيانات المحددة.", variant: "destructive" });
    }
  });

  const handleCustomDelete = () => {
    if (!user || !Object.values(deleteOptions).some(v => v)) return;
    resetDataMutation.mutate(deleteOptions);
  };
  
  const isAnonymous = user?.isAnonymous ?? true;

  // --- Re-categorization ---
  const reCategorizeMutation = useMutation({
    mutationFn: async () => {
      if (!expenses || expenses.length === 0) {
        toast({ title: 'لا يوجد ما يمكن تصنيفه', description: 'ليس لديك أي مصاريف مسجلة بعد.', variant: 'destructive' });
        return { count: 0 };
      }

      const categoryMap = Object.entries(CATEGORIES).reduce((acc, [id, { name }]) => {
          acc[id] = name;
          return acc;
      }, {} as Record<string, string>);

      const expensesToProcess = expenses.map(e => ({ id: e.id, title: e.title }));
      
      return reCategorizeAction({ expenses: expensesToProcess, categories: categoryMap });
    },
    onSuccess: (data) => {
      if (data.count > 0) {
        queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
        toast({
          title: 'اكتمل التصنيف!',
          description: `تمت مراجعة وتحديث ${data.count} مصروف بنجاح.`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'فشل التصنيف',
        description: error.message || 'حدث خطأ غير متوقع أثناء إعادة التصنيف.',
        variant: 'destructive',
      });
    },
  });

  const frequencyMap = {
    'monthly': 'شهري',
    'quarterly': 'ربع سنوي',
    'annually': 'سنوي',
    'one-time': 'مرة واحدة',
  };

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
            إدارة الحساب
          </CardTitle>
          <CardDescription>عرض معلومات حسابك وتسجيل الخروج.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {isAnonymous ? (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <CardTitle>أنت تستخدم حساب زائر</CardTitle>
                    <CardDescription>
                       بياناتك محفوظة على هذا الجهاز فقط. للمزامنة بين أجهزتك، يرجى تسجيل الخروج وإنشاء حساب جديد دائم.
                    </CardDescription>
                </Alert>
            ) : (
                <div className='p-3 border rounded-lg'>
                    <Label>البريد الإلكتروني المسجل</Label>
                    <p className="text-muted-foreground font-semibold">{user?.email}</p>
                </div>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full">
                    <LogOut className="ml-2 h-4 w-4" />
                    تسجيل الخروج
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>هل أنت متأكد من رغبتك في تسجيل الخروج؟</AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>تسجيل الخروج</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
              readOnly
              value={formatNumberWithCommas(totalRecurringIncome)}
              className="bg-muted/50 font-bold text-lg cursor-not-allowed focus-visible:ring-0"
            />
            <p className="text-xs text-muted-foreground mt-1">يتم احتساب الدخل الشهري تلقائياً من مجموع مصادر الدخل الشهرية المتكررة أدناه.</p>
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
            <Banknote className="h-6 w-6 text-primary" />
            إدارة الدخل
          </CardTitle>
          <CardDescription>أضف مصادر دخلك، سواء كانت شهرية متكررة أو لمرة واحدة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
            <DialogTrigger asChild>
               <Button className="w-full" onClick={handleAddNewIncomeClick}>
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة مصدر دخل جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingIncomeId ? 'تعديل مصدر الدخل' : 'إضافة مصدر دخل جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={incomeForm.handleSubmit(onIncomeSubmit)} className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label htmlFor="income-title">اسم المصدر</Label>
                    <Input id="income-title" {...incomeForm.register('title')} placeholder="مثال: راتب شهري، مشروع..." />
                    {incomeForm.formState.errors.title && <p className="text-sm text-destructive mt-1">{incomeForm.formState.errors.title.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="income-amount">المبلغ (د.ع)</Label>
                    <Controller
                      name="amount"
                      control={incomeForm.control}
                      render={({ field: { onChange, value, ...restField } }) => (
                        <Input
                          {...restField}
                          id="income-amount"
                          type="text"
                          inputMode="decimal"
                          placeholder="مثال: 1,500,000"
                          value={value === 0 ? '' : formatNumberWithCommas(value)}
                          onChange={(e) => {
                              const parsed = parseFormattedNumber(e.target.value);
                              if (parsed === '' || !isNaN(Number(parsed))) {
                                  onChange(parsed === '' ? 0 : Number(parsed));
                              }
                          }}
                        />
                      )}
                    />
                    {incomeForm.formState.errors.amount && <p className="text-sm text-destructive mt-1">{incomeForm.formState.errors.amount.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="income-type">النوع</Label>
                        <Controller
                          name="type"
                          control={incomeForm.control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger id="income-type">
                                    <SelectValue placeholder="اختر النوع" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="recurring">شهري متكرر</SelectItem>
                                    <SelectItem value="one-time">لمرة واحدة</SelectItem>
                                </SelectContent>
                            </Select>
                          )}
                        />
                        {incomeForm.formState.errors.type && <p className="text-sm text-destructive mt-1">{incomeForm.formState.errors.type.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>تاريخ الاستلام</Label>
                        <Controller
                          name="date"
                          control={incomeForm.control}
                          render={({ field }) => (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={"outline"}
                                  className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, "PPP", { locale: arIQ }) : <span>اختر تاريخاً</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single" selected={field.value} onSelect={field.onChange} initialFocus dir="rtl" locale={arIQ}
                                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                />
                              </PopoverContent>
                            </Popover>
                          )}
                        />
                        {incomeForm.formState.errors.date && <p className="text-sm text-destructive mt-1">{incomeForm.formState.errors.date.message}</p>}
                    </div>
                </div>
                <Button type="submit" className="w-full" disabled={addIncomeMutation.isPending || updateIncomeMutation.isPending}>
                  {(addIncomeMutation.isPending || updateIncomeMutation.isPending) && <Loader2Icon className="ml-2 h-4 w-4 animate-spin" />}
                  {editingIncomeId ? <><SaveIcon className="ml-2 h-4 w-4" /> تحديث</> : <><PlusCircle className="ml-2 h-4 w-4" /> إضافة</>}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Separator />

          <div>
             <h3 className="text-lg font-medium mb-2">مصادر الدخل الحالية</h3>
             <div className="space-y-2">
                {incomes.length === 0 ? (
                    <p className="text-muted-foreground text-center p-4">لا توجد مصادر دخل مسجلة.</p>
                ) : (
                    <ul className="border rounded-lg max-h-60 overflow-y-auto">
                        {incomes.map(income => (
                            <li key={income.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                <div className="flex items-center gap-3">
                                    <span className={cn("p-2 rounded-full bg-muted", income.type === 'recurring' ? 'text-blue-500' : 'text-green-500')}>
                                        {income.type === 'recurring' ? <Repeat className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}
                                    </span>
                                    <div>
                                        <p className="font-semibold">{income.title}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {income.type === 'recurring' ? 'شهري' : `في ${format(new Date(income.date), 'd MMM yyyy', {locale: arIQ})}`}
                                        </p>
                                    </div>
                                </div>
                                <div className='flex items-center'>
                                    <p className="font-bold text-green-600 dark:text-green-400 whitespace-nowrap">{income.amount.toLocaleString()}&nbsp;د.ع</p>
                                    <div className="flex items-center gap-0">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditIncomeClick(income)} disabled={addIncomeMutation.isPending || updateIncomeMutation.isPending}>
                                            <PencilIcon className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteIncomeMutation.mutate(income.id)} disabled={deleteIncomeMutation.isPending}>
                                            <Trash2Icon className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
             </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            إدارة الدفعات الدورية
          </CardTitle>
          <CardDescription>أضف دفعاتك الثابتة (مثل الإيجار، الأقساط) لتصلك تذكيرات.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Dialog open={isRecurringPaymentDialogOpen} onOpenChange={setIsRecurringPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" onClick={handleAddNewPaymentClick}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة دفعة دورية جديدة
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingPaymentId ? 'تعديل الدفعة الدورية' : 'إضافة دفعة دورية جديدة'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={recurringPaymentForm.handleSubmit(handleSaveRecurringPayment)} className="pt-4 space-y-4">
                  <div className="space-y-2">
                      <Label htmlFor="rp-title">اسم الدفعة</Label>
                      <Input id="rp-title" {...recurringPaymentForm.register('title')} placeholder="مثال: قسط السيارة، إيجار المنزل" />
                      {recurringPaymentForm.formState.errors.title && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.title.message}</p>}
                  </div>
                  <div className="space-y-2">
                        <Label htmlFor="rp-amount">المبلغ (د.ع)</Label>
                        <Controller
                          name="amount"
                          control={recurringPaymentForm.control}
                          render={({ field: { onChange, value, ...restField } }) => (
                            <Input
                              {...restField}
                              id="rp-amount" type="text" inputMode="decimal"
                              value={value === 0 ? '' : formatNumberWithCommas(value)}
                              onChange={(e) => {
                                  const parsed = parseFormattedNumber(e.target.value);
                                  if (parsed === '' || !isNaN(Number(parsed))) {
                                      onChange(parsed === '' ? 0 : Number(parsed));
                                  }
                              }}
                            />
                          )}
                        />
                        {recurringPaymentForm.formState.errors.amount && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.amount.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="rp-frequency">تكرار الدفعة</Label>
                        <Controller
                          name="frequency"
                          control={recurringPaymentForm.control}
                          render={({ field }) => (
                             <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger id="rp-frequency"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">شهرياً</SelectItem>
                                    <SelectItem value="quarterly">ربع سنوياً</SelectItem>
                                    <SelectItem value="annually">سنوياً</SelectItem>
                                    <SelectItem value="one-time">مرة واحدة</SelectItem>
                                </SelectContent>
                            </Select>
                          )}
                        />
                         {recurringPaymentForm.formState.errors.frequency && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.frequency.message}</p>}
                     </div>
                     <div className="space-y-2">
                        <Label>تاريخ أول دفعة</Label>
                        <Controller
                            name="startDate"
                            control={recurringPaymentForm.control}
                            render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP", { locale: arIQ }) : <span>اختر تاريخاً</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus dir="rtl" locale={arIQ} /></PopoverContent>
                                </Popover>
                            )}
                        />
                        {recurringPaymentForm.formState.errors.startDate && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.startDate.message}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rp-category">تصنيف المصروف</Label>
                    <Controller
                      name="category"
                      control={recurringPaymentForm.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="rp-category"><SelectValue placeholder="اختر فئة..." /></SelectTrigger>
                            <SelectContent>
                                {Object.values(CATEGORIES).map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                      )}
                    />
                    {recurringPaymentForm.formState.errors.category && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.category.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={recurringPaymentMutation.isPending}>
                      {recurringPaymentMutation.isPending && <Loader2Icon className="ml-2 h-4 w-4 animate-spin" />}
                      {editingPaymentId ? <><SaveIcon className="ml-2 h-4 w-4" /> تحديث الدفعة</> : <><PlusCircle className="ml-2 h-4 w-4" /> إضافة الدفعة</>}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Separator />

           <div>
             <h3 className="text-lg font-medium mb-2">الدفعات الحالية</h3>
             <div className="space-y-2">
                {(userSettings?.recurringPayments || []).length === 0 ? (
                    <p className="text-muted-foreground text-center p-4">لا توجد دفعات متكررة مسجلة.</p>
                ) : (
                    <ul className="border rounded-lg max-h-60 overflow-y-auto">
                        {userSettings.recurringPayments?.map(p => (
                            <li key={p.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                <div className="flex-1">
                                    <p className="font-semibold">{p.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {frequencyMap[p.frequency]} - يبدأ من {format(new Date(p.startDate), 'd MMM yyyy', {locale: arIQ})}
                                    </p>
                                </div>
                                <div className='flex items-center'>
                                    <p className="font-semibold text-foreground whitespace-nowrap">{p.amount.toLocaleString()}&nbsp;د.ع</p>
                                    <div className="flex items-center gap-0">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditPaymentClick(p)} disabled={recurringPaymentMutation.isPending}>
                                          <PencilIcon className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteRecurringPayment(p.id)} disabled={recurringPaymentMutation.isPending}>
                                          <Trash2Icon className="h-4 w-4" />
                                      </Button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
             </div>
          </div>
        </CardContent>
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
                <Button className="w-full" variant="outline" onClick={handleExport} disabled={!expenses || expenses.length === 0}>تصدير البيانات (Excel)</Button>
                <Button className="w-full" variant="outline" onClick={handleImportClick}>استيراد البيانات (Excel)</Button>
                <Input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
            </div>

            <div className="pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button className="w-full" variant="destructive">
                        <Trash2Icon className="ml-2 h-4 w-4" />
                        حذف وتصفير البيانات
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف وتصفير البيانات</AlertDialogTitle>
                        <AlertDialogDescription>
                            اختر البيانات التي ترغب في حذفها بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="font-semibold text-foreground">بيانات المعاملات:</div>
                        <div className="flex items-center space-x-2 space-x-reverse pl-4">
                            <Checkbox id="delete-expenses" checked={deleteOptions.expenses} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, expenses: !!checked}))} />
                            <Label htmlFor="delete-expenses" className="font-normal">حذف جميع المصاريف</Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse pl-4">
                            <Checkbox id="delete-goals" checked={deleteOptions.goals} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, goals: !!checked}))} />
                            <Label htmlFor="delete-goals" className="font-normal">حذف جميع الأهداف المالية</Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse pl-4">
                            <Checkbox id="delete-incomes" checked={deleteOptions.incomes} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, incomes: !!checked}))} />
                            <Label htmlFor="delete-incomes" className="font-normal">حذف جميع مصادر الدخل</Label>
                        </div>
                        <Separator />
                        <div className="font-semibold text-foreground">بيانات الإعدادات:</div>
                        <div className="flex items-center space-x-2 space-x-reverse pl-4">
                            <Checkbox id="delete-budget-settings" checked={deleteOptions.budgetSettings} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, budgetSettings: !!checked}))} />
                            <Label htmlFor="delete-budget-settings" className="font-normal">تصفير إعدادات الميزانية والدفعات المتكررة</Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse pl-4">
                            <Checkbox id="delete-profile-settings" checked={deleteOptions.profileSettings} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, profileSettings: !!checked}))} />
                            <Label htmlFor="delete-profile-settings" className="font-normal">تصفير الملف الشخصي</Label>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteOptions({ expenses: false, goals: false, incomes: false, budgetSettings: false, profileSettings: false })}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCustomDelete} disabled={!Object.values(deleteOptions).some(v => v) || resetDataMutation.isPending}>
                            {resetDataMutation.isPending && <Loader2Icon className="ml-2 h-4 w-4 animate-spin" />}
                            نعم، قم بالحذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WandSparkles className="h-6 w-6 text-primary" />
            إصلاح البيانات
          </CardTitle>
          <CardDescription>
            استخدم هذه الأداة لمراجعة جميع مصاريفك القديمة وإعادة تصنيفها تلقائيًا باستخدام الذكاء الاصطناعي لضمان دقة إحصائياتك.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => reCategorizeMutation.mutate()} disabled={reCategorizeMutation.isPending}>
            {reCategorizeMutation.isPending ? (
              <><Loader2Icon className="ml-2 h-4 w-4 animate-spin" /> جاري إعادة التصنيف...</>
            ) : (
              'بدء إعادة التصنيف الذكي'
            )}
          </Button>
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
          <p>إصدار التطبيق: {version}</p>
          <p>جميع الحقوق محفوظة لشركة مصروفات © {new Date().getFullYear()}</p>
        </CardContent>
      </Card>

    </div>
  );
}
