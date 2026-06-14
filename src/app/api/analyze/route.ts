// src/app/api/analyze/route.ts
// Dedicated API route for spending analysis — maxDuration 60s instead of 10s default.

import { analyzeSpendingPatterns } from '@/ai/flows/analyze-spending-patterns';

export const maxDuration = 60;

export async function POST(request: Request) {
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
