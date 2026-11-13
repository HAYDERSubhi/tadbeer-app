// src/app/api/receipt/route.ts
// Dedicated API route for receipt OCR analysis — isolated maxDuration so
// Vercel applies the full 60s budget. Server actions are capped at 10s,
// which multi-image Gemini analysis routinely exceeds (same fix pattern
// as /api/chat and /api/voice).

import { analyzeDetailedReceipt } from '@/ai/flows/analyze-detailed-receipt';
import { guardAiRequest } from '@/lib/api-auth';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // نموذج مدفوع — لا يُنادى بلا هوية مُتحقَّق منها. راجع lib/api-auth.ts.
  // هوية + حدّ يومي (سلّة active) — راجع guardAiRequest.
  const guard = await guardAiRequest(request, 'active', '/api/receipt');
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const data = await analyzeDetailedReceipt(body);
    return Response.json({ ok: true, data });
  } catch (error) {
    // ⛔ نصّ الخطأ الأصلي يُسجَّل في الخادم ولا يُعاد للهاتف — guard.fail يصنّفه
    //    إلى رسالة آمنة (ومنها «الخدمات الذكية متوقفة مؤقتاً» عند نفاد الرصيد).
    return Response.json(await guard.fail(error), { status: 200 });
  }
}
