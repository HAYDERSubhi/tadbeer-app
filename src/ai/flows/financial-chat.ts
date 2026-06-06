// src/ai/flows/financial-chat.ts
'use server';
/**
 * @fileOverview Multi-turn financial chat AI flow.
 * Builds the prompt programmatically (no Handlebars) to avoid HTML-escaping
 * issues with JSON context and Arabic message content.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const FinancialChatInputSchema = z.object({
  messages: z.array(MessageSchema).describe('Full conversation history.'),
  financialContext: z
    .string()
    .describe("Compact JSON string of the user's financial data."),
  appTone: z
    .enum(['formal', 'colloquial'])
    .optional(),
});
export type FinancialChatInput = z.infer<typeof FinancialChatInputSchema>;

const FinancialChatOutputSchema = z.object({
  reply: z.string(),
});
export type FinancialChatOutput = z.infer<typeof FinancialChatOutputSchema>;

export async function financialChat(
  input: FinancialChatInput
): Promise<FinancialChatOutput> {
  return financialChatFlow(input);
}

const financialChatFlow = ai.defineFlow(
  {
    name: 'financialChatFlow',
    inputSchema: FinancialChatInputSchema,
    outputSchema: FinancialChatOutputSchema,
  },
  async (input) => {
    const toneInstruction =
      input.appTone === 'colloquial'
        ? 'استخدم لهجة عراقية دافئة وودية. تكلم بطبيعية مثل صديق يفهم بالمال.'
        : 'استخدم اللغة العربية الفصحى بأسلوب مهني ومشجع.';

    // Build conversation history as plain text
    const history = input.messages
      .map((m) =>
        m.role === 'user'
          ? `[المستخدم]: ${m.content}`
          : `[مستشار الجيب]: ${m.content}`
      )
      .join('\n\n');

    const fullPrompt = `أنت "مستشار الجيب" — مساعد مالي ذكي مدمج في تطبيق تدبير لإدارة المصاريف.
لديك معرفة كاملة بالبيانات المالية للمستخدم المُدرجة أدناه.

الأسلوب: ${toneInstruction}

قواعد مهمة:
- أجب فقط على الأسئلة المتعلقة بالمال والإنفاق والميزانية والأهداف.
- إذا سُئلت عن شيء خارج نطاق الأمور المالية، أعد المستخدم بلطف للموضوع.
- اجعل إجاباتك موجزة وعملية.
- عند ذكر مبالغ استخدم تنسيق الأرقام مع الفواصل (مثل: 1,250,000 د.ع).

البيانات المالية الحالية للمستخدم:
${input.financialContext}

سجل المحادثة:
${history}

أجب على آخر رسالة من المستخدم فقط. لا تعيد كتابة السؤال. لا تضف أي مقدمة.`;

    const response = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: fullPrompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });

    return { reply: response.text.trim() };
  }
);
