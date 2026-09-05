// src/app/api/receipt/route.ts
// Dedicated API route for receipt OCR analysis — isolated maxDuration so
// Vercel applies the full 60s budget. Server actions are capped at 10s,
// which multi-image Gemini analysis routinely exceeds (same fix pattern
// as /api/chat and /api/voice).

import { analyzeDetailedReceipt } from '@/ai/flows/analyze-detailed-receipt';
import { requireUser } from '@/lib/api-auth';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // نموذج مدفوع — لا يُنادى بلا هوية مُتحقَّق منها. راجع lib/api-auth.ts.
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const data = await analyzeDetailedReceipt(body);
    return Response.json({ ok: true, data });
  } catch (error) {
    console.error('[/api/receipt] Error:', error);
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
