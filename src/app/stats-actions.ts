// src/app/stats-actions.ts
'use server';

/**
 * Isolated server actions for statistics and financial coaching.
 * Kept separate from actions.ts so that a Genkit initialisation failure
 * in another flow does NOT prevent these actions from running.
 */

import {
    getStatsSummary,
    type GetStatsSummaryInput,
    type GetStatsSummaryOutput,
} from '@/ai/flows/get-stats-summary';

import {
    financialCoach,
    type FinancialCoachInput,
    type FinancialCoachOutput,
} from '@/ai/flows/financial-coach';

export async function getStatsSummaryAction(
    input: GetStatsSummaryInput
): Promise<GetStatsSummaryOutput> {
    return getStatsSummary(input);
}

export async function financialCoachAction(
    input: FinancialCoachInput
): Promise<FinancialCoachOutput> {
    return financialCoach(input);
}
