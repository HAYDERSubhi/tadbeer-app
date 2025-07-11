// src/ai/flows/categorize-expense-text.ts
'use server';
/**
 * @fileOverview A dedicated AI flow for categorizing an expense based on its title.
 *
 * - categorizeExpenseText - A function that suggests a category for a given expense title.
 * - CategorizeExpenseTextInput - The input type for the categorizeExpenseText function.
 * - CategorizeExpenseTextOutput - The return type for the categorizeExpenseText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const CategorizeExpenseTextInputSchema = z.object({
  expenseTitle: z.string().describe("The title or description of the expense."),
  categories: z
    .record(z.string(), z.string())
    .describe('A map of available category IDs to their descriptive names, to be used for categorization.'),
});
export type CategorizeExpenseTextInput = z.infer<typeof CategorizeExpenseTextInputSchema>;

export const CategorizeExpenseTextOutputSchema = z.object({
  suggestedCategory: z.string().describe('The most appropriate category ID for this item from the provided categories list.'),
});
export type CategorizeExpenseTextOutput = z.infer<typeof CategorizeExpenseTextOutputSchema>;


export async function categorizeExpenseText(
  input: CategorizeExpenseTextInput
): Promise<CategorizeExpenseTextOutput> {
  return categorizeExpenseTextFlow(input);
}

const categorizePrompt = ai.definePrompt({
  name: 'categorizeExpensePrompt',
  input: {schema: CategorizeExpenseTextInputSchema},
  output: {schema: CategorizeExpenseTextOutputSchema},
  prompt: `You are an expert financial assistant for an Iraqi user. Your task is to categorize a single expense based on its title.

**Instructions:**
1.  Read the expense title carefully.
2.  From the list of available categories below, you **must** choose the most logical category **ID**.
3.  For example, for "بانزين" (gasoline), the category ID should be "private_car". For "باذنجان" (eggplant), it should be "food". For "فاتورة كهرباء" (electricity bill), it should be "home_maintenance".
4.  Return only the suggested category ID.

**Available Categories (ID: Name):**
{{#each categories}}
- {{ @key }}: {{ this }}
{{/each}}

**Expense Title:**
"{{{expenseTitle}}}"
`,
});

const categorizeExpenseTextFlow = ai.defineFlow(
  {
    name: 'categorizeExpenseTextFlow',
    inputSchema: CategorizeExpenseTextInputSchema,
    outputSchema: CategorizeExpenseTextOutputSchema,
  },
  async input => {
    const {output} = await categorizePrompt(input);
    return output!;
  }
);
