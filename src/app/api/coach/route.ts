// src/app/api/coach/route.ts
// Dedicated API route for financial coach — isolated maxDuration so Vercel
// applies the full 60s budget instead of the 10s server-action default.

import { financialCoach } from '@/ai/flows/financial-coach';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await financialCoach(body);
    return Response.json({ ok: true, data });
  } catch (error) {
    console.error('[/api/coach] Error:', error);
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
