// src/ai/flows/financial-planner.ts
'use server';
/**
 * @fileOverview A sophisticated financial planning AI agent.
 *
 * - financialPlanner - A function that generates a personalized financial plan to achieve a user's goal.
 * - FinancialPlannerInput - The input type for the financialPlanner function.
 * - FinancialPlannerOutput - The return type for the financialPlanner function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UserProfileSchema = z.object({
    monthlyIncome: z.number().describe("The user's approximate monthly income in IQD."),
    familyMembers: z.array(z.object({
        type: z.enum(['adult', 'child']).describe("The type of family member."),
        age: z.number().describe("The age of the family member.")
    })).describe("A list of all family members, including the user. The AI should infer if a member is a child or an adult based on their age (e.g., age < 18 is a child)."),
}).describe("The user's personal profile information.");

const FinancialGoalSchema = z.object({
    name: z.string().describe("The name of the financial goal (e.g., 'Buy a new car')."),
    targetAmount: z.number().describe("The total amount needed to achieve the goal in IQD."),
    targetDate: z.string().describe("The target date to achieve the goal in YYYY-MM-DD format."),
}).describe("The user's financial goal.");

const FinancialPlannerInputSchema = z.object({
  userProfile: UserProfileSchema,
  goal: FinancialGoalSchema,
  expenses: z.array(
      z.object({
          title: z.string(),
          amount: z.number(),
          category: z.string(),
          date: z.string(),
      })
  ).describe("An array of the user's historical expenses from the last 3-6 months."),
   userMessage: z.string().optional().describe("An optional message from the user providing more context or specific questions about their goal."),
});
export type FinancialPlannerInput = z.infer<typeof FinancialPlannerInputSchema>;

const PlanStepSchema = z.object({
    title: z.string().describe("A short, clear title for this step of the plan."),
    description: z.string().describe("A detailed, actionable description of what the user needs to do for this step."),
    suggestedMonthlySaving: z.number().describe("The suggested amount in IQD the user can save per month by following this step."),
    categoryToImpact: z.string().optional().describe("The spending category most impacted by this step (e.g., 'Entertainment', 'Food').")
});

const FinancialPlannerOutputSchema = z.object({
    initialAssessment: z.string().describe("A brief (2-3 sentences) opening assessment of the user's situation regarding their goal, written in a professional and encouraging tone."),
    savingsRequiredPerMonth: z.number().describe("The calculated amount the user must save each month to reach their goal on time."),
    isAchievable: z.boolean().describe("A realistic assessment of whether the goal is achievable with the user's current income and spending habits."),
    suggestedPlan: z.array(PlanStepSchema).describe("An array of 3-5 concrete, actionable steps the user can take to achieve their monthly savings target."),
    motivationalMessage: z.string().describe("A final, encouraging message to motivate the user to start their plan."),
});
export type FinancialPlannerOutput = z.infer<typeof FinancialPlannerOutputSchema>;

export async function financialPlanner(input: FinancialPlannerInput): Promise<FinancialPlannerOutput> {
  return financialPlannerFlow(input);
}

const prompt = ai.definePrompt({
    name: 'financialPlannerPrompt',
    input: {schema: FinancialPlannerInputSchema},
    output: {schema: FinancialPlannerOutputSchema},
    prompt: `You are a highly skilled, logical, and encouraging financial planner for an Iraqi user. Your primary goal is to create a realistic, actionable, and personalized financial plan to help the user achieve a specific goal. All responses must be in Arabic.

    **User's Financial Context:**
    - **Profile:**
        - Monthly Income: {{userProfile.monthlyIncome}} د.ع
        - **Family Members:** 
        {{#if userProfile.familyMembers}}
            {{#each userProfile.familyMembers}}
            - A {{this.type}} aged {{this.age}}
            {{/each}}
        {{else}}
            - Just the user.
        {{/if}}
    - **Goal:**
        - Goal Name: "{{goal.name}}"
        - Target Amount: {{goal.targetAmount}} د.ع
        - Target Date: {{goal.targetDate}}
    - **Historical Spending:** (A list of recent expenses is provided below)
    {{#each expenses}}
    - "{{this.title}}" / {{this.amount}} د.ع / Category: "{{this.category}}" / Date: {{this.date}}
    {{/each}}
    - **User's Additional Context:** "{{userMessage}}"

    **Your Task:**
    Based on all the provided information, generate a comprehensive financial plan. Follow these steps precisely:

    1.  **Calculate Required Savings:** First, calculate the number of months between today and the \`targetDate\`. Then, divide the \`targetAmount\` by the number of months to determine the \`savingsRequiredPerMonth\`.

    2.  **Write Initial Assessment:** Start with a professional and encouraging \`initialAssessment\`. Acknowledge their goal and briefly state their current financial standing in relation to it.

    3.  **Assess Achievability:** Analyze their monthly income versus their historical spending and the newly calculated \`savingsRequiredPerMonth\`. Set the \`isAchievable\` flag to \`true\` if their income can realistically cover their spending AND the required savings. Be conservative; if it's too tight, set it to \`false\`.

    4.  **Develop the Plan (\`suggestedPlan\`):** This is the most critical part. Create 3-5 concrete, actionable steps.
        -   **Analyze Spending:** Scrutinize the user's expense history to identify categories with high or non-essential spending (e.g., 'ترفيه', 'كماليات شخصية', 'طعام' if it contains many restaurant items).
        -   **Create Actionable Steps:** For each step, provide a clear \`title\` and a detailed \`description\`. Instead of just saying "spend less," give specific, creative ideas. For example, "تحدي الطبخ المنزلي" instead of "قلل مصاريف المطاعم".
        -   **Assign Savings Targets:** For each step, estimate a realistic \`suggestedMonthlySaving\` amount. The sum of these savings should ideally get close to the \`savingsRequiredPerMonth\`.
        -   **Be Logical and Realistic:** The plan should make sense for someone with the user's income and family structure. Take the ages of family members into account, as children have different financial implications than adults (e.g., education, healthcare, supplies).

    5.  **Write a Motivational Message:** Conclude with a powerful and encouraging \`motivationalMessage\` to inspire the user to begin their financial journey.

    Ensure the final output is a valid JSON object matching the FinancialPlannerOutputSchema.
    `,
});

const financialPlannerFlow = ai.defineFlow(
  {
    name: 'financialPlannerFlow',
    inputSchema: FinancialPlannerInputSchema,
    outputSchema: FinancialPlannerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
