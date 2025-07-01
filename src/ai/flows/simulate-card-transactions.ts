'use server';
/**
 * @fileOverview An AI flow for simulating credit card transactions.
 *
 * - simulateCardTransactions - A function that generates a list of realistic, recent transactions.
 * - SimulateCardTransactionsInput - The input type for the function.
 * - SimulateCardTransactionsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SimulateCardTransactionsInputSchema = z.object({
  categories: z
    .record(z.string(), z.string())
    .describe('A map of available category IDs to their descriptive names, to be used for categorization.'),
  lastTransactionDate: z
    .string()
    .optional()
    .describe('The date of the last transaction in ISO format. Generate transactions that occur after this date.'),
});
export type SimulateCardTransactionsInput = z.infer<typeof SimulateCardTransactionsInputSchema>;

const SimulatedTransactionSchema = z.object({
    title: z.string().describe("A realistic, short description of the transaction (e.g., 'Subscription to Netflix', 'Coffee from a local cafe')."),
    amount: z.number().describe('The transaction amount in Iraqi Dinar (IQD). Should be a realistic number for the item.'),
    category: z.string().describe('The most appropriate category ID for this item from the provided categories list.'),
    date: z.string().describe("The date of the transaction in YYYY-MM-DD format. Must be a recent date, after the provided lastTransactionDate if available, but not in the future."),
    description: z.string().optional().describe('A slightly more detailed description for the transaction.'),
});

const SimulateCardTransactionsOutputSchema = z.object({
    transactions: z.array(SimulatedTransactionSchema).describe("An array of 2 to 5 simulated credit card transactions."),
});
export type SimulateCardTransactionsOutput = z.infer<typeof SimulateCardTransactionsOutputSchema>;


export async function simulateCardTransactions(
  input: SimulateCardTransactionsInput
): Promise<SimulateCardTransactionsOutput> {
  return simulateCardTransactionsFlow(input);
}


const prompt = ai.definePrompt({
  name: 'simulateCardTransactionsPrompt',
  input: {schema: SimulateCardTransactionsInputSchema},
  output: {schema: SimulateCardTransactionsOutputSchema},
  prompt: `You are an AI assistant designed to simulate realistic credit card transactions for a user in Iraq. Your task is to generate a list of 2 to 5 recent, believable transactions.

**Instructions:**
1.  Generate a variety of common purchases. Examples include online subscriptions (Netflix, Spotify), cafe purchases, supermarket items, fuel, or small online orders.
2.  Assign a realistic amount in Iraqi Dinar (IQD) for each transaction.
3.  Choose the most logical spending category for each transaction from the list provided below.
4.  Assign a recent date to each transaction. If a \`lastTransactionDate\` is provided, all new transaction dates must be more recent than it, but not in the future. Spread them out over a few days.
5.  Provide the output strictly in the requested JSON format.

**Available Categories (ID: Name):**
{{#each categories}}
- {{ @key }}: {{ this }}
{{/each}}

{{#if lastTransactionDate}}
**Last Transaction Date:** {{lastTransactionDate}}
{{/if}}
`,
});

const simulateCardTransactionsFlow = ai.defineFlow(
  {
    name: 'simulateCardTransactionsFlow',
    inputSchema: SimulateCardTransactionsInputSchema,
    outputSchema: SimulateCardTransactionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
