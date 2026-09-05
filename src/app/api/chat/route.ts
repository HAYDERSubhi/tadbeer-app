// src/app/api/chat/route.ts
// Dedicated API route for مستشار الجيب — keeps maxDuration isolated here
// so it doesn't depend on layout-level config inheritance which can be
// unreliable for Vercel serverless functions.

import { financialChat } from '@/ai/flows/financial-chat';
import { requireUser } from '@/lib/api-auth';

// Gemini 2.5-flash can take up to 20–25s on a cold start with a long prompt.
// 60s gives plenty of headroom on Vercel Hobby plan (max 60s).
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // نموذج مدفوع — لا يُنادى بلا هوية مُتحقَّق منها. راجع lib/api-auth.ts.
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const data = await financialChat(body);
    return Response.json({ ok: true, data });
  } catch (error) {
    console.error('[/api/chat] Error:', error);
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
