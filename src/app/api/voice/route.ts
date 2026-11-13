// src/app/api/voice/route.ts
// Dedicated API route for voice-to-expense — isolated maxDuration so Vercel
// applies the full 60s budget instead of the unreliable layout-level default.

import { recordExpenseWithVoice } from '@/ai/flows/record-expense-voice';
import { guardAiRequest } from '@/lib/api-auth';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // نموذج مدفوع — لا يُنادى بلا هوية مُتحقَّق منها. راجع lib/api-auth.ts.
  // هوية + حدّ يومي (سلّة active) — راجع guardAiRequest.
  const guard = await guardAiRequest(request, 'active', '/api/voice');
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const data = await recordExpenseWithVoice(body);
    return Response.json({ ok: true, data });
  } catch (error) {
    // ⛔ نصّ الخطأ الأصلي يُسجَّل في الخادم ولا يُعاد للهاتف — guard.fail يصنّفه
    //    إلى رسالة آمنة (ومنها «الخدمات الذكية متوقفة مؤقتاً» عند نفاد الرصيد).
    return Response.json(await guard.fail(error), { status: 200 });
  }
}
