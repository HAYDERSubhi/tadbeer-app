
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => {
  // القيمة محصورة بين 0 و100 — قيمة خارج المدى كانت تُخرِج الشريط عن إطاره.
  const pct = Math.min(Math.max(value ?? 0, 0), 100);

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      {/* التعبئة تبدأ من `start` لا من اليسار، فتمتلئ من اليمين في الواجهة
          العربية تلقائياً. النسخة السابقة كانت تزيح العنصر بـ translateX،
          وهي إزاحة فيزيائية لا تنقلب مع اتجاه اللغة، فكان الشريط يمتلئ من
          اليسار في كل الشاشات. نفس نمط شريطَي الميزانية و«سفراتي». */}
      <ProgressPrimitive.Indicator
        className={cn("absolute inset-y-0 start-0 bg-primary transition-all", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </ProgressPrimitive.Root>
  );
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }

    
