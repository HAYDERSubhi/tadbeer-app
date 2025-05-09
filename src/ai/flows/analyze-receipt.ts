// src/ai/flows/analyze-receipt.ts
'use server';
/**
 * @fileOverview AI flow for analyzing a receipt image and extracting relevant information.
 *
 * - analyzeReceipt - A function that handles the receipt analysis process.
 * - AnalyzeReceiptInput - The input type for the analyzeReceipt function.
 * - AnalyzeReceiptOutput - The return type for the analyzeReceipt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeReceiptInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeReceiptInput = z.infer<typeof AnalyzeReceiptInputSchema>;

const AnalyzeReceiptOutputSchema = z.object({
  storeName: z.string().describe('The name of the store on the receipt.'),
  amount: z.number().describe('The total amount on the receipt.'),
  date: z.string().describe('The date on the receipt in ISO format (YYYY-MM-DD).'),
  items: z.array(
    z.object({
      name: z.string().describe('The name of the item.'),
      price: z.number().describe('The price of the item.'),
    })
  ).describe('A list of items on the receipt.'),
});
export type AnalyzeReceiptOutput = z.infer<typeof AnalyzeReceiptOutputSchema>;

export async function analyzeReceipt(input: AnalyzeReceiptInput): Promise<AnalyzeReceiptOutput> {
  return analyzeReceiptFlow(input);
}

const analyzeReceiptPrompt = ai.definePrompt({
  name: 'analyzeReceiptPrompt',
  input: {schema: AnalyzeReceiptInputSchema},
  output: {schema: AnalyzeReceiptOutputSchema},
  prompt: `You are an expert financial assistant specializing in extracting information from receipts.

  You will use this information to extract the store name, total amount, date, and a list of items with their prices from the receipt image.

  Use the following as the primary source of information about the receipt.

  Receipt Image: {{media url=photoDataUri}}

  Please provide the output in JSON format.
  `,
});

const analyzeReceiptFlow = ai.defineFlow(
  {
    name: 'analyzeReceiptFlow',
    inputSchema: AnalyzeReceiptInputSchema,
    outputSchema: AnalyzeReceiptOutputSchema,
  },
  async input => {
    const {output} = await analyzeReceiptPrompt(input);
    return output!;
  }
);
