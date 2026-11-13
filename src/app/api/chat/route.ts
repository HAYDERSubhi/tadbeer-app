// src/app/api/chat/route.ts
// Dedicated API route for مستشار الجيب — keeps maxDuration isolated here
// so it doesn't depend on layout-level config inheritance which can be
// unreliable for Vercel serverless functions.

import { financialChat } from '@/ai/flows/financial-chat';
import { guardAiRequest } from '@/lib/api-auth';

// Gemini 2.5-flash can take up to 20–25s on a cold start with a long prompt.
// 60s gives plenty of headroom on Vercel Hobby plan (max 60s).
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // نموذج مدفوع — لا يُنادى بلا هوية مُتحقَّق منها. راجع lib/api-auth.ts.
  // هوية + حدّ يومي (سلّة active) — راجع guardAiRequest.
  const guard = await guardAiRequest(request, 'active', '/api/chat');
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const data = await financialChat(body);
    return Response.json({ ok: true, data });
  } catch (error) {
    // ⛔ نصّ الخطأ الأصلي يُسجَّل في الخادم ولا يُعاد للهاتف — guard.fail يصنّفه
    //    إلى رسالة آمنة (ومنها «الخدمات الذكية متوقفة مؤقتاً» عند نفاد الرصيد).
    return Response.json(await guard.fail(error), { status: 200 });
  }
}
