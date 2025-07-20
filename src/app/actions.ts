// src/app/actions.ts
'use server';

import {
  recordExpenseWithText,
  type RecordExpenseWithTextInput,
  type RecordExpenseWithTextOutput,
} from '@/ai/flows/record-expense-text';
import {
  categorizeExpenseText,
  type CategorizeExpenseTextInput,
  type CategorizeExpenseTextOutput,
} from '@/ai/flows/categorize-expense-text';

/**
 * A Server Action to securely call the recordExpenseWithText AI flow from the client.
 * This acts as a safe bridge between the client component and the server-side AI logic.
 */
export async function recordExpenseAction(
  input: RecordExpenseWithTextInput
): Promise<RecordExpenseWithTextOutput> {
  try {
    const result = await recordExpenseWithText(input);
    return result;
  } catch (error) {
    console.error('Error in recordExpenseAction:', error);
    // Re-throw the error to be caught by the client's try-catch block
    if (error instanceof Error) {
      throw new Error(`Failed to process expense: ${error.message}`);
    }
    throw new Error('An unknown error occurred while processing the expense.');
  }
}

/**
 * A Server Action to get a category suggestion for a given expense title.
 */
export async function categorizeExpenseAction(
  input: CategorizeExpenseTextInput
): Promise<CategorizeExpenseTextOutput> {
  try {
    const result = await categorizeExpenseText(input);
    return result;
  } catch (error) {
    console.error('Error in categorizeExpenseAction:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to categorize expense: ${error.message}`);
    }
    throw new Error(
      'An unknown error occurred while categorizing the expense.'
    );
  }
}
