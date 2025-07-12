// src/app/actions.ts
'use server';

import {
  reCategorizeExpenses,
  type ReCategorizeExpensesInput,
} from '@/ai/flows/re-categorize-expenses';
import {
  recordExpenseWithText,
  type RecordExpenseWithTextInput,
  type RecordExpenseWithTextOutput,
} from '@/ai/flows/record-expense-text';
import {updateExpense} from '@/services/firestore';
import {auth} from '@/lib/firebase';

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
 * A Server Action to re-categorize all expenses for the current user.
 */
export async function reCategorizeAction(
  input: ReCategorizeExpensesInput
): Promise<{count: number}> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User is not authenticated.');
  }

  try {
    const result = await reCategorizeExpenses(input);

    const updatePromises = result.reCategorizedExpenses.map(item => {
      return updateExpense(user.uid, item.id, {category: item.newCategory});
    });

    await Promise.all(updatePromises);

    return {count: result.reCategorizedExpenses.length};
  } catch (error) {
    console.error('Error in reCategorizeAction:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to re-categorize expenses: ${error.message}`);
    }
    throw new Error(
      'An unknown error occurred while re-categorizing expenses.'
    );
  }
}
