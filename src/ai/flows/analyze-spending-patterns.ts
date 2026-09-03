// src/ai/flows/analyze-spending-patterns.ts
'use server';
/**
 * @fileOverview An AI flow for analyzing spending patterns over a given period.
 * This flow provides data-driven analysis rather than coaching-style tips.
 *
 * - analyzeSpendingPatterns - A function that handles the analysis process.
 * - AnalyzeSpendingPatternsInput - The input type for the function.
 * - AnalyzeSpendingPatternsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {CURRENCIES} from '@/lib/constants';
import type {CurrencyCode} from '@/types';

const ExpenseItemSchema = z.object({
  title: z.string(),
  amount: z.number(),
  category: z.string().describe("The category name, not the ID."),
  date: z.string(),
});

const AnalyzeSpendingPatternsInputSchema = z.object({
  expenses: z.array(ExpenseItemSchema)
    .describe("An array of the user's expenses for the specified period."),
  previousPeriodExpenses: z.array(ExpenseItemSchema).optional()
    .describe("Expenses from the PREVIOUS period (e.g. last month). Provided so the AI can identify trends and compare."),
  previousPeriodDescription: z.string().optional()
    .describe("A label for the previous period (e.g. 'شهر أيار 2026') for use in comparisons."),
  totalBudget: z.number().optional().describe("The user's total budget for the period (if applicable)."),
  periodDescription: z.string().describe("A description of the time period being analyzed (e.g., 'this month', 'the year 2023')."),
  appTone: z.enum(['formal', 'colloquial']).optional().describe("The desired tone. 'formal' = Modern Standard Arabic. 'colloquial' = friendly Iraqi dialect."),
  currency: z.string().optional().describe("The user's currency code (IQD, USD, ...). Defaults to IQD."),
});
export type AnalyzeSpendingPatternsInput = z.infer<typeof AnalyzeSpendingPatternsInputSchema>;

const AnalysisPointSchema = z.object({
    icon: z.enum(["TrendingUp", "TrendingDown", "Wallet", "PieChart"]).describe("A suitable Lucide icon name for the analysis point."),
    text: z.string().describe("The analytical observation, presented as a factual statement."),
});

const AnalyzeSpendingPatternsOutputSchema = z.object({
    performanceSummary: z.string().describe("A single, concise sentence summarizing the spending performance during the period. It should be neutral and data-driven."),
    highestSpendingCategory: z.object({
        category: z.string().describe("The name of the category with the highest spending."),
        amount: z.number().describe("The total amount spent in that category."),
        percentage: z.number().describe("The percentage of total spending that this category represents (0-100)."),
    }).describe("The single category with the highest total spending in the period."),
    keyObservations: z.array(AnalysisPointSchema).min(2).max(2).describe("Exactly two key, data-driven observations about the spending patterns. These should be analytical, not prescriptive advice."),
});
export type AnalyzeSpendingPatternsOutput = z.infer<typeof AnalyzeSpendingPatternsOutputSchema>;
export type AnalyzeSpendingPatternsResult = AnalyzeSpendingPatternsOutput | null;

/**
 * كل رقم يراه المستخدم في هذه البطاقة يُحسب هنا — لا في النموذج.
 *
 * سبب هذا حادثة حقيقية (2026-09-03): كانت البطاقة تسلّم قائمة المصاريف الخام
 * وتطلب من النموذج أن يجمعها بنفسه، ومع `thinkingBudget:0` أي بلا استدلال.
 * فظهر مجموع أيلول ٢٩٩٠٠٠ في «التحليل الذكي» بينما الشاشة الرئيسية تعرض رقماً
 * آخر للشهر نفسه — رقمان متضاربان لنفس البيانات، وأحدهما تقدير لا عدّ. ونقص
 * فارزة المراتب كان عَرَضاً لنفس السبب: الرقم كان يُكتب داخل جملة يؤلّفها
 * النموذج، لا رقماً يُنسّقه التطبيق.
 *
 * نفس نمط `financial-coach.computeSummary`: دور النموذج الصياغة بالعربية،
 * والحساب مسؤولية الكود وحده.
 */
