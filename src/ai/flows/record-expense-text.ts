// src/ai/flows/record-expense-text.ts
'use server';

/**
 * @fileOverview This flow allows users to record expenses using text input, transcribed from voice.
 *
 * - recordExpenseWithText - A function that handles the expense recording process using text input.
 * - RecordExpenseWithTextInput - The input type for the recordExpenseWithText function.
 * - RecordExpenseWithTextOutput - The return type for the recordExpenseWithText function (same as voice).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// This schema is duplicated from record-expense-voice.ts to avoid exporting a non-function from a 'use server' file.
const RecordExpenseOutputSchema = z.object({
  amount: z.number().describe('The amount of the expense.'),
  category: z.string().describe('The ID of the most appropriate category for the expense from the provided list.'),
  date: z.string().describe("The date of the expense in YYYY-MM-DD format. Default to today if not mentioned."),
  description: z.string().optional().describe('A short description of the expense.'),
});

const RecordExpenseWithTextInputSchema = z.object({
  expenseText: z
    .string()
    .describe("The user's transcribed expense in Iraqi dialect."),
  categories: z
    .record(z.string(), z.string())
    .describe('A map of available category IDs to their descriptive names, to be used for categorization.'),
});
export type RecordExpenseWithTextInput = z.infer<typeof RecordExpenseWithTextInputSchema>;
export type RecordExpenseWithTextOutput = z.infer<typeof RecordExpenseOutputSchema>;


export async function recordExpenseWithText(input: RecordExpenseWithTextInput): Promise<RecordExpenseWithTextOutput> {
  return recordExpenseWithTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recordExpenseWithTextPrompt',
  input: {schema: RecordExpenseWithTextInputSchema},
  output: {schema: RecordExpenseOutputSchema},
  prompt: `You are an AI assistant that helps users record their expenses from a transcribed text in Iraqi Arabic dialect.
  You will receive a text of the expense, and you need to extract the information.

  **Instructions:**
  1.  Analyze the text carefully. The user will state an expense, for example "سجلت اليوم 50 ألف دينار على البانزين" (Today I spent 50 thousand dinars on gasoline) or "اشتريت غراض للبيت بعشرتالاف" (I bought home supplies for 10 thousand).
  2.  Extract the amount, description, and date. If no date is mentioned, use today's date.
  3.  From the list of available categories below, choose the most logical category **ID**. For example, for "بانزين" (gasoline), the category should be "private_car". For "غراض للبيت" (home supplies), it should be "home_supplies".
  4.  Return the extracted information in the required JSON format. The 'category' field must be one of the provided IDs.

  **Available Categories (ID: Name):**
  {{#each categories}}
  - {{ @key }}: {{ this }}
  {{/each}}

  **Expense Text:**
  {{{expenseText}}}
  `,
});

const recordExpenseWithTextFlow = ai.defineFlow(
  {
    name: 'recordExpenseWithTextFlow',
    inputSchema: RecordExpenseWithTextInputSchema,
    outputSchema: RecordExpenseOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
