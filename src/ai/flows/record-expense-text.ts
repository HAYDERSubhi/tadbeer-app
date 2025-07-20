// src/ai/flows/record-expense-text.ts
'use server';

/**
 * @fileOverview This flow allows users to record expenses using text input, transcribed from voice.
 * It extracts all necessary information (amount, description, date, and category) in a single AI call.
 *
 * - recordExpenseWithText - A function that handles the expense recording process using text input.
 * - RecordExpenseWithTextInput - The input type for the recordExpenseWithText function.
 * - RecordExpenseWithTextOutput - The return type for the recordExpenseWithText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { format } from 'date-fns';

const RecordExpenseWithTextInputSchema = z.object({
  expenseText: z
    .string()
    .describe("The user's transcribed expense in Iraqi dialect."),
  categories: z
    .record(z.string(), z.string())
    .describe('A map of available category IDs to their descriptive names, to be used for categorization.'),
});
export type RecordExpenseWithTextInput = z.infer<typeof RecordExpenseWithTextInputSchema>;


const RecordExpenseWithTextOutputSchema = z.object({
  amount: z.number().describe('The amount of the expense.'),
  category: z.string().describe('The ID of the most appropriate category for the expense from the provided list.'),
  date: z.string().describe("The date of the expense in YYYY-MM-DD format. Default to today if not mentioned."),
  description: z.string().optional().describe('A short description of the expense.'),
});
export type RecordExpenseWithTextOutput = z.infer<typeof RecordExpenseWithTextOutputSchema>;


export async function recordExpenseWithText(input: RecordExpenseWithTextInput): Promise<RecordExpenseWithTextOutput> {
  return recordExpenseWithTextFlow(input);
}

const extractAndCategorizePrompt = ai.definePrompt({
    name: 'extractAndCategorizePrompt',
    input: { schema: RecordExpenseWithTextInputSchema.extend({ currentDate: z.string() }) },
    output: { schema: RecordExpenseWithTextOutputSchema },
    prompt: `You are an AI assistant that helps users in Iraq record their expenses from a transcribed text in Iraqi Arabic dialect.
    You will receive a text of the expense, and you need to extract all information and categorize it in one step.

    **Instructions:**
    1.  Analyze the text carefully. The user will state an expense, for example "سجلت اليوم 50 ألف دينار على البانزين" (Today I spent 50 thousand dinars on gasoline) or "اشتريت باذنجان بعشرتالاف" (I bought eggplant for 10 thousand).
    2.  Extract the amount, description, and date.
    3.  If no date is mentioned, use today's date, which is {{currentDate}}.
    4.  From the list of available categories below, you **must** choose the most logical category **ID**. For example, for "بانزين" (gasoline), the category ID should be "private_car". For "باذنجان" (eggplant), it should be "food".
    5.  Return all the extracted information in the required JSON format.

    **Available Categories (ID: Name):**
    {{#each categories}}
    - {{ @key }}: {{ this }}
    {{/each}}
    
    **Expense Text:**
    "{{{expenseText}}}"
    `,
});

const recordExpenseWithTextFlow = ai.defineFlow(
  {
    name: 'recordExpenseWithTextFlow',
    inputSchema: RecordExpenseWithTextInputSchema,
    outputSchema: RecordExpenseWithTextOutputSchema,
  },
  async input => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { output } = await extractAndCategorizePrompt({ 
        expenseText: input.expenseText, 
        currentDate: today,
        categories: input.categories
    });

    if (!output) {
        throw new Error("Could not extract expense information from the text.");
    }
    
    return output;
  }
);
