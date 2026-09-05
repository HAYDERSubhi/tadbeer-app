// src/app/api/analyze/route.ts
// Dedicated API route for spending analysis — maxDuration 60s instead of 10s default.

import { analyzeSpendingPatterns } from '@/ai/flows/analyze-spending-patterns';
import { requireUser } from '@/lib/api-auth';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // نموذج مدفوع — لا يُنادى بلا هوية مُتحقَّق منها. راجع lib/api-auth.ts.
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const data = await analyzeSpendingPatterns(body);
    return Response.json({ ok: true, data });
  } catch (error) {
    console.error('[/api/analyze] Error:', error);
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
