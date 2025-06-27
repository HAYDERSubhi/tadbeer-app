// src/ai/flows/analyze-detailed-receipt.ts
'use server';
/**
 * @fileOverview An AI flow for analyzing one or more receipt images and extracting a categorized list of items.
 *
 * - analyzeDetailedReceipt - A function that handles the detailed receipt analysis process.
 * - AnalyzeDetailedReceiptInput - The input type for the analyzeDetailedReceipt function.
 * - AnalyzeDetailedReceiptOutput - The return type for the analyzeDetailedReceipt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeDetailedReceiptInputSchema = z.object({
  receiptImages: z
    .array(
      z
        .string()
        .describe(
          "A photo of a receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        )
    )
    .describe('An array of receipt images to be analyzed as a single, continuous document.'),
  categories: z
    .record(z.string(), z.string())
    .describe('A map of available category IDs to their descriptive names, to be used for categorization.'),
});
export type AnalyzeDetailedReceiptInput = z.infer<typeof AnalyzeDetailedReceiptInputSchema>;

const CategorizedItemSchema = z.object({
  name: z.string().describe('The name of the individual item purchased.'),
  price: z.number().describe('The price of the individual item.'),
  suggestedCategory: z.string().describe('The most appropriate category ID for this item from the provided categories list.'),
});

const AnalyzeDetailedReceiptOutputSchema = z.object({
  storeName: z.string().optional().describe('The name of the store, if identifiable.'),
  transactionDate: z.string().optional().describe('The date of the transaction in YYYY-MM-DD format, if identifiable.'),
  items: z.array(CategorizedItemSchema).describe('A comprehensive list of all items found on the receipt(s), with their prices and suggested categories.'),
});
export type AnalyzeDetailedReceiptOutput = z.infer<typeof AnalyzeDetailedReceiptOutputSchema>;

export async function analyzeDetailedReceipt(
  input: AnalyzeDetailedReceiptInput
): Promise<AnalyzeDetailedReceiptOutput> {
  return analyzeDetailedReceiptFlow(input);
}

const analyzeDetailedReceiptPrompt = ai.definePrompt({
  name: 'analyzeDetailedReceiptPrompt',
  input: {schema: AnalyzeDetailedReceiptInputSchema},
  output: {schema: AnalyzeDetailedReceiptOutputSchema},
  prompt: `You are an expert financial assistant specializing in extracting and categorizing individual items from long, multi-page receipts for an Iraqi user.

Your task is to analyze the provided receipt images, which should be treated as a single document. You must identify every single item, its price, and then assign the most logical spending category to it from the provided list.

**Available Categories (ID: Name):**
{{#each categories}}
- {{ @key }}: {{ this }}
{{/each}}

**Receipt Images:**
{{#each receiptImages}}
{{media url=this}}
{{/each}}

**Instructions:**
1.  Carefully scan all images to find the list of purchased items.
2.  For each item, extract its name and price accurately.
3.  For each item, choose the most appropriate category ID from the 'Available Categories' list above. For example, an item named "تفاح" should be categorized under "food". An item "صابون" should be "home_supplies".
4.  If possible, identify the store name and the date of the transaction and include them.
5.  Return the data as a single JSON object containing the store name, date, and a complete array of all categorized items. Do not miss any items, even if the receipt is very long.
`,
});

const analyzeDetailedReceiptFlow = ai.defineFlow(
  {
    name: 'analyzeDetailedReceiptFlow',
    inputSchema: AnalyzeDetailedReceiptInputSchema,
    outputSchema: AnalyzeDetailedReceiptOutputSchema,
  },
  async input => {
    const {output} = await analyzeDetailedReceiptPrompt(input);
    return output!;
  }
);