function computeSummary(input: AnalyzeSpendingPatternsInput) {
  const code = (input.currency ?? 'IQD') as CurrencyCode;
  const { symbol, position } = CURRENCIES[code] ?? CURRENCIES.IQD;
  // النصّ يُسلَّم للنموذج جاهزاً بفارزته ورمز عملته، فلا يعيد تنسيقه ولا يخترعه.
  const money = (n: number) => {
    const num = Math.round(n).toLocaleString('en-US');
    return position === 'before' ? `${symbol}${num}` : `${num} ${symbol}`;
  };
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const sum = (list: { amount: number }[]) => list.reduce((s, e) => s + (e.amount || 0), 0);

  const totalSpent = sum(input.expenses);

  const byCategory = new Map<string, number>();
  input.expenses.forEach(e => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (e.amount || 0)));
  const categories = [...byCategory.entries()]
    .map(([name, amount]) => ({
      name,
      amount,
      amountText: money(amount),
      percentage: totalSpent > 0 ? round1((amount / totalSpent) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const top = categories[0] ?? { name: '—', amount: 0, amountText: money(0), percentage: 0 };

  const prevTotal = input.previousPeriodExpenses?.length ? sum(input.previousPeriodExpenses) : null;
  const change = prevTotal && prevTotal > 0 ? round1(((totalSpent - prevTotal) / prevTotal) * 100) : null;
  const prevLabel = input.previousPeriodDescription ?? '';

  const comparison = change === null ? null
    : change > 0 ? `بارتفاع ${Math.abs(change)}% عن ${prevLabel}`
    : change < 0 ? `بانخفاض ${Math.abs(change)}% عن ${prevLabel}`
    : `بمستوى مماثل لـ${prevLabel}`;

  return {
    totalSpent,
    totalSpentText: money(totalSpent),
    budgetText: input.totalBudget ? money(input.totalBudget) : null,
    categories,
    top,
    prevTotalText: prevTotal === null ? null : money(prevTotal),
    changeAbs: change === null ? null : Math.abs(change),
    comparison,
    // جملة يبنيها الكود بالكامل — شبكةُ أمان لو حادت جملة النموذج عن الرقم.
    fallbackSummary: `بلغ إجمالي إنفاقك ${money(totalSpent)} في ${input.periodDescription}${comparison ? `، ${comparison}` : ''}.`,
  };
}

const SummarySchema = z.object({
  totalSpentText: z.string(),
  budgetText: z.string().nullable(),
  categories: z.array(z.object({ name: z.string(), amountText: z.string(), percentage: z.number() })),
  top: z.object({ name: z.string(), amountText: z.string(), percentage: z.number() }),
  prevTotalText: z.string().nullable(),
  changeAbs: z.number().nullable(),
  comparison: z.string().nullable(),
});

// isColloquial تُحسب في الكود لا داخل القالب: قوالب Genkit تعمل بـ
// knownHelpersOnly، فلا تعرف مساعداً اسمه eq وترفض القالب عند تجميعه.
const AnalyzeSpendingPatternsPromptInputSchema = z.object({
  periodDescription: z.string(),
  previousPeriodDescription: z.string().optional(),
  isColloquial: z.boolean(),
  summary: SummarySchema,
});

const prompt = ai.definePrompt({
  name: 'analyzeSpendingPatternsPrompt',
  input: {schema: AnalyzeSpendingPatternsPromptInputSchema},
  output: {schema: AnalyzeSpendingPatternsOutputSchema},
  prompt: `You are a data analyst AI for a personal finance app. Analyze the user's spending and provide objective, data-driven insights. Do NOT give advice or coaching language — state facts only. All responses must be in Arabic.

**Tone:** {{#if isColloquial}}Use friendly Iraqi dialect (عامية عراقية). Short and warm.{{else}}Use professional Modern Standard Arabic (فصحى).{{/if}}

---
CRITICAL: Every figure below is PRE-COMPUTED and VERIFIED by the application.
- Copy the money strings EXACTLY as written — they already carry thousands separators and the correct currency symbol.
- DO NOT recalculate, re-sum, re-derive, round, reformat, or convert any number.
- DO NOT state any number that does not appear verbatim below.
- DO NOT add, subtract, or combine two figures together.

**Period:** {{periodDescription}}
**Total spent:** {{summary.totalSpentText}}
{{#if summary.budgetText}}**Budget:** {{summary.budgetText}}{{/if}}

**Spending by category (pre-computed, sorted highest first):**
{{#each summary.categories}}- {{this.name}}: {{this.amountText}} ({{this.percentage}}%)
{{/each}}

{{#if summary.prevTotalText}}
**Previous period ({{previousPeriodDescription}}):** {{summary.prevTotalText}}
**Verified comparison phrase:** {{summary.comparison}}
{{/if}}

---
**Instructions:**

1. **performanceSummary** — One neutral Arabic sentence stating the total spent for the period. It MUST contain the string "{{summary.totalSpentText}}" exactly as given.{{#if summary.comparison}} Then append the verified comparison, reusing "{{summary.comparison}}" as given.{{/if}}

2. **highestSpendingCategory** — Copy verbatim, do not compute:
   - category: "{{summary.top.name}}"
   - amount: the numeric value of {{summary.top.amountText}} without separators or symbol
   - percentage: {{summary.top.percentage}}

3. **keyObservations** — Exactly 2 factual observations in Arabic. Each may reference AT MOST ONE category from the table above, quoting its amount or percentage exactly as listed. Never combine or total two categories. NEVER give advice — state facts only.
   - Icons: TrendingUp / TrendingDown for trend statements, PieChart for distribution, Wallet for totals.

Respond strictly in the specified JSON format.
`,
});

const analyzeSpendingPatternsFlow = ai.defineFlow(
  {
    name: 'analyzeSpendingPatternsFlow',
    inputSchema: AnalyzeSpendingPatternsInputSchema,
    outputSchema: AnalyzeSpendingPatternsOutputSchema,
  },
  async (input) => {
    const summary = computeSummary(input);

    const {output} = await prompt(
      {
        periodDescription: input.periodDescription,
        previousPeriodDescription: input.previousPeriodDescription,
        isColloquial: input.appTone === 'colloquial',
        summary,
      },
      { config: { thinkingConfig: { thinkingBudget: 0 } } },
    );
    if (!output) throw new Error('لم يُرجع النموذج تحليلاً.');

    // حارسان حاسمان: التوجيه وحده لا يكفي — ما يُعرض كرقم يُفرَض من الحساب.
    output.highestSpendingCategory = {
      category: summary.top.name,
      amount: summary.top.amount,
      percentage: summary.top.percentage,
    };
    if (!output.performanceSummary?.includes(summary.totalSpentText)) {
      output.performanceSummary = summary.fallbackSummary;
    }

    return output;
  }
);

export async function analyzeSpendingPatterns(input: AnalyzeSpendingPatternsInput): Promise<AnalyzeSpendingPatternsOutput | null> {
  if (input.expenses.length === 0) return null;
  return analyzeSpendingPatternsFlow(input);
}
