// src/hooks/use-keyboard-fit.ts
// يُبقي الورقة السفلية (Sheet) مرئية فوق لوحة المفاتيح على الهاتف.
//
// لماذا: لوحة المفاتيح على أندرويد تصغّر `visualViewport` وحده لا نافذة التخطيط،
// فورقة مثبّتة بأسفل الشاشة يُقصّ رأسها أو يُدفَع خارج النظر. يعيد هذا الخطّاف
// المسافة التي يجب رفع الورقة بها (`bottom`) وارتفاع المساحة المرئية (`height`).
//
// نُقل هنا 2026-11-14 من quick-budget-setup-sheet.tsx ليُستعمل أيضاً في معالج
// الترحيب (كان رأسه يختفي عند فتح اللوحة). ⛔ مصدر واحد — لا تنسخه داخل مكوّن.
import { useEffect, useState } from "react";

export function useKeyboardFit(active: boolean) {
  const [box, setBox] = useState<{ bottom: number; height: number } | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () =>
      setBox({
        bottom: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
        height: Math.round(vv.height),
      });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setBox(null);
    };
  }, [active]);
  return box;
}
