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
  prompt: `You are an AI assistant that helps users record their expenses from a voice note in Iraqi Arabic dialect.
  You will receive a voice recording of the expense, and you need to extract the information.

  **Instructions:**
  1.  Listen to the voice recording carefully. The user will state an expense, for example "سجلت اليوم 50 ألف دينار على البانزين" (Today I spent 50 thousand dinars on gasoline) or "اشتريت باذنجان بعشرتالاف" (I bought eggplant for 10 thousand).
  2.  Extract the amount, description, and date. If no date is mentioned, use today's date.
  3.  From the list of available categories below, you **must** choose the most logical category **ID**. For example, for "بانزين" (gasoline), the category ID should be "private_car". For "باذنجان" (eggplant), it should be "food". For "صابون" (soap), it should be "home_supplies".
  4.  Return the extracted information in the required JSON format. The 'category' field must be one of the provided IDs.

  **Available Categories (ID: Name):**
  {{#each categories}}
  - {{ @key }}: {{ this }}
  {{/each}}

  **Voice Recording:**
  {{media url=voiceRecordingDataUri}}
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

    
