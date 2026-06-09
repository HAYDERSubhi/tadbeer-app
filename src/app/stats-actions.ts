// src/app/stats-actions.ts
'use server';

/**
 * Isolated server actions for statistics computation ONLY.
 * Deliberately kept free of any Genkit imports so that a Genkit
 * initialisation failure never blocks the stats charts.
 *
 * Financial-coach action lives in actions.ts (with the other Genkit flows).
 */

import {
    getStatsSummary,
    type GetStatsSummaryInput,
    type GetStatsSummaryOutput,
} from '@/ai/flows/get-stats-summary';

export async function getStatsSummaryAction(
    input: GetStatsSummaryInput
): Promise<GetStatsSummaryOutput> {
    return getStatsSummary(input);
}
