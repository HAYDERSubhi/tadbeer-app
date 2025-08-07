"use client"

import * as React from "react"
import {
  Palette,
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
  
  return (
    <div className="container mx-auto p-4 sm:p-8 space-y-8" dir="rtl">
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight">معاينة الألوان</h1>
        <p className="text-muted-foreground text-lg">
          صفحة بسيطة لعرض الألوان المعتمدة في التصميم.
        </p>
      </header>
      
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

      <section>
        <h2 className="text-2xl font-bold mb-4">الخطوط والنصوص</h2>
        <div className="space-y-4 p-4 rounded-lg" style={{backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))'}}>
          <h1>h1. هذا عنوان من المستوى الأول</h1>
          <p>p. هذا هو النص الأساسي للتطبيق، يستخدم في معظم الفقرات.</p>
          <p className="text-sm text-muted-foreground">p.text-sm.muted. هذا نص أصغر للملاحظات والمعلومات الثانوية.</p>
        </div>
      </section>

    </div>
  )
}
