// src/app/actions.ts
'use server';

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
import {
  parseBankSms,
  type ParseBankSmsInput,
  type ParseBankSmsOutput,
} from '@/ai/flows/parse-bank-sms';

/**
 * A Server Action to securely call the recordExpenseWithText AI flow from the client.
 */
export async function recordExpenseAction(
  input: RecordExpenseWithTextInput
): Promise<RecordExpenseWithTextOutput> {
  try {
    const result = await recordExpenseWithText(input);
    return result;
  } catch (error) {
    console.error('Error in recordExpenseAction:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to process expense: ${error.message}`);
    }
    throw new Error('An unknown error occurred while processing the expense.');
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
 * A Server Action to parse a bank SMS / notification into a structured expense.
 * Returns a discriminated result so the real error survives production builds.
 */
export type BankSmsActionResult =
  | { ok: true; data: ParseBankSmsOutput }
  | { ok: false; error: string };

export async function parseBankSmsAction(
  input: ParseBankSmsInput
): Promise<BankSmsActionResult> {
  try {
    const data = await parseBankSms(input);
    return { ok: true, data };
  } catch (error) {
    console.error('Error in parseBankSmsAction:', error);
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ok: false, error: message };
  }
}

/**
 * A Server Action to securely call the analyzeSpendingPatterns AI flow from the client.
 */
export async function analyzeSpendingPatternsAction(
  input: AnalyzeSpendingPatternsInput
): Promise<AnalyzeSpendingPatternsOutput> {
  try {
    const result = await analyzeSpendingPatterns(input);
    return result;
  } catch (error) {
    console.error('Error in analyzeSpendingPatternsAction:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to analyze spending: ${error.message}`);
    }
    throw new Error('An unknown error occurred while analyzing spending.');
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
