
"use client";

import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Palette, SlidersHorizontal, DatabaseZap, Info, Save, Link as LinkIcon, Trash2, Users, UserPlus, Loader2, Wallet, Repeat, Pencil, LogOut, AlertTriangle, MessageSquare, Handshake, CircleDollarSign } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from "@/hooks/use-toast";
import type { Expense, UserProfile, FamilyMember, UserSettings, Income, RecurringPayment, AppTone, Category } from '@/types';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserSettings, addExpense, deleteCollection, addIncome, deleteIncome, updateIncome, addFeedback } from '@/services/firestore';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle as AlertTitleComponent, AlertDescription as AlertDescriptionComponent } from '@/components/ui/alert';
import { version } from '../../../../package.json';
import { useAppData } from '@/hooks/use-app-data';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from '@/hooks/use-mobile';
import { useCategories } from '@/hooks/use-categories';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';


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

const feedbackSchema = z.object({
  subject: z.string(),
  details: z.string().min(1, { message: "التفاصيل مطلوبة" }),
});
type FeedbackFormData = z.infer<typeof feedbackSchema>;


// --- Mapping Dialog Component ---
const MappingDialog = ({
  isOpen,
  setIsOpen,
  isMobile,
  fileHeaders,
  processAndSave,
  isProcessing,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isMobile: boolean;
  fileHeaders: string[];
  processAndSave: (map: Record<string, number | null>) => void;
  isProcessing: boolean;
}) => {
  const [columnMap, setColumnMap] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (isOpen) {
      const savedMap: Record<string, number | null> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MAP_KEY) || '{}');
      const autoMap: Record<string, number | null> = {};
      for (const [field] of Object.entries(COLUMN_MAP_CONFIG)) {
        const savedIndex = savedMap[field];
        if (savedIndex !== null && savedIndex !== undefined && savedIndex < fileHeaders.length) {
            autoMap[field] = savedIndex;
        } else {
            autoMap[field] = null;
        }
      }
      setColumnMap(autoMap);
    }
  }, [isOpen, fileHeaders]);


  const DialogComponent = isMobile ? Sheet : Dialog;
  const DialogContentComponent = isMobile ? SheetContent : DialogContent;

  const handleProcess = () => {
    processAndSave(columnMap);
  }

  return (
    <DialogComponent open={isOpen} onOpenChange={setIsOpen}>
      <DialogContentComponent className={isMobile ? "flex flex-col" : ""} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm"><LinkIcon className="h-4 w-4 text-primary" />ربط أعمدة الملف</DialogTitle>
          <DialogDescription className="text-xs">الرجاء اختيار العمود الصحيح من ملفك لكل حقل. سيتم حفظ هذا الربط للاستيرادات المستقبلية.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-1">
          <div className="space-y-4 py-4">
            {Object.entries(COLUMN_MAP_CONFIG).map(([field, config]) => (
              <div key={field} className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor={`map-${field}`} className="text-right text-xs">{config.label} {REQUIRED_FIELDS.includes(field as any) && <span className="text-destructive">*</span>}</Label>
                <Select value={columnMap[field] !== null && columnMap[field] !== undefined ? String(columnMap[field]) : '_EMPTY_'} onValueChange={(value) => { const newIndex = value === '_EMPTY_' ? null : parseInt(value, 10); setColumnMap(prev => ({ ...prev, [field]: newIndex })); }}>
                  <SelectTrigger id={`map-${field}`} className="col-span-2 h-9 text-xs"><SelectValue placeholder="اختر عمودًا..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_EMPTY_">-- لا يوجد --</SelectItem>
                    {fileHeaders.map((header, index) => (<SelectItem key={index} value={String(index)}>{`العمود ${getColumnName(index)}: ${header || '(فارغ)'}`}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-xs h-9">إلغاء</Button>
          <Button onClick={handleProcess} disabled={isProcessing} className="text-xs h-9">
            {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {isProcessing ? 'جاري المعالجة...' : 'تأكيد واستيراد البيانات'}
          </Button>
        </DialogFooter>
      </DialogContentComponent>
    </DialogComponent>
  );
};


// --- Category Edit/Add Dialog ---
const categorySchema = z.object({
  name: z.string().min(2, "الاسم مطلوب (حرفين على الأقل)").max(25, "الاسم طويل جدًا"),
  icon: z.string().min(1, "الرمز مطلوب"),
});
type CategoryFormData = z.infer<typeof categorySchema>;

const CategoryEditDialog = ({
  isOpen,
  setIsOpen,
  isMobile,
  onSave,
  category,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isMobile: boolean;
  onSave: (data: CategoryFormData) => void;
  category: Category | null;
}) => {
  
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || "",
      icon: category?.icon || "",
    },
  });

  useEffect(() => {
    form.reset({
      name: category?.name || "",
      icon: category?.icon || "",
    })
  }, [category, form])

  const onSubmit = (data: CategoryFormData) => {
    onSave(data);
    form.reset();
  };

  const DialogComponent = isMobile ? Sheet : Dialog;
  const DialogContentComponent = isMobile ? SheetContent : DialogContent;

  return (
    <DialogComponent open={isOpen} onOpenChange={setIsOpen}>
      <DialogContentComponent className={isMobile ? "flex flex-col" : ""} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-sm">{category ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</DialogTitle>
          <DialogDescription className="text-xs">
            {category?.isDefault ? "يمكنك تعديل اسم ورمز الفئات الافتراضية." : "أضف اسمًا ورمزًا (Emoji) لفئتك الجديدة."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-1 py-4">
          <form id="category-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name" className="text-xs">اسم الفئة</Label>
              <Input id="cat-name" {...form.register('name')} placeholder="مثال: مصاريف الجامعة" className="text-xs h-9" />
              {form.formState.errors.name && <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>}
            </div>
             <div className="space-y-2">
              <Label htmlFor="cat-icon" className="text-xs">الرمز (Emoji)</Label>
              <Input id="cat-icon" {...form.register('icon')} placeholder="مثال: 🎓" className="text-xs h-9" />
               {form.formState.errors.icon && <p className="text-sm text-destructive mt-1">{form.formState.errors.icon.message}</p>}
            </div>
          </form>
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-xs h-9">إلغاء</Button>
          <Button type="submit" form="category-form" className="text-xs h-9">
            <Save className="ml-2 h-4 w-4" />
            حفظ
          </Button>
        </DialogFooter>
      </DialogContentComponent>
    </DialogComponent>
  );
};


const FeedbackDialog = ({ isOpen, setIsOpen, isMobile }: { isOpen: boolean, setIsOpen: (isOpen: boolean) => void, isMobile: boolean }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const form = useForm<FeedbackFormData>({
        resolver: zodResolver(feedbackSchema),
        defaultValues: {
            subject: '',
            details: '',
        }
    });

    const feedbackMutation = useMutation({
      mutationFn: (feedback: { subject: string; details: string; email?: string }) => {
          if (!user) throw new Error("User not authenticated");
          return addFeedback(user.uid, feedback);
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['feedback', user?.uid] });
          toast({ title: "شكراً لك!", description: "تم إرسال ملاحظاتك بنجاح." });
          setIsOpen(false);
          form.reset();
      },
      onError: (e) => {
          console.error("Feedback error:", e);
          toast({ title: "خطأ", description: "لم نتمكن من إرسال ملاحظاتك.", variant: "destructive" });
      }
    });

    const handleSendFeedback = (data: FeedbackFormData) => {
        if (!user) {
            toast({ title: "المستخدم غير مسجل", description: "يرجى تسجيل الدخول لإرسال الملاحظات.", variant: "destructive" });
            return;
        }
        feedbackMutation.mutate({
            subject: data.subject.trim() || "بدون موضوع",
            details: data.details.trim(),
            email: user.email || 'anonymous'
        });
    }

    const DialogComponent = isMobile ? Sheet : Dialog;
    const DialogContentComponent = isMobile ? SheetContent : DialogContent;

    return (
        <DialogComponent open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full text-xs h-9">
                    <MessageSquare className="ml-2 h-4 w-4" />
                    إرسال ملاحظات واقتراحات
                </Button>
            </DialogTrigger>
            <DialogContentComponent className={isMobile ? "flex flex-col" : ""}>
                <DialogHeader>
                    <DialogTitle className="text-sm">إرسال ملاحظات</DialogTitle>
                    <DialogDescription className="text-xs">
                        نحن نقدر رأيك! استخدم النموذج أدناه لإرسال ملاحظاتك لمساعدتنا على تحسين التطبيق.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto">
                    <form onSubmit={form.handleSubmit(handleSendFeedback)} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="feedback-subject" className="text-xs">الموضوع</Label>
                            <Input id="feedback-subject" {...form.register('subject')} placeholder="اقتراح ميزة، إبلاغ عن مشكلة..." className="text-xs h-9" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="feedback-details" className="text-xs">التفاصيل</Label>
                            <Textarea id="feedback-details" {...form.register('details')} placeholder="يرجى تقديم أكبر قدر ممكن من التفاصيل..." className="min-h-32 text-xs" />
                            {form.formState.errors.details && <p className="text-sm text-destructive mt-1">{form.formState.errors.details.message}</p>}
                        </div>
                    
                        <DialogFooter className="pt-4 border-t">
                            <Button variant="ghost" type="button" onClick={() => setIsOpen(false)} className="text-xs h-9">إلغاء</Button>
                            <Button type="submit" disabled={feedbackMutation.isPending} className="text-xs h-9">
                                {feedbackMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                إرسال
                            </Button>
                        </DialogFooter>
                    </form>
                </div>
            </DialogContentComponent>
        </DialogComponent>
    );
};


export default function SettingsPage() {
  const { user, signOutUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const { userSettings, expenses, incomes } = useAppData();
  const { categories, getIconComponent } = useCategories();

  const [totalBudgetInput, setTotalBudgetInput] = useState<string>("");
  const [zeroSpendDaysTargetInput, setZeroSpendDaysTargetInput] = useState<string>("");
  
  const [isMappingColumns, setIsMappingColumns] = useState(false);
  const [isFileProcessing, setIsFileProcessing] = useState(false);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [parsedDataCache, setParsedDataCache] = useState<any[][]>([]);

  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [appTone, setAppTone] = useState<AppTone>('formal');
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  
  // State for Dialogs
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [isRecurringPaymentDialogOpen, setIsRecurringPaymentDialogOpen] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [isDataResetOpen, setIsDataResetOpen] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  // State for Feedback Dialog
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  
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
      setAppTone(userSettings.appTone || 'formal');
      setDailyReminderEnabled(userSettings.notifications?.dailyReminderEnabled ?? false);
      
      const stringBudgets = Object.entries(userSettings.categoryBudgets || {}).reduce((acc, [key, value]) => {
          acc[key] = formatNumberWithCommas(value as number);
          return acc;
      }, {} as Record<string, string>);
      setCategoryBudgets(stringBudgets);

      const initialFamilyMembers = userSettings.profile?.familyMembers;
      if (initialFamilyMembers && initialFamilyMembers.length > 0) {
        setFamilyMembers(initialFamilyMembers);
      } else {
        setFamilyMembers([{ id: crypto.randomUUID(), type: 'adult', age: 30 }]);
      }
      setRecurringPayments(userSettings.recurringPayments || []);
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
  
  const handleSaveBudgetSettings = () => {
    const total = parseFloat(parseFormattedNumber(totalBudgetInput) || "0");
    const zeroSpendDays = parseInt(zeroSpendDaysTargetInput || "0", 10);
    if (isNaN(total) || total < 0 || isNaN(zeroSpendDays) || zeroSpendDays < 0) {
      toast({ title: "خطأ في الإدخال", description: "الرجاء إدخال أرقام موجبة وصحيحة للميزانية والأهداف.", variant: "destructive" });
      return;
    }
    
    const numericCategoryBudgets = Object.entries(categoryBudgets).reduce((acc, [key, value]) => {
        const amount = parseFloat(parseFormattedNumber(value));
        if (!isNaN(amount) && amount >= 0) acc[key] = amount;
        return acc;
    }, {} as Record<string, number>);

    updateSettingsMutation.mutate({
        budget: { totalBudget: total, weeklyBudget: 0, zeroSpendDaysTarget: zeroSpendDays },
        categoryBudgets: numericCategoryBudgets,
        recurringPayments: recurringPayments,
    });
  }

  const handleDailyReminderChange = (checked: boolean) => {
    setDailyReminderEnabled(checked);
    // The actual permission request is handled by the usePWAInstall hook.
    // This just saves the user's preference.
    updateSettingsMutation.mutate({ notifications: { dailyReminderEnabled: checked } });
  };


  const handleSaveAppearanceSettings = () => {
    updateSettingsMutation.mutate({
      appTone,
      notifications: { dailyReminderEnabled },
    });
  };
  
  
  // --- Category Management ---
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setIsCategoryDialogOpen(true);
  };
  
  const handleAddNewCategory = () => {
    setEditingCategory(null);
    setIsCategoryDialogOpen(true);
  };
  
  const handleDeleteCategory = (categoryId: string) => {
    const updatedCategories = categories.filter(c => c.id !== categoryId);
    updateSettingsMutation.mutate({ categories: updatedCategories });
    toast({ title: "تم الحذف", description: "تم حذف الفئة بنجاح."});
  };

  const handleSaveCategory = (categoryData: { name: string; icon: string }) => {
    let updatedCategories: Category[];
    if (editingCategory) {
      // Update existing
      updatedCategories = categories.map(c => 
        c.id === editingCategory.id ? { ...c, ...categoryData } : c
      );
    } else {
      // Add new
      const newCategory: Category = {
        id: categoryData.name.toLowerCase().replace(/\s+/g, '_') + '_' + crypto.randomUUID().slice(0,4),
        name: categoryData.name,
        icon: categoryData.icon,
        isDefault: false
      };
      updatedCategories = [...categories, newCategory];
    }
    updateSettingsMutation.mutate({ categories: updatedCategories });
    setIsCategoryDialogOpen(false);
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
  
  const handleSaveRecurringPayment = (data: RecurringPaymentFormData) => {
    let updatedPayments;

    if (editingPaymentId) {
        updatedPayments = recurringPayments.map(p => 
            p.id === editingPaymentId ? { ...p, ...data, startDate: data.startDate.toISOString() } : p
        );
        toast({ title: "تم التحديث", description: "تم تحديث الدفعة الدورية بنجاح." });
    } else {
        const newPayment: RecurringPayment = { ...data, id: crypto.randomUUID(), startDate: data.startDate.toISOString() };
        updatedPayments = [...recurringPayments, newPayment];
        toast({ title: "تمت الإضافة", description: "تمت إضافة الدفعة الدورية بنجاح." });
    }

    setRecurringPayments(updatedPayments);
    recurringPaymentForm.reset({ title: "", amount: 0, category: "subscriptions", frequency: "monthly", startDate: new Date() });
    setIsRecurringPaymentDialogOpen(false);
    setEditingPaymentId(null);
  };
  
  const handleDeleteRecurringPayment = (id: string) => {
    setRecurringPayments(prev => prev.filter(p => p.id !== id));
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
    } catch (error) {
        toast({ title: 'خطأ', description: 'لم نتمكن من تسجيل خروجك.', variant: 'destructive' });
    }
  }

  // --- Data Import/Export & Reset ---
  const addMultipleExpensesMutation = useMutation({
    mutationFn: (newExpenses: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[]) => {
      if (!user) throw new Error("User not authenticated");
      const promises = newExpenses.map(exp => addExpense(user!.uid, exp));
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
    },
    onSettled: () => {
      setIsFileProcessing(false);
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
      'الفئة': categories.find(c => c.id === exp.category)?.name || exp.category,
      'التاريخ': new Date(exp.date),
      'الوصف': exp.description || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "تدبير");
    worksheet['!cols'] = [ { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 40 } ];
    XLSX.writeFile(workbook, "tadbeer-expenses.xlsx");
    toast({ title: "تم التصدير بنجاح", description: "تم تصدير بيانات مصاريفك إلى ملف Excel." });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileProcessing(true);
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
        setIsMappingColumns(true);
      } catch (error: any) {
        toast({ title: "فشل الاستيراد", description: error.message || "حدث خطأ أثناء قراءة الملف.", variant: "destructive" });
        setIsFileProcessing(false);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const processAndSaveExpenses = (columnMap: Record<string, number | null>) => {
      if (!user) return;
      setIsFileProcessing(true);
      const missingRequired = REQUIRED_FIELDS.filter(field => columnMap[field] === null || columnMap[field] === undefined);
      if (missingRequired.length > 0) {
          toast({ title: "حقول مطلوبة مفقودة", description: `يرجى ربط الحقول التالية: ${missingRequired.map(f => COLUMN_MAP_CONFIG[f as keyof typeof COLUMN_MAP_CONFIG].label).join(', ')}`, variant: "destructive" });
          setIsFileProcessing(false);
          return;
      }
      const categoryNameToIdMap = new Map<string, string>();
      categories.forEach((catData) => {
          const normalizedName = catData.name.trim().normalize("NFKD");
          categoryNameToIdMap.set(normalizedName, catData.id);
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
        setIsFileProcessing(false);
        return;
      }
      addMultipleExpensesMutation.mutate(newExpenses);
      localStorage.setItem(LOCAL_STORAGE_MAP_KEY, JSON.stringify(columnMap));
  };
  
  const defaultSettingsForReset = {
      budget: { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 },
      categoryBudgets: {},
      profile: {
          monthlyIncome: 0,
          familyMembers: [{ id: crypto.randomUUID(), type: 'adult', age: 30 }]
      },
      recurringPayments: [],
      appTone: 'formal' as AppTone,
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
            settingsToReset.budget = defaultSettingsForReset.budget;
            settingsToReset.categoryBudgets = defaultSettingsForReset.categoryBudgets;
            settingsToReset.recurringPayments = [];
        }
        if (options.profileSettings) {
            settingsToReset.profile = defaultSettingsForReset.profile;
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
        setIsDataResetOpen(false);
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

  const frequencyMap = {
    'monthly': 'شهري',
    'quarterly': 'ربع سنوي',
    'annually': 'سنوي',
    'one-time': 'مرة واحدة',
  };

  const AccordionItemWrapper = ({ icon, title, value, children }: { icon: React.ElementType, title: string, value: string, children: React.ReactNode }) => (
    <AccordionItem value={value} className="border-b-0">
      <Card>
        <AccordionTrigger className="hover:no-underline w-full p-0 text-sm font-medium">
          <CardHeader className="w-full py-3">
              <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-md text-primary">
                          {React.createElement(icon, { className: "h-4 w-4" })}
                      </div>
                      <h3 className="font-semibold text-sm">{title}</h3>
                  </div>
              </div>
          </CardHeader>
        </AccordionTrigger>
        <AccordionContent>
            <div className="border-t">
                <div className="p-4 space-y-6">
                    {children}
                </div>
            </div>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );

  const FormDialog = isMobile ? Sheet : Dialog;

  return (
    <div className="space-y-4 pb-20">

      {/* Account and Theme Section */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                 <div className="p-3 bg-primary/10 rounded-lg text-primary">
                    <Users className="h-5 w-5" />
                </div>
                <div>
                    <p className="font-semibold truncate max-w-[150px] sm:max-w-xs text-sm">{isAnonymous ? "حساب زائر" : user?.email}</p>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="link" className="p-0 h-auto text-xs text-destructive hover:no-underline flex items-center gap-1">
                                <LogOut className="h-3 w-3" />
                                تسجيل الخروج
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد من رغبتك في تسجيل الخروج؟</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={handleLogout}>تسجيل الخروج</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </CardContent>
        {isAnonymous && (
             <CardFooter className="p-0">
                 <Alert variant="destructive" className="border-0 border-t rounded-t-none">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitleComponent className="text-sm">بياناتك غير محفوظة!</AlertTitleComponent>
                    <AlertDescriptionComponent className="text-xs">للمزامنة بين أجهزتك، يرجى تسجيل الخروج وإنشاء حساب دائم.</AlertDescriptionComponent>
                </Alert>
             </CardFooter>
        )}
      </Card>
      
      <Accordion type="multiple" className="w-full space-y-2">
        <AccordionItemWrapper
          value="item-1"
          icon={Palette}
          title="المظهر والإشعارات"
        >
          <div className="space-y-6">
             <div>
                <h3 className="font-medium mb-3 text-sm">شخصية المدرب المالي</h3>
                <div className="grid grid-cols-2 gap-4">
                
                <div onClick={() => setAppTone('colloquial')} className={cn("rounded-lg border-2 p-3 flex items-center gap-3 cursor-pointer transition-all", appTone === 'colloquial' ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50')}>
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center overflow-hidden border text-primary">
                      <Handshake className="w-6 h-6" />
                    </div>
                    <div>
                    <h4 className="font-semibold text-sm">كرومي</h4>
                    <p className="text-xs text-muted-foreground">صديقك، نصائحه ودية.</p>
                    </div>
                </div>

                <div onClick={() => setAppTone('formal')} className={cn("rounded-lg border-2 p-3 flex items-center gap-3 cursor-pointer transition-all", appTone === 'formal' ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50')}>
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center overflow-hidden border text-primary">
                      <CircleDollarSign className="w-6 h-6" />
                    </div>
                    <div>
                    <h4 className="font-semibold text-sm">أستاذ حريص</h4>
                    <p className="text-xs text-muted-foreground">مدرب محترف ودقيق.</p>
                    </div>
                </div>
                </div>
             </div>
            
            <Separator />
            
            <div>
              <h3 className="font-medium mb-3 text-sm">الإشعارات</h3>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="daily-reminder" className="text-sm font-medium">
                    التذكير اليومي
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    إرسال إشعار يومي لتسجيل المصروفات.
                  </p>
                </div>
                <Switch
                  id="daily-reminder"
                  checked={dailyReminderEnabled}
                  onCheckedChange={handleDailyReminderChange}
                  aria-label="تفعيل التذكير اليومي"
                />
              </div>
            </div>
            
            <Button onClick={handleSaveAppearanceSettings} className="w-full text-xs h-9" disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending && <Loader2 className='ml-2 h-4 w-4 animate-spin' />}
              حفظ التغييرات
            </Button>
          </div>
        </AccordionItemWrapper>

        <AccordionItemWrapper 
          value="item-2"
          icon={Users}
          title="الملف الشخصي والدخل"
        >
            {/* Income Section */}
            <div className="space-y-4">
                <h3 className='text-sm font-medium'>إدارة الدخل</h3>
                
                <Card className="text-center bg-muted/50">
                    <CardContent className="p-3">
                        <Label className="text-xs">إجمالي الدخل الشهري المتكرر</Label>
                        <p className="text-xl font-bold text-primary">{formatNumberWithCommas(totalRecurringIncome)} د.ع</p>
                    </CardContent>
                </Card>

                <div>
                    <h4 className="font-medium mb-2 text-xs">مصادر الدخل الحالية</h4>
                    <div className="space-y-2">
                        {incomes.length === 0 ? (
                            <p className="text-muted-foreground text-center p-4 border rounded-lg bg-background text-xs">لا توجد مصادر دخل مسجلة.</p>
                        ) : (
                            <ul className="border rounded-lg max-h-60 overflow-y-auto bg-background">
                                {incomes.map(income => (
                                    <li key={income.id} className="flex items-center justify-between p-2.5 border-b last:border-b-0">
                                        <div className="flex items-center gap-3">
                                            <span className={cn("p-2 rounded-full", income.type === 'recurring' ? 'bg-primary/10 text-primary' : 'bg-green-100 dark:bg-green-900/50 dark:text-green-300 text-green-600')}>
                                                {income.type === 'recurring' ? <Repeat className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                                            </span>
                                            <div>
                                                <p className="font-semibold text-sm">{income.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {income.type === 'recurring' ? 'شهري' : `في ${format(new Date(income.date), 'd MMM yyyy', {locale: arIQ})}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className='flex items-center'>
                                            <p className="font-bold text-green-600 dark:text-green-400 whitespace-nowrap text-sm">{income.amount.toLocaleString()}&nbsp;د.ع</p>
                                            <div className="flex items-center gap-0">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditIncomeClick(income)} disabled={addIncomeMutation.isPending || updateIncomeMutation.isPending}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteIncomeMutation.mutate(income.id)} disabled={deleteIncomeMutation.isPending}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                 <FormDialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
                    <DialogTrigger asChild>
                    <Button className="w-full text-xs h-9" variant="outline" onClick={handleAddNewIncomeClick}><UserPlus className="ml-2 h-4 w-4" />إضافة مصدر دخل جديد</Button>
                    </DialogTrigger>
                    <SheetContent side="bottom" className="flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
                        <SheetHeader>
                            <SheetTitle className="text-sm">{editingIncomeId ? 'تعديل مصدر الدخل' : 'إضافة مصدر دخل جديد'}</SheetTitle>
                        </SheetHeader>
                        <div className="overflow-y-auto flex-1 p-6 pt-2">
                            <form onSubmit={incomeForm.handleSubmit(onIncomeSubmit)} className="space-y-4">
                                <div className="space-y-2"><Label htmlFor="income-title" className="text-xs">اسم المصدر</Label><Input id="income-title" {...incomeForm.register('title')} placeholder="مثال: راتب شهري، مشروع..." className="text-xs h-9" />{incomeForm.formState.errors.title && <p className="text-xs text-destructive mt-1">{incomeForm.formState.errors.title.message}</p>}</div>
                                <div className="space-y-2"><Label htmlFor="income-amount" className="text-xs">المبلغ (د.ع)</Label><Controller name="amount" control={incomeForm.control} render={({ field: { onChange, value, ...restField } }) => (<Input {...restField} id="income-amount" type="text" inputMode="decimal" placeholder="مثال: 1,500,000" className="text-xs h-9" value={value === 0 ? '' : formatNumberWithCommas(value)} onChange={(e) => { const parsed = parseFormattedNumber(e.target.value); if (parsed === '' || !isNaN(Number(parsed))) { onChange(parsed === '' ? 0 : Number(parsed)); } }} />)} />{incomeForm.formState.errors.amount && <p className="text-xs text-destructive mt-1">{incomeForm.formState.errors.amount.message}</p>}</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="income-type" className="text-xs">النوع</Label><Controller name="type" control={incomeForm.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="income-type" className="text-xs h-9"><SelectValue placeholder="اختر النوع" /></SelectTrigger><SelectContent><SelectItem value="recurring">شهري متكرر</SelectItem><SelectItem value="one-time">لمرة واحدة</SelectItem></SelectContent></Select>)} />{incomeForm.formState.errors.type && <p className="text-xs text-destructive mt-1">{incomeForm.formState.errors.type.message}</p>}</div>
                                    <div className="space-y-2"><Label className="text-xs">تاريخ الاستلام</Label><Controller name="date" control={incomeForm.control} render={({ field }) => (<Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal bg-background text-xs h-9", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: arIQ }) : <span>اختر تاريخاً</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus dir="rtl" locale={arIQ} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} /></PopoverContent></Popover>)} />{incomeForm.formState.errors.date && <p className="text-xs text-destructive mt-1">{incomeForm.formState.errors.date.message}</p>}</div>
                                </div>
                                <Button type="submit" className="w-full text-xs h-9" disabled={addIncomeMutation.isPending || updateIncomeMutation.isPending}>{(addIncomeMutation.isPending || updateIncomeMutation.isPending) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{editingIncomeId ? <><Save className="ml-2 h-4 w-4" /> تحديث</> : <><UserPlus className="ml-2 h-4 w-4" /> إضافة</>}</Button>
                            </form>
                        </div>
                    </SheetContent>
                </FormDialog>
            </div>

            <Separator />
            
            {/* Profile Section */}
            <div className="space-y-4">
                <h3 className='text-sm font-medium'>الملف الشخصي</h3>
                <div className="space-y-3">
                    <Label className="text-xs">أفراد الأسرة (بمن فيهم أنت)</Label>
                    <div className="space-y-3 rounded-lg border bg-background p-3">
                        {familyMembers.map((member, index) => (
                        <div key={member.id} className="flex items-center gap-2 animate-in fade-in">
                            <span className='text-muted-foreground text-xs'>{index + 1}.</span>
                            <Select value={member.type} onValueChange={(value) => handleMemberChange(member.id, 'type', value)}>
                                <SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="adult">بالغ</SelectItem>
                                    <SelectItem value="child">طفل</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input type="number" placeholder="العمر" value={member.age} onChange={(e) => handleMemberChange(member.id, 'age', parseInt(e.target.value) || 0)} className="w-[100px] h-9 text-xs" min="0" />
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member.id)} disabled={familyMembers.length <= 1}>
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                        </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={handleAddMember} className="w-full text-xs h-9"><UserPlus className="ml-2 h-4 w-4" />إضافة فرد</Button>
                    </div>
                </div>
                <Button onClick={handleSaveProfile} className="w-full text-xs h-9" disabled={updateSettingsMutation.isPending}>
                    {updateSettingsMutation.isPending && <Loader2 className='ml-2 h-4 w-4 animate-spin' />}
                    حفظ الملف الشخصي
                </Button>
            </div>
        </AccordionItemWrapper>

        <AccordionItemWrapper
            value="item-3"
            icon={SlidersHorizontal}
            title="إدارة الميزانية والفئات"
        >
             {/* Budget & Goals */}
            <div className="space-y-4">
                 <h3 className='text-sm font-medium'>الميزانية والأهداف</h3>
                <div className="space-y-2"><Label htmlFor="totalBudget" className="text-xs">إجمالي الميزانية الشهرية (د.ع)</Label><Input id="totalBudget" type="text" inputMode="decimal" className="h-9 text-sm" value={totalBudgetInput} onChange={handleNumericInputChange(setTotalBudgetInput)} onFocus={(e) => { if (e.target.value === '0') setTotalBudgetInput(''); }} onBlur={(e) => { if (parseFormattedNumber(e.target.value) === '') setTotalBudgetInput('0'); }} placeholder="مثال: 5,000,000" /></div>
                <div className="space-y-2"><Label htmlFor="zeroSpendDaysTarget" className="text-xs">الهدف لأيام الإنفاق المنخفض (شهرياً)</Label><Input id="zeroSpendDaysTarget" type="number" className="h-9 text-sm" value={zeroSpendDaysTargetInput} onChange={(e) => setZeroSpendDaysTargetInput(e.target.value)} onFocus={(e) => { if (e.target.value === '0') setZeroSpendDaysTargetInput(''); }} onBlur={(e) => { if (e.target.value === '') setZeroSpendDaysTargetInput('0'); }} placeholder="مثال: 4" min="0" /></div>
            </div>
            
            <Separator />

            {/* Category Management */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">إدارة الفئات</h3>
              <div className="border rounded-lg p-2 space-y-2 max-h-72 overflow-y-auto">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getIconComponent(cat.icon)}</span>
                      <span className="text-sm">{cat.name}</span>
                      {cat.isDefault && <span className="text-xs text-muted-foreground">(افتراضي)</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCategory(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!cat.isDefault && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف هذه الفئة. المصاريف المسجلة تحتها ستبقى لكن لن تتمكن من اختيار هذه الفئة مستقبلاً.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCategory(cat.id)}>نعم، قم بالحذف</AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full text-xs h-9" onClick={handleAddNewCategory}>
                <UserPlus className="ml-2 h-4 w-4" /> إضافة فئة جديدة
              </Button>
            </div>
            
            <Separator />
            
            {/* Category Budgets */}
            <div className="space-y-4">
                 <h3 className='text-sm font-medium'>ميزانيات الفئات</h3>
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-3 -mr-3 bg-background border rounded-lg p-3">
                    {categories.map((category) => (
                        <div key={category.id} className="flex items-center gap-4">
                            <span className="flex items-center gap-2 w-1/3 text-sm"><span className="text-lg">{getIconComponent(category.icon)}</span><Label htmlFor={`category-${category.id}`} className="text-xs">{category.name}</Label></span>
                            <Input id={`category-${category.id}`} type="text" inputMode="decimal" value={categoryBudgets[category.id] || ''} onChange={(e) => handleCategoryBudgetChange(category.id, e.target.value)} onFocus={(e) => { if (e.target.value === '0') handleCategoryBudgetChange(category.id, ''); }} onBlur={(e) => { if (parseFormattedNumber(e.target.value) === '') handleCategoryBudgetChange(category.id, '0'); }} placeholder="0" className="flex-1 h-9 text-sm" />
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Recurring Payments */}
            <div className="space-y-4">
                <h3 className='text-sm font-medium'>الدفعات الدورية</h3>
                <div>
                     <h4 className="font-medium mb-2 text-xs">الدفعات الحالية</h4>
                    <div className="space-y-2">
                        {recurringPayments.length === 0 ? (
                            <p className="text-muted-foreground text-center p-4 border rounded-lg bg-background text-xs">لا توجد دفعات متكررة مسجلة.</p>
                        ) : (
                            <ul className="border rounded-lg max-h-60 overflow-y-auto bg-background">
                                {recurringPayments.map(p => (
                                    <li key={p.id} className="flex items-center justify-between p-2.5 border-b last:border-b-0">
                                        <div className="flex-1"><p className="font-semibold text-sm">{p.title}</p><p className="text-xs text-muted-foreground">{frequencyMap[p.frequency]} - يبدأ من {format(new Date(p.startDate), 'd MMM yyyy', {locale: arIQ})}</p></div>
                                        <div className='flex items-center'><p className="font-semibold text-foreground whitespace-nowrap text-sm">{p.amount.toLocaleString()}&nbsp;د.ع</p><div className="flex items-center gap-0"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditPaymentClick(p)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteRecurringPayment(p.id)}><Trash2 className="h-4 w-4" /></Button></div></div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                <FormDialog open={isRecurringPaymentDialogOpen} onOpenChange={setIsRecurringPaymentDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full text-xs h-9" variant="outline" onClick={handleAddNewPaymentClick}><UserPlus className="ml-2 h-4 w-4" />إضافة دفعة دورية جديدة</Button>
                    </DialogTrigger>
                    <SheetContent side="bottom" className="flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
                        <SheetHeader>
                            <SheetTitle className="text-sm">{editingPaymentId ? 'تعديل الدفعة الدورية' : 'إضافة دفعة دورية جديدة'}</SheetTitle>
                        </SheetHeader>
                        <div className="overflow-y-auto flex-1 p-6 pt-2">
                            <form onSubmit={recurringPaymentForm.handleSubmit(handleSaveRecurringPayment)} className="space-y-4">
                                <div className="space-y-2"><Label htmlFor="rp-title" className="text-xs">اسم الدفعة</Label><Input id="rp-title" className="text-xs h-9" {...recurringPaymentForm.register('title')} placeholder="مثال: قسط السيارة، إيجار المنزل" />{recurringPaymentForm.formState.errors.title && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.title.message}</p>}</div>
                                <div className="space-y-2"><Label htmlFor="rp-amount" className="text-xs">المبلغ (د.ع)</Label><Controller name="amount" control={recurringPaymentForm.control} render={({ field: { onChange, value, ...restField } }) => ( <Input {...restField} id="rp-amount" className="text-xs h-9" type="text" inputMode="decimal" value={value === 0 ? '' : formatNumberWithCommas(value)} onChange={(e) => { const parsed = parseFormattedNumber(e.target.value); if (parsed === '' || !isNaN(Number(parsed))) { onChange(parsed === '' ? 0 : Number(parsed)); } }} /> )}/>{recurringPaymentForm.formState.errors.amount && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.amount.message}</p>}</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="rp-frequency" className="text-xs">تكرار الدفعة</Label><Controller name="frequency" control={recurringPaymentForm.control} render={({ field }) => ( <Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="rp-frequency" className="text-xs h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">شهرياً</SelectItem><SelectItem value="quarterly">ربع سنوياً</SelectItem><SelectItem value="annually">سنوياً</SelectItem><SelectItem value="one-time">مرة واحدة</SelectItem></SelectContent></Select> )}/>{recurringPaymentForm.formState.errors.frequency && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.frequency.message}</p>}</div>
                                    <div className="space-y-2"><Label className="text-xs">تاريخ أول دفعة</Label><Controller name="startDate" control={recurringPaymentForm.control} render={({ field }) => ( <Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal bg-background text-xs h-9", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: arIQ }) : <span>اختر تاريخاً</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus dir="rtl" locale={arIQ} /></PopoverContent></Popover> )}/>{recurringPaymentForm.formState.errors.startDate && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.startDate.message}</p>}</div>
                                </div>
                                <div className="space-y-2"><Label htmlFor="rp-category" className="text-xs">تصنيف المصروف</Label><Controller name="category" control={recurringPaymentForm.control} render={({ field }) => ( <Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="rp-category" className="text-xs h-9"><SelectValue placeholder="اختر فئة..." /></SelectTrigger><SelectContent>{categories.map((cat) => ( <SelectItem key={cat.id} value={cat.id}>{getIconComponent(cat.icon)} {cat.name}</SelectItem> ))}</SelectContent></Select> )}/>{recurringPaymentForm.formState.errors.category && <p className="text-sm text-destructive mt-1">{recurringPaymentForm.formState.errors.category.message}</p>}</div>
                                <Button type="submit" className="w-full text-xs h-9" disabled={updateSettingsMutation.isPending}>{updateSettingsMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{editingPaymentId ? <><Save className="ml-2 h-4 w-4" /> تحديث الدفعة</> : <><UserPlus className="ml-2 h-4 w-4" /> إضافة الدفعة</>}</Button>
                            </form>
                        </div>
                    </SheetContent>
                </FormDialog>
            </div>
             <Separator />
            <Button onClick={handleSaveBudgetSettings} className="w-full text-xs h-9" disabled={updateSettingsMutation.isPending}>
                {updateSettingsMutation.isPending && <Loader2 className='ml-2 h-4 w-4 animate-spin' />}
                حفظ تغييرات الميزانية
            </Button>
        </AccordionItemWrapper>

         <AccordionItemWrapper
            value="item-4"
            icon={DatabaseZap}
            title="إدارة البيانات"
        >
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button className="w-full text-xs h-9" variant="outline" onClick={handleExport} disabled={!expenses || expenses.length === 0}>تصدير البيانات (Excel)</Button>
                <Button className="w-full text-xs h-9" variant="outline" onClick={handleImportClick} disabled={isFileProcessing}>
                  {isFileProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  استيراد البيانات (Excel)
                </Button>
                <Input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
             </div>
             
             <Separator />

             <div>
                 <h4 className='font-medium text-sm'>حذف وتصفير البيانات</h4>
                 <p className="text-xs text-muted-foreground mb-2">حذف البيانات بشكل دائم. لا يمكن التراجع عن هذا الإجراء.</p>
                <Dialog open={isDataResetOpen} onOpenChange={setIsDataResetOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full text-xs h-9" variant="destructive"><Trash2 className="ml-2 h-4 w-4" />حذف وتصفير البيانات</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle className="text-base">حذف وتصفير البيانات</DialogTitle><DialogDescription className="text-xs">اختر البيانات التي ترغب في حذفها بشكل دائم. لا يمكن التراجع عن هذا الإجراء.</DialogDescription></DialogHeader>
                        <div className="space-y-4 py-4 text-sm">
                            <div className="font-semibold text-foreground">بيانات المعاملات:</div>
                            <div className="flex items-center space-x-2 space-x-reverse pl-4"><Checkbox id="delete-expenses" checked={deleteOptions.expenses} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, expenses: !!checked}))} /><Label htmlFor="delete-expenses" className="font-normal text-xs">حذف جميع المصاريف</Label></div>
                            <div className="flex items-center space-x-2 space-x-reverse pl-4"><Checkbox id="delete-goals" checked={deleteOptions.goals} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, goals: !!checked}))} /><Label htmlFor="delete-goals" className="font-normal text-xs">حذف جميع الأهداف المالية</Label></div>
                            <div className="flex items-center space-x-2 space-x-reverse pl-4"><Checkbox id="delete-incomes" checked={deleteOptions.incomes} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, incomes: !!checked}))} /><Label htmlFor="delete-incomes" className="font-normal text-xs">حذف جميع مصادر الدخل</Label></div>
                            <Separator />
                            <div className="font-semibold text-foreground">بيانات الإعدادات:</div>
                            <div className="flex items-center space-x-2 space-x-reverse pl-4"><Checkbox id="delete-budget-settings" checked={deleteOptions.budgetSettings} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, budgetSettings: !!checked}))} /><Label htmlFor="delete-budget-settings" className="font-normal text-xs">تصفير إعدادات الميزانية والدفعات المتكررة</Label></div>
                            <div className="flex items-center space-x-2 space-x-reverse pl-4"><Checkbox id="delete-profile-settings" checked={deleteOptions.profileSettings} onCheckedChange={(checked) => setDeleteOptions(prev => ({...prev, profileSettings: !!checked}))} /><Label htmlFor="delete-profile-settings" className="font-normal text-xs">تصفير الملف الشخصي</Label></div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsDataResetOpen(false)} className="text-xs h-9">إلغاء</Button>
                            <Button variant="destructive" onClick={handleCustomDelete} disabled={!Object.values(deleteOptions).some(v => v) || resetDataMutation.isPending} className="text-xs h-9">{resetDataMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}نعم، قم بالحذف</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
             </div>
        </AccordionItemWrapper>
         
        <AccordionItemWrapper
            value="item-5"
            icon={Info}
            title={`حول التطبيق - إصدار ${version}`}
        >
          <div className="p-4 text-center space-y-4">
              <FeedbackDialog 
                isOpen={isFeedbackOpen}
                setIsOpen={setIsFeedbackOpen}
                isMobile={isMobile}
              />
            <p className="text-sm text-muted-foreground">جميع الحقوق محفوظة لشركة تدبير © {new Date().getFullYear()}</p>
          </div>
        </AccordionItemWrapper>
      </Accordion>
      
      <MappingDialog
        isOpen={isMappingColumns}
        setIsOpen={setIsMappingColumns}
        isMobile={isMobile}
        fileHeaders={fileHeaders}
        processAndSave={processAndSaveExpenses}
        isProcessing={addMultipleExpensesMutation.isPending}
      />

       <CategoryEditDialog
            key={editingCategory?.id || 'new'}
            isOpen={isCategoryDialogOpen}
            setIsOpen={setIsCategoryDialogOpen}
            isMobile={isMobile}
            onSave={handleSaveCategory}
            category={editingCategory}
        />
      
    </div>
  );
}

