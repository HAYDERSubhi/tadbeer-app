'use server';
/**
 * @fileOverview An AI flow for forecasting future expenses based on historical data.
 *
 * - forecastExpenses - A function that analyzes historical spending and predicts future expenses.
 * - ForecastExpensesInput - The input type for the forecastExpenses function.
 * - ForecastExpensesOutput - The return type for the forecastExpenses function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ForecastExpensesInputSchema = z.object({
  expenses: z.array(
    z.object({
      title: z.string(),
      amount: z.number(),
      category: z.string(),
      date: z.string(),
    })
  ).describe("An array of the user's historical expenses from the last 2-3 months."),
});
export type ForecastExpensesInput = z.infer<typeof ForecastExpensesInputSchema>;

const ForecastExpensesOutputSchema = z.object({
  totalForecastAmount: z.number().describe("The predicted total expense amount for the next 30 days in Iraqi Dinar."),
  categoryForecasts: z.array(
    z.object({
      categoryName: z.string().describe("The name of the category."),
      predictedAmount: z.number().describe("The predicted spending amount for this category in the next 30 days."),
    })
  ).describe("A list of spending forecasts for the top 3-5 individual categories."),
  advice: z.string().describe("A single, short (one sentence), actionable piece of financial advice in Arabic based on the forecast. This should be encouraging and helpful."),
});
export type ForecastExpensesOutput = z.infer<typeof ForecastExpensesOutputSchema>;


export async function forecastExpenses(input: ForecastExpensesInput): Promise<ForecastExpensesOutput> {
  return forecastExpensesFlow(input);
}


const prompt = ai.definePrompt({
    name: 'forecastExpensesPrompt',
    input: {schema: ForecastExpensesInputSchema},
    output: {schema: ForecastExpensesOutputSchema},
    prompt: `You are an expert financial analyst AI for an Iraqi user. Your task is to analyze their past spending habits and provide a financial forecast for the upcoming month (30 days).

Based on the provided list of historical expenses, predict the total spending for the next month, as well as a breakdown of spending for the most significant categories.

Also, provide one key insight or piece of advice based on your forecast. For example, if you predict high spending in "Entertainment", you might suggest setting a specific budget for it. The advice must be concise, encouraging, and in Arabic.

User's historical expenses:
{{#each expenses}}
- "{{this.title}}" بمبلغ {{this.amount}} د.ع في فئة "{{this.category}}" بتاريخ {{this.date}}.
{{/each}}

Please provide the output in JSON format. The total predicted amount and category predictions should be for the next 30 days. Only include the top 3-5 most significant categories in the 'categoryForecasts' array.
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
