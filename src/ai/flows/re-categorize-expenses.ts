// src/ai/flows/re-categorize-expenses.ts
'use server';
/**
 * @fileOverview An AI flow for re-categorizing a batch of existing expenses based on their titles.
 *
 * - reCategorizeExpenses - A function that handles the batch re-categorization process.
 * - ReCategorizeExpensesInput - The input type for the function.
 * - ReCategorizeExpensesOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import {categorizeExpenseText} from './categorize-expense-text';

const ExpenseToReCategorizeSchema = z.object({
  id: z.string().describe('The unique ID of the expense document.'),
  title: z.string().describe('The title/description of the expense.'),
});

export const ReCategorizeExpensesInputSchema = z.object({
  expenses: z
    .array(ExpenseToReCategorizeSchema)
    .describe('An array of expense objects to be re-categorized.'),
  categories: z
    .record(z.string(), z.string())
    .describe(
      'A map of available category IDs to their descriptive names, to be used for categorization.'
    ),
});
export type ReCategorizeExpensesInput = z.infer<
  typeof ReCategorizeExpensesInputSchema
>;

const ReCategorizedExpenseSchema = z.object({
  id: z.string().describe('The ID of the expense that was processed.'),
  newCategory: z
    .string()
    .describe('The newly suggested category ID for the expense.'),
});

export const ReCategorizeExpensesOutputSchema = z.object({
  reCategorizedExpenses: z
    .array(ReCategorizedExpenseSchema)
    .describe('An array of expenses with their new suggested categories.'),
});
export type ReCategorizeExpensesOutput = z.infer<
  typeof ReCategorizeExpensesOutputSchema
>;

export async function reCategorizeExpenses(
  input: ReCategorizeExpensesInput
): Promise<ReCategorizeExpensesOutput> {
  return reCategorizeExpensesFlow(input);
}

const reCategorizeExpensesFlow = ai.defineFlow(
  {
    name: 'reCategorizeExpensesFlow',
    inputSchema: ReCategorizeExpensesInputSchema,
    outputSchema: ReCategorizeExpensesOutputSchema,
  },
  async (input: ReCategorizeExpensesInput) => {
    const categorizationPromises = input.expenses.map(async expense => {
      try {
        const result = await categorizeExpenseText({
          expenseTitle: expense.title,
          categories: input.categories,
        });
        return {
          id: expense.id,
          newCategory: result.suggestedCategory,
        };
      } catch (error) {
        console.error(
          `Failed to categorize expense ID ${expense.id}:`,
          error
        );
        // Return null or a specific error object if a single categorization fails
        return null;
      }
    });

    const results = await Promise.all(categorizationPromises);

    // Filter out any null results from failed categorizations
    const validResults = results.filter(
      (result): result is z.infer<typeof ReCategorizedExpenseSchema> =>
        result !== null
    );

    return {
      reCategorizedExpenses: validResults,
    };
  }
);
