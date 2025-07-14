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
import { categorizeExpenseText, type CategorizeExpenseTextInput } from './categorize-expense-text';
import { format } from 'date-fns';

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

const extractInfoPrompt = ai.definePrompt({
    name: 'extractExpenseInfoPrompt',
    input: { schema: z.object({ expenseText: z.string(), currentDate: z.string() }) },
    output: { schema: z.object({
        amount: z.number().describe('The amount of the expense.'),
        date: z.string().describe("The date of the expense in YYYY-MM-DD format. Default to today if not mentioned."),
        description: z.string().optional().describe('A short description of the expense.'),
    })},
    prompt: `You are an AI assistant that helps users record their expenses from a transcribed text in Iraqi Arabic dialect.
    You will receive a text of the expense, and you need to extract the information.

    **Instructions:**
    1.  Analyze the text carefully. The user will state an expense, for example "سجلت اليوم 50 ألف دينار على البانزين" (Today I spent 50 thousand dinars on gasoline) or "اشتريت باذنجان بعشرتالاف" (I bought eggplant for 10 thousand).
    2.  Extract the amount, description, and date.
    3.  If no date is mentioned, use today's date, which is {{currentDate}}.
    4.  Return the extracted information in the required JSON format.

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
    const today = format(new Date(), 'yyyy-MM-dd');
    // Step 1: Extract basic info (amount, date, description)
    const { output: extractedInfo } = await extractInfoPrompt({ expenseText: input.expenseText, currentDate: today });
    if (!extractedInfo) {
        throw new Error("Could not extract expense information from the text.");
    }
    
    // Step 2: Use the description/title to get a category suggestion from the dedicated flow
    const categorizeInput: CategorizeExpenseTextInput = {
        expenseTitle: extractedInfo.description || input.expenseText,
        categories: input.categories,
    };
    const categorySuggestion = await categorizeExpenseText(categorizeInput);

     if (!categorySuggestion) {
        throw new Error("Could not determine a category for the expense.");
    }

    // Step 3: Combine results and return
    return {
        amount: extractedInfo.amount,
        date: extractedInfo.date,
        description: extractedInfo.description,
        category: categorySuggestion.suggestedCategory,
    };
  }
);
