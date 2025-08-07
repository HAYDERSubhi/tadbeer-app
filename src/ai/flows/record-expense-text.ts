
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
    .describe("The user's transcribed expense in Iraqi dialect. This could be a full sentence like 'دفعت 50 ألف على البانزين' or just an item name like 'قهوة'."),
  categories: z
    .record(z.string(), z.string())
    .describe('A map of available category IDs to their descriptive names, to be used for categorization. The AI MUST choose from these.'),
});
export type RecordExpenseWithTextInput = z.infer<typeof RecordExpenseWithTextInputSchema>;


const RecordExpenseWithTextOutputSchema = z.object({
  amount: z.number().describe('The amount of the expense. If not mentioned, default to 0.'),
  category: z.string().describe('The ID of the most appropriate category for the expense from the provided list.'),
  date: z.string().describe("The date of the expense in YYYY-MM-DD format. Default to today if not mentioned."),
  description: z.string().optional().describe('A short description of the expense. This should be the item name itself if no other description is provided.'),
});
export type RecordExpenseWithTextOutput = z.infer<typeof RecordExpenseWithTextOutputSchema>;


export async function recordExpenseWithText(input: RecordExpenseWithTextInput): Promise<RecordExpenseWithTextOutput> {
  return recordExpenseWithTextFlow(input);
}

const extractAndCategorizePrompt = ai.definePrompt({
    name: 'extractAndCategorizePrompt',
    input: { schema: RecordExpenseWithTextInputSchema.extend({ currentDate: z.string() }) },
    output: { schema: RecordExpenseWithTextOutputSchema },
    prompt: `You are an AI assistant that helps users in Iraq record their expenses from a text input in Iraqi Arabic dialect.
    You will receive a text of the expense, and you need to extract all information and categorize it in one step.

    **Instructions:**
    1.  Analyze the text carefully. The text can be a full sentence like "سجلت اليوم 50 ألف دينار على البانزين" (Today I spent 50 thousand dinars on gasoline) or just the item's name, like "قهوة" (coffee).
    2.  Extract the amount, description, and date.
    3.  **Crucially, you must understand Iraqi number formats.** For example:
        - "50 ألف" or "خمسين الف" means 50000.
        - "عشرتالاف" or "عشرة آلاف" means 10000.
        - "ميتين وخمسة وعشرين الف" means 225000.
        - "ربع مليون" means 250000.
        - "الفين ونص" means 2500.
        Accurately convert these phrases to a numerical value for the 'amount' field.
    4.  If the text is just an item name (e.g., "قهوة"), you should set the 'description' to that name, and the 'amount' to 0. The primary goal in this case is to get the category.
    5.  If no date is mentioned, use today's date, which is {{currentDate}}.
    6.  From the list of available categories below, you **must** choose the most logical category **ID**. For example, for "بانزين" (gasoline), the category ID should be "transport". For "قهوة" (coffee), it should be "food".
    7.  Return all the extracted information in the required JSON format.

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
    
    // Fallback: if AI returns a category not in the list, default to 'other'
    if (!Object.keys(input.categories).includes(output.category)) {
      output.category = 'other';
    }

    return output;
  }
);
