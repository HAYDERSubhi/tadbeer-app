// src/ai/flows/financial-chat.ts
'use server';
/**
 * @fileOverview Multi-turn financial chat AI flow.
 * Accepts conversation history + a compact financial context string,
 * and returns a single assistant reply.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const FinancialChatInputSchema = z.object({
  messages: z.array(MessageSchema).describe('Full conversation history so far.'),
  financialContext: z
    .string()
    .describe("A compact JSON string summarising the user's current financial data."),
  appTone: z
    .enum(['formal', 'colloquial'])
    .optional()
    .describe("'formal' = MSA, 'colloquial' = friendly Iraqi dialect."),
});
export type FinancialChatInput = z.infer<typeof FinancialChatInputSchema>;

const FinancialChatOutputSchema = z.object({
  reply: z.string().describe('The assistant reply in Arabic.'),
});
export type FinancialChatOutput = z.infer<typeof FinancialChatOutputSchema>;

export async function financialChat(
  input: FinancialChatInput
): Promise<FinancialChatOutput> {
  return financialChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'financialChatPrompt',
  input: { schema: FinancialChatInputSchema },
  output: { schema: FinancialChatOutputSchema },
  prompt: `أنت "مستشار الجيب" — مساعد مالي ذكي مدمج في تطبيق تدبير لإدارة المصاريف.
لديك معرفة كاملة بالبيانات المالية للمستخدم المُدرجة أدناه.

{{#if appTone}}
{{#if (eq appTone "colloquial")}}
**الأسلوب:** استخدم لهجة عراقية دافئة وودية. تكلم بطبيعية مثل صديق يفهم بالمال.
{{else}}
**الأسلوب:** استخدم اللغة العربية الفصحى بأسلوب مهني ومشجع.
{{/if}}
{{/if}}

**قواعد مهمة:**
- أجب فقط على الأسئلة المتعلقة بالمال والإنفاق والميزانية والأهداف.
- إذا سُئلت عن شيء خارج نطاق الأمور المالية، أعد المستخدم بلطف للموضوع.
- اجعل إجاباتك موجزة وعملية — لا تطل بلا داعٍ.
- عند ذكر مبالغ، استخدم تنسيق الأرقام مع الفواصل (مثل: 1,250,000 د.ع).
- إذا كانت البيانات غير كافية للإجابة، قل ذلك بوضوح.

**البيانات المالية الحالية للمستخدم:**
\`\`\`json
{{financialContext}}
\`\`\`

**سجل المحادثة:**
{{#each messages}}
{{#if (eq this.role "user")}}[المستخدم]: {{this.content}}
{{else}}[المستشار]: {{this.content}}
{{/if}}
{{/each}}

الآن أجب على آخر رسالة من المستخدم فقط. لا تعيد كتابة السؤال.`,
});

const financialChatFlow = ai.defineFlow(
  {
    name: 'financialChatFlow',
    inputSchema: FinancialChatInputSchema,
    outputSchema: FinancialChatOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, {
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return output!;
  }
);
