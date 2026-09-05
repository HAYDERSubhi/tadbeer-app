// src/app/api/voice/route.ts
// Dedicated API route for voice-to-expense — isolated maxDuration so Vercel
// applies the full 60s budget instead of the unreliable layout-level default.

import { recordExpenseWithVoice } from '@/ai/flows/record-expense-voice';
import { requireUser } from '@/lib/api-auth';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // نموذج مدفوع — لا يُنادى بلا هوية مُتحقَّق منها. راجع lib/api-auth.ts.
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const data = await recordExpenseWithVoice(body);
    return Response.json({ ok: true, data });
  } catch (error) {
    console.error('[/api/voice] Error:', error);
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
