// src/ai/flows/record-expense-voice.ts
'use server';

/**
 * @fileOverview This flow allows users to record expenses using their voice in Iraqi dialect.
 *
 * THIS FLOW IS DEPRECATED. Use record-expense-text instead, as voice-to-text is now handled on the client.
 *
 * - recordExpenseWithVoice - A function that handles the expense recording process using voice input.
 * - RecordExpenseWithVoiceInput - The input type for the recordExpenseWithVoice function.
 * - RecordExpenseWithVoiceOutput - The return type for the recordExpenseWithVoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecordExpenseWithVoiceInputSchema = z.object({
  voiceRecordingDataUri: z
    .string()
    .describe(
      "A voice recording of the expense in Iraqi dialect, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  categories: z
    .record(z.string(), z.string())
    .describe('A map of available category IDs to their descriptive names, to be used for categorization.'),
});
export type RecordExpenseWithVoiceInput = z.infer<typeof RecordExpenseWithVoiceInputSchema>;

const RecordExpenseWithVoiceOutputSchema = z.object({
  amount: z.number().describe('The amount of the expense.'),
  category: z.string().describe('The ID of the most appropriate category for the expense from the provided list.'),
  date: z.string().describe("The date of the expense in YYYY-MM-DD format. Default to today if not mentioned."),
  description: z.string().optional().describe('A short description of the expense.'),
});
export type RecordExpenseWithVoiceOutput = z.infer<typeof RecordExpenseWithVoiceOutputSchema>;

export async function recordExpenseWithVoice(input: RecordExpenseWithVoiceInput): Promise<RecordExpenseWithVoiceOutput> {
  return recordExpenseWithVoiceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recordExpenseWithVoicePrompt',
  input: {schema: RecordExpenseWithVoiceInputSchema},
  output: {schema: RecordExpenseWithVoiceOutputSchema},
  prompt: `You are an AI assistant specialized in extracting expense data from voice recordings in Iraqi Arabic dialect.

## Your Task
Listen to the voice recording and extract the expense details.

## Iraqi Arabic Number Examples
- "خمسين ألف" = 50000
- "مية ألف" / "مئة ألف" = 100000
- "عشرتالاف" / "عشر آلاف" = 10000
- "ألفين وخمسمية" = 2500
- "خمسة وعشرين" = 25
- Always return numbers as plain integers (no commas, no currency symbols)

## Instructions
1. Listen carefully — the user describes an expense in Iraqi Arabic
2. Extract: the amount spent, what it was spent on, and the date (default to today if not mentioned)
3. Choose the most appropriate category ID from the list below
4. Always return a valid JSON response even if audio is unclear — make your best guess

## Available Categories (ID: Arabic Name)
{{#each categories}}
- {{ @key }}: {{ this }}
{{/each}}

## Voice Recording
{{media url=voiceRecordingDataUri}}

## Important
- amount must be a number (e.g. 50000 not "50 thousand")
- category must be exactly one of the IDs listed above
- date must be YYYY-MM-DD format
- description should be a short Arabic phrase describing the expense
`,
});

const recordExpenseWithVoiceFlow = ai.defineFlow(
  {
    name: 'recordExpenseWithVoiceFlow',
    inputSchema: RecordExpenseWithVoiceInputSchema,
    outputSchema: RecordExpenseWithVoiceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

    
