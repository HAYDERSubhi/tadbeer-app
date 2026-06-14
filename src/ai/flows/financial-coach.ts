
'use server';
/**
 * @fileOverview A financial coach AI that provides personalized tips.
 *
 * - financialCoach - A function that analyzes spending and provides advice.
 * - FinancialCoachInput - The input type for the financialCoach function.
 * - FinancialCoachOutput - The return type for the financialCoach function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialCoachInputSchema = z.object({
  totalBudget: z.number().describe("The user's total monthly budget in IQD. If this value is 0, it means the user has not set a budget."),
  zeroSpendDaysTarget: z.number().describe("The user's monthly goal for low-spending days."),
  currentDate: z.string().describe("Today's date in YYYY-MM-DD format (Asia/Baghdad timezone)."),
  dayOfMonth: z.number().describe("The current day of the month (1-31)."),
  daysLeftInMonth: z.number().describe("How many days are left in the current month including today."),
  expenses: z.array(
      z.object({
          title: z.string(),
          amount: z.number(),
          category: z.string(),
          date: z.string(),
      })
  ).describe("An array of the user's expenses for the current month."),
  categoryBudgets: z.record(z.string(), z.number()).optional().describe("A map of category names to their specific monthly budget in IQD."),
  userProfile: z.object({
    monthlyIncome: z.number().describe("The user's approximate monthly income in IQD."),
    familyMembers: z.array(z.object({
        type: z.enum(['adult', 'child']).describe("The type of family member."),
        age: z.number().describe("The age of the family member.")
    })).describe("A list of all family members, including the user."),
  }).optional().describe("The user's profile, including income and family members."),
  appTone: z.enum(['formal', 'colloquial']).optional().describe("The desired tone for the AI's response."),
});
export type FinancialCoachInput = z.infer<typeof FinancialCoachInputSchema>;

const FinancialCoachOutputSchema = z.object({
    insights: z.array(
        z.object({
            title: z.string().describe("A short, catchy title for the insight."),
            description: z.string().describe("A one-sentence, very concise description of the advice or observation."),
            icon: z.enum(["Trophy", "Leaf", "Flame", "TrendingUp", "Lightbulb", "PiggyBank", "Baby", "School"]).describe("A suitable Lucide icon name for the insight."),
            type: z.enum(['praise', 'tip', 'warning']).describe("The type of insight, used for styling."),
        })
    ).describe("An array of the 3 most important and personalized financial insights."),
});
export type FinancialCoachOutput = z.infer<typeof FinancialCoachOutputSchema>;

// Pre-compute all numbers before calling the AI so it never needs to calculate.
function computeSummary(input: FinancialCoachInput) {
  const totalSpent = input.expenses.reduce((sum, e) => sum + e.amount, 0);
  const daysInMonth = input.dayOfMonth + input.daysLeftInMonth - 1;
  const budgetUsedPercent = input.totalBudget > 0
    ? Math.round((totalSpent / input.totalBudget) * 100)
    : 0;
  const remainingBudget = Math.max(0, input.totalBudget - totalSpent);
  const dailyRate = input.dayOfMonth > 0 ? totalSpent / input.dayOfMonth : 0;
  const projectedMonthlySpend = Math.round(dailyRate * daysInMonth);
  const projectedVsBudgetPercent = input.totalBudget > 0
    ? Math.round((projectedMonthlySpend / input.totalBudget) * 100)
    : 0;

  // Spending by category
  const categoryTotals: Record<string, number> = {};
  for (const e of input.expenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  }
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, amount]) => ({
      name,
      amount,
      percent: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
    }));

  // Category budget alerts (>70% used)
  const categoryBudgetAlerts: { name: string; spent: number; budget: number; percent: number }[] = [];
  if (input.categoryBudgets) {
    for (const [name, budget] of Object.entries(input.categoryBudgets)) {
      const spent = categoryTotals[name] ?? 0;
      const percent = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      if (percent >= 70) {
        categoryBudgetAlerts.push({ name, spent, budget, percent });
      }
    }
    categoryBudgetAlerts.sort((a, b) => b.percent - a.percent);
  }

  // Low-spend days: days where spending < 10% of average daily spend
  const avgDailySpend = dailyRate;
  const lowSpendThreshold = avgDailySpend * 0.1;
  const spendByDate: Record<string, number> = {};
  for (const e of input.expenses) {
    spendByDate[e.date] = (spendByDate[e.date] ?? 0) + e.amount;
  }
  const lowSpendDaysCount = Object.values(spendByDate).filter(d => d <= lowSpendThreshold).length;

  return {
    totalSpent,
    budgetUsedPercent,
    remainingBudget,
    projectedMonthlySpend,
    projectedVsBudgetPercent,
    daysInMonth,
    topCategories,
    categoryBudgetAlerts,
    lowSpendDaysCount,
  };
}

const FinancialCoachPromptInputSchema = FinancialCoachInputSchema.extend({
    isColloquial: z.boolean(),
    summary: z.object({
        totalSpent: z.number(),
        budgetUsedPercent: z.number(),
        remainingBudget: z.number(),
        projectedMonthlySpend: z.number(),
        projectedVsBudgetPercent: z.number(),
        daysInMonth: z.number(),
        topCategories: z.array(z.object({ name: z.string(), amount: z.number(), percent: z.number() })),
        lowSpendDaysCount: z.number(),
        categoryBudgetAlerts: z.array(z.object({ name: z.string(), spent: z.number(), budget: z.number(), percent: z.number() })),
    }),
});

const prompt = ai.definePrompt({
    name: 'financialCoachPrompt',
    input: {schema: FinancialCoachPromptInputSchema},
    output: {schema: FinancialCoachOutputSchema},
    prompt: `You are a financial coach for an Iraqi user. Provide exactly 3 unique and distinct insights to help them build healthy spending habits.

Your response MUST follow the persona dictated by the appTone parameter. Currency is Iraqi Dinar (دينار).

⚠️ CRITICAL: All numbers below are PRE-COMPUTED and VERIFIED. Use these exact numbers. DO NOT recalculate or re-sum from the expense list.

---
PRE-COMPUTED SUMMARY:
- Today: {{currentDate}} — Day {{dayOfMonth}} of {{summary.daysInMonth}} ({{daysLeftInMonth}} days remaining)
- Monthly budget: {{totalBudget}} د.ع
- Total spent so far: {{summary.totalSpent}} د.ع
- Budget used: {{summary.budgetUsedPercent}}% of monthly budget
- Remaining budget: {{summary.remainingBudget}} د.ع
- Projected spend by end of month: {{summary.projectedMonthlySpend}} د.ع ({{summary.projectedVsBudgetPercent}}% of budget)
- Zero/low-spend days goal: {{zeroSpendDaysTarget}} — achieved so far: {{summary.lowSpendDaysCount}} days

Top spending categories:
{{#each summary.topCategories}}
- {{this.name}}: {{this.amount}} د.ع ({{this.percent}}% of spending)
{{/each}}

{{#if summary.categoryBudgetAlerts}}
Category budget alerts (>70% used):
{{#each summary.categoryBudgetAlerts}}
- {{this.name}}: spent {{this.spent}} of {{this.budget}} د.ع ({{this.percent}}%)
{{/each}}
{{/if}}

{{#if userProfile.familyMembers}}
Family Members:
{{#each userProfile.familyMembers}}
- A {{this.type}} aged {{this.age}}
{{/each}}
{{/if}}

---
DECISION RULES (apply strictly based on pre-computed numbers):

1. OVERALL BUDGET STATUS — based on budgetUsedPercent:
   - ≥ 85%: CRITICAL WARNING — user is close to exceeding budget. type=warning, icon=Lightbulb
   - 70–84%: CAUTION — user should slow down. type=warning, icon=Lightbulb
   - < 70%: User is within budget — do NOT warn. Praise or tip only.

2. PROJECTED SPEND — based on projectedVsBudgetPercent:
   - ≥ 110%: warn that at this rate budget will be exceeded. type=warning
   - 85–109%: note the pace, mild caution
   - < 85%: healthy pace — this is praiseworthy. type=praise, icon=TrendingUp or PiggyBank

3. CATEGORY ALERTS: If categoryBudgetAlerts is non-empty, mention the top one as a warning.

4. LOW-SPEND DAYS: If lowSpendDaysCount >= half of zeroSpendDaysTarget, praise the user. type=praise, icon=Trophy

5. TOP CATEGORY TIP: Pick the largest category from topCategories and give a practical saving tip. type=tip, icon=Leaf

PRIORITY ORDER for your 3 insights:
1. Most urgent warning (budget or category), IF warranted by numbers
2. Most actionable tip (top spending category)
3. Praise or motivation based on actual data

FINAL RULE: NEVER give a warning when the numbers show the user is doing well. If budgetUsedPercent < 70% AND projectedVsBudgetPercent < 85%, the user is doing great — lead with praise, not a warning.

---
PERSONA:

{{#if isColloquial}}
Persona "كرومي": Friendly, witty Iraqi dialect. Like a close friend.
- All text in Iraqi colloquial Arabic.
- Encouraging, sometimes humorous. Never preachy.
- Warning example: "دير بالك عالمصرف! صارلك {{summary.budgetUsedPercent}}% من الميزانية."
- Praise example: "عاشت الأيادي! معدل صرفك هذا الشهر كلش زين."
- Tip example: "فلوسك طايرة على [category]، ليش ما تجرب بديل أرخص؟"
{{else}}
Persona "أستاذ حريص": Professional Modern Standard Arabic. Warm and logical.
- All text in Modern Standard Arabic.
- Warning example: "تنبيه: لقد استهلكت {{summary.budgetUsedPercent}}% من ميزانيتك الشهرية."
- Praise example: "أداء ممتاز! أنت على المسار الصحيح هذا الشهر."
- Tip example: "نفقات [category] مرتفعة — ما رأيك بتجربة بدائل أكثر توفيرًا؟"
{{/if}}

Output valid JSON strictly following the chosen persona's language.
`,
});

const financialCoachFlow = ai.defineFlow(
  {
    name: 'financialCoachFlow',
    inputSchema: FinancialCoachInputSchema,
    outputSchema: FinancialCoachOutputSchema,
  },
  async (input) => {
    const summary = computeSummary(input);
    const promptInput = {
      ...input,
      isColloquial: input.appTone === 'colloquial',
      summary,
    };
    const {output} = await prompt(promptInput, {
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return output!;
  }
);

export async function financialCoach(input: FinancialCoachInput): Promise<FinancialCoachOutput> {
  if (input.expenses.length === 0) {
    return { insights: [] };
  }
  return financialCoachFlow(input);
}
