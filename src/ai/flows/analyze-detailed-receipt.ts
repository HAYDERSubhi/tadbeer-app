
// src/ai/flows/analyze-detailed-receipt.ts
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeDetailedReceiptInputSchema = z.object({
  receiptImages: z
    .array(z.string().describe('A receipt photo as a public URL or base64 data URI.'))
    .describe('Receipt images treated as a single document.'),
  categories: z
    .record(z.string(), z.string())
    .describe('Map of category IDs to Arabic names for classification.'),
});
export type AnalyzeDetailedReceiptInput = z.infer<typeof AnalyzeDetailedReceiptInputSchema>;

const CategorizedItemSchema = z.object({
  name: z.string().describe('Item name exactly as it appears on the receipt (keep original language).'),
  price: z.number().describe('Item price as a number (no currency symbol, no commas).'),
  suggestedCategory: z.string().describe('Best matching category ID from the provided list.'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe(
      'high = text is clear and price is unambiguous. ' +
      'medium = text is readable but price may be approximate. ' +
      'low = text is blurry, partially cut off, or price is uncertain.'
    ),
});

const AnalyzeDetailedReceiptOutputSchema = z.object({
  storeName: z.string().optional().describe('Store or merchant name if visible.'),
  transactionDate: z.string().optional().describe('Transaction date in YYYY-MM-DD format if visible.'),
  totalAmount: z
    .number()
    .optional()
    .describe('The grand total printed on the receipt (المجموع الكلي / الإجمالي). Extract as a plain number.'),
  receiptType: z
    .enum(['itemized', 'simple'])
    .describe(
      'itemized = receipt lists individual products with prices. ' +
      'simple = receipt shows only a total amount with no product breakdown.'
    ),
  overallConfidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Overall quality of the extraction based on image clarity.'),
  items: z
    .array(CategorizedItemSchema)
    .describe('All extracted items. For a simple receipt, return one item with the total amount.'),
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
  prompt: `You are an expert OCR and financial data extraction assistant specialized in Iraqi and Arabic receipts.

## Your Task
Analyze the provided receipt image(s) and extract all financial data accurately.

## Receipt Types You Will Encounter
- **Thermal printer receipts** (most common in Iraq): faded ink, small text, sometimes blurry
- **Arabic receipts**: items written right-to-left, amounts may use Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩)
- **Mixed language**: Arabic item names with English/Latin prices
- **Simple receipts**: only show a grand total with no itemized list
- **Supermarket receipts**: long itemized list with multiple products

## Number Handling Rules
- Arabic-Indic numerals (٢٥٠٠٠) = treat as regular numbers (25000)
- Prices may appear as: 25000 / 25,000 / 25.000 / IQD 25000 / ٢٥٠٠٠ د.ع
- Always return prices as plain numbers without commas or currency symbols
- Iraqi Dinar amounts are typically large (5000–500000 range)

## Available Categories (ID: Arabic Name)
{{#each categories}}
- {{ @key }}: {{ this }}
{{/each}}

## Receipt Images
{{#each receiptImages}}
{{media url=this}}
{{/each}}

## Extraction Instructions
1. First determine if this is an **itemized** or **simple** receipt
2. For **itemized**: extract EVERY item with its individual price
3. For **simple**: extract the single total amount as one item named after the store
4. Always extract the **grand total** (المجموع / الإجمالي / Total) if visible — this is critical for verification
5. Extract store name and date if readable
6. Assign confidence level per item:
   - **high**: text is sharp and price is unambiguous
   - **medium**: text readable but some uncertainty exists
   - **low**: blurry, cut off, or price is a guess
7. Set overallConfidence based on image quality:
   - **high**: most items are clear
   - **medium**: image has some blur but main data is readable
   - **low**: image is very blurry, dark, or heavily obscured

## Important
- Do NOT skip items even if partially readable — mark them as low confidence instead
- Do NOT hallucinate items that are not visible
- For each item, pick the BEST category from the provided list
- If the receipt is completely unreadable, return an empty items array with overallConfidence: "low"
`,
});

const analyzeDetailedReceiptFlow = ai.defineFlow(
  {
    name: 'analyzeDetailedReceiptFlow',
    inputSchema: AnalyzeDetailedReceiptInputSchema,
    outputSchema: AnalyzeDetailedReceiptOutputSchema,
  },
  async input => {
    // thinkingBudget:0 — receipt extraction is structured, not creative;
    // disabling thinking cuts latency significantly on gemini-2.5-flash.
    const {output} = await analyzeDetailedReceiptPrompt(
      input,
      { config: { thinkingConfig: { thinkingBudget: 0 } } }
    );
    return output!;
  }
);
