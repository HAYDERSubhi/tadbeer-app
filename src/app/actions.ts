// src/app/actions.ts
'use server';

import {
  financialCoach,
  type FinancialCoachInput,
  type FinancialCoachOutput,
} from '@/ai/flows/financial-coach';
import {
  financialChat,
  type FinancialChatInput,
  type FinancialChatOutput,
} from '@/ai/flows/financial-chat';
import {
  recordExpenseWithText,
  type RecordExpenseWithTextInput,
  type RecordExpenseWithTextOutput,
} from '@/ai/flows/record-expense-text';
import {
  analyzeSpendingPatterns,
  type AnalyzeSpendingPatternsInput,
  type AnalyzeSpendingPatternsOutput,
  type AnalyzeSpendingPatternsResult,
} from '@/ai/flows/analyze-spending-patterns';
import {
    getStatsSummary,
    type GetStatsSummaryInput,
    type GetStatsSummaryOutput,
} from '@/ai/flows/get-stats-summary';
import {
  recordExpenseWithVoice,
  type RecordExpenseWithVoiceInput,
  type RecordExpenseWithVoiceOutput,
} from '@/ai/flows/record-expense-voice';

/**
 * A Server Action to securely call the financialCoach AI flow from the client.
 * Wrapping it here (instead of calling the flow directly) ensures consistent
 * serialization behaviour across all deployment environments.
 */
export async function financialCoachAction(
  input: FinancialCoachInput
): Promise<FinancialCoachOutput> {
  try {
    const result = await financialCoach(input);
    return result;
  } catch (error) {
    console.error('Error in financialCoachAction:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to get financial coach insights: ${error.message}`);
    }
    throw new Error('An unknown error occurred in the financial coach.');
  }
}

/**
 * A Server Action to securely call the recordExpenseWithText AI flow from the client.
 *
 * Returns a discriminated result object instead of throwing, because Next.js
 * strips thrown error messages in production builds (replacing them with a
 * generic "Server Components render" message). Returning the error as a value
 * lets the real message cross the server/client boundary intact.
 */
export type RecordExpenseActionResult =
  | { ok: true; data: RecordExpenseWithTextOutput }
  | { ok: false; error: string };

export async function recordExpenseAction(
  input: RecordExpenseWithTextInput
): Promise<RecordExpenseActionResult> {
  try {
    const data = await recordExpenseWithText(input);
    return { ok: true, data };
  } catch (error) {
    console.error('Error in recordExpenseAction:', error);
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    return { ok: false, error: message };
  }
}

/**
 * A Server Action to call the voice-to-expense AI flow.
 *
 * Returns a discriminated result object instead of throwing, because Next.js
 * strips thrown error messages in production builds (replacing them with a
 * generic "Server Components render" message). Returning the error as a value
 * lets the real message cross the server/client boundary intact.
 */
export type VoiceActionResult =
  | { ok: true; data: RecordExpenseWithVoiceOutput }
  | { ok: false; error: string };

export async function recordExpenseWithVoiceAction(
  input: RecordExpenseWithVoiceInput
): Promise<VoiceActionResult> {
  try {
    const data = await recordExpenseWithVoice(input);
    return { ok: true, data };
  } catch (error) {
    console.error('Error in recordExpenseWithVoiceAction:', error);
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    return { ok: false, error: message };
  }
}


/**
 * A Server Action to securely call the analyzeSpendingPatterns AI flow from the client.
 */
export async function analyzeSpendingPatternsAction(
  input: AnalyzeSpendingPatternsInput
): Promise<AnalyzeSpendingPatternsResult> {
  try {
    return await analyzeSpendingPatterns(input);
  } catch (error) {
    console.error('Error in analyzeSpendingPatternsAction:', error);
    return null; // Return null on error instead of throwing — UI handles it gracefully
  }
}

/**
 * A Server Action for the multi-turn financial chat assistant.
 */
export type FinancialChatActionResult =
  | { ok: true; data: FinancialChatOutput }
  | { ok: false; error: string };

export async function financialChatAction(
  input: FinancialChatInput
): Promise<FinancialChatActionResult> {
  try {
    const data = await financialChat(input);
    return { ok: true, data };
  } catch (error) {
    console.error('Error in financialChatAction:', error);
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ok: false, error: message };
  }
}

/**
 * A Server Action for cross-month trend analysis.
 */
import {
  analyzeMonthlyTrends,
  type AnalyzeMonthlyTrendsInput,
  type AnalyzeMonthlyTrendsOutput,
} from '@/ai/flows/analyze-monthly-trends';

export async function analyzeMonthlyTrendsAction(
  input: AnalyzeMonthlyTrendsInput
): Promise<AnalyzeMonthlyTrendsOutput> {
  try {
    return await analyzeMonthlyTrends(input);
  } catch (error) {
    console.error('Error in analyzeMonthlyTrendsAction:', error);
    throw new Error('Failed to analyze monthly trends.');
  }
}

/**
 * A Server Action to securely call the getStatsSummary flow from the client.
 */
export async function getStatsSummaryAction(
  input: GetStatsSummaryInput
): Promise<GetStatsSummaryOutput> {
    try {
        const result = await getStatsSummary(input);
        return result;
    } catch (error) {
        console.error('Error in getStatsSummaryAction:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to get stats summary: ${error.message}`);
        }
        throw new Error('An unknown error occurred while getting stats summary.');
    }
}
