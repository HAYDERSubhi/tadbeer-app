// src/app/actions.ts
'use server';

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
 */
export async function recordExpenseWithVoiceAction(
  input: RecordExpenseWithVoiceInput
): Promise<RecordExpenseWithVoiceOutput> {
  try {
    const result = await recordExpenseWithVoice(input);
    return result;
  } catch (error) {
    console.error('Error in recordExpenseWithVoiceAction:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to process voice expense: ${error.message}`);
    }
    throw new Error('An unknown error occurred while processing the voice command.');
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
