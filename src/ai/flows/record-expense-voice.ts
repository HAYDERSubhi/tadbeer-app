// src/ai/flows/record-expense-voice.ts
'use server';

/**
 * @fileOverview This flow allows users to record expenses using their voice in Iraqi dialect.
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
});
export type RecordExpenseWithVoiceInput = z.infer<typeof RecordExpenseWithVoiceInputSchema>;

const RecordExpenseWithVoiceOutputSchema = z.object({
  amount: z.number().describe('The amount of the expense.'),
  category: z.string().describe('The category of the expense.'),
  date: z.string().describe('The date of the expense.'),
  description: z.string().optional().describe('A description of the expense.'),
});
export type RecordExpenseWithVoiceOutput = z.infer<typeof RecordExpenseWithVoiceOutputSchema>;

export async function recordExpenseWithVoice(input: RecordExpenseWithVoiceInput): Promise<RecordExpenseWithVoiceOutput> {
  return recordExpenseWithVoiceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recordExpenseWithVoicePrompt',
  input: {schema: RecordExpenseWithVoiceInputSchema},
  output: {schema: RecordExpenseWithVoiceOutputSchema},
  prompt: `You are an AI assistant that helps users record their expenses using voice input in Iraqi dialect.
  You will receive a voice recording of the expense, and you need to extract the following information:
  - amount: The amount of the expense.
  - category: The category of the expense.
  - date: The date of the expense.
  - description: A description of the expense.

  Here is the voice recording: {{media url=voiceRecordingDataUri}}

  Please provide the information in the following JSON format:
  {
    "amount": amount,
    "category": category,
    "date": date,
    "description": description
  }`,
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
