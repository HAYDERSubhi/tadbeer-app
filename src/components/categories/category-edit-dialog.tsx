// src/components/categories/category-edit-dialog.tsx
"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';
import { CATEGORY_ICON_MAP, CATEGORY_ICON_NAMES } from '@/lib/category-icons';

export const categorySchema = z.object({
  name: z.string().min(2, "الاسم مطلوب (حرفين على الأقل)").max(25, "الاسم طويل جدًا"),
  icon: z.string().min(1, "اختر أيقونة"),
});
export type CategoryFormData = z.infer<typeof categorySchema>;

export const CategoryEditDialog = ({
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

  const selectedIcon = form.watch('icon');

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
              <Label className="text-xs">اختر أيقونة</Label>
              <div className="grid grid-cols-6 gap-1.5 max-h-52 overflow-y-auto p-0.5">
                {CATEGORY_ICON_NAMES.map((name) => {
                  const Icon = CATEGORY_ICON_MAP[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => form.setValue('icon', name, { shouldValidate: true })}
                      className={cn(
                        "flex items-center justify-center h-10 rounded-lg transition-all active:scale-90 select-none",
                        selectedIcon === name
                          ? 'bg-primary/15 ring-2 ring-primary text-primary'
                          : 'bg-muted/60 hover:bg-muted text-foreground/70'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
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
