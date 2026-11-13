// src/app/api/analyze/route.ts
// Dedicated API route for spending analysis — maxDuration 60s instead of 10s default.

import { analyzeSpendingPatterns } from '@/ai/flows/analyze-spending-patterns';
import { guardAiRequest } from '@/lib/api-auth';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // نموذج مدفوع — لا يُنادى بلا هوية مُتحقَّق منها. راجع lib/api-auth.ts.
  // هوية + حدّ يومي (سلّة passive) — راجع guardAiRequest.
  const guard = await guardAiRequest(request, 'passive', '/api/analyze');
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const data = await analyzeSpendingPatterns(body);
    return Response.json({ ok: true, data });
  } catch (error) {
    // ⛔ نصّ الخطأ الأصلي يُسجَّل في الخادم ولا يُعاد للهاتف — guard.fail يصنّفه
    //    إلى رسالة آمنة (ومنها «الخدمات الذكية متوقفة مؤقتاً» عند نفاد الرصيد).
    return Response.json(await guard.fail(error), { status: 200 });
  }
}
