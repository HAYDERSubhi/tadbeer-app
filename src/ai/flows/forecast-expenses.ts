'use server';
/**
 * @fileOverview An AI flow for generating advice based on a calculated expense forecast.
 *
 * - forecastExpenses - A function that analyzes a forecast and provides advice.
 * - ForecastExpensesInput - The input type for the forecastExpenses function.
 * - ForecastExpensesOutput - The return type for the forecastExpenses function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ForecastExpensesInputSchema = z.object({
  totalForecastAmount: z.number().describe("The user's predicted total expense amount for the next 30 days in Iraqi Dinar."),
  categoryForecasts: z.array(
    z.object({
      categoryName: z.string().describe("The name of the category."),
      predictedAmount: z.number().describe("The predicted spending amount for this category in the next 30 days."),
    })
  ).describe("A list of spending forecasts for the top individual categories."),
   historicalExpenses: z.array(
    z.object({
      amount: z.number(),
      category: z.string(),
      date: z.string(),
    })
  ).describe("An array of the user's historical expenses from the last 90 days, for context."),
});
export type ForecastExpensesInput = z.infer<typeof ForecastExpensesInputSchema>;

const ForecastExpensesOutputSchema = z.object({
  advice: z.string().describe("A single, short (one or two sentences), actionable piece of financial advice in Arabic based on the forecast. This should be encouraging and helpful, and directly reference one of the high-spending categories if possible."),
});
export type ForecastExpensesOutput = z.infer<typeof ForecastExpensesOutputSchema>;


export async function forecastExpenses(input: ForecastExpensesInput): Promise<ForecastExpensesOutput> {
  return forecastExpensesFlow(input);
}


const prompt = ai.definePrompt({
    name: 'forecastExpensesPrompt',
    input: {schema: ForecastExpensesInputSchema},
    output: {schema: ForecastExpensesOutputSchema},
    prompt: `You are a financial analyst AI for an Iraqi user. Your task is to provide one key insight or piece of advice based on their financial forecast.

Here is the forecast for the next 30 days, which has already been calculated:
- Total Predicted Spending: {{totalForecastAmount}} د.ع
- Category Breakdowns:
{{#each categoryForecasts}}
- {{this.categoryName}}: {{this.predictedAmount}} د.ع
{{/each}}

Here is a sample of their historical spending for context:
{{#each historicalExpenses}}
- {{this.amount}} د.ع in category "{{this.category}}" on {{this.date}}.
{{/each}}

**Your Task:**
Generate a single, short (one or two sentences) actionable piece of financial advice in Arabic. The advice should be encouraging and helpful. If possible, it should directly reference a category with high predicted spending. For example, if you see high spending in "ترفيه" (Entertainment), you might suggest setting a specific budget for it or exploring free activities.

The output must be a valid JSON object containing only the 'advice' field.
`,
});

const forecastExpensesFlow = ai.defineFlow(
  {
    name: 'forecastExpensesFlow',
    inputSchema: ForecastExpensesInputSchema,
    outputSchema: ForecastExpensesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
