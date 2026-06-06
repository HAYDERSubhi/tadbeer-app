// src/ai/flows/parse-bank-sms.ts
'use server';

/**
 * @fileOverview Parses an Iraqi bank SMS / app notification text into a
 * structured expense. Understands Arabic + English bank messages from common
 * Iraqi card providers (Al-Ahli, Qi Card, Tabadul, Zain Cash, etc.).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseBankSmsInputSchema = z.object({
  smsText: z.string().describe('The raw bank SMS or notification text.'),
  categories: z
    .record(z.string(), z.string())
    .describe('Map of category IDs to Arabic names for classification.'),
});
export type ParseBankSmsInput = z.infer<typeof ParseBankSmsInputSchema>;

const ParseBankSmsOutputSchema = z.object({
  isExpense: z
    .boolean()
    .describe(
      'true if the message describes a debit/purchase/withdrawal (money leaving the account). ' +
      'false if it is a credit (deposit), an OTP code, a promo, a balance inquiry, or unrelated text.'
    ),
  amount: z.number().describe('The transaction amount as a plain number. 0 if not found.'),
  description: z
    .string()
    .describe('Short Arabic description: the merchant/place if present, otherwise a generic label.'),
  category: z.string().describe('The best-matching category ID from the provided list.'),
  date: z.string().describe('Transaction date in YYYY-MM-DD format. Default to today if not present.'),
  cardOrBank: z
    .string()
    .optional()
    .describe('Detected card/bank name in Arabic (e.g. "المصرف الأهلي العراقي", "كي كارد", "تبادل").'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('How confident the extraction is, based on message clarity.'),
});
export type ParseBankSmsOutput = z.infer<typeof ParseBankSmsOutputSchema>;

export async function parseBankSms(input: ParseBankSmsInput): Promise<ParseBankSmsOutput> {
  return parseBankSmsFlow(input);
}

const parseBankSmsFlow = ai.defineFlow(
  {
    name: 'parseBankSmsFlow',
    inputSchema: ParseBankSmsInputSchema,
    outputSchema: ParseBankSmsOutputSchema,
  },
  async (input) => {
    const categoriesList = Object.entries(input.categories)
      .map(([id, name]) => `- ${id}: ${name}`)
      .join('\n');

    const todayISO = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const promptText = `أنت مساعد متخصص في تحليل الرسائل والإشعارات البنكية العراقية واستخراج المصاريف منها.

## تاريخ اليوم
تاريخ اليوم الفعلي هو: ${todayISO}. إذا لم يُذكر تاريخ صراحةً في الرسالة، استخدم هذا التاريخ.

## مزوّدو البطاقات الشائعون في العراق
- المصرف الأهلي العراقي (Al-Ahli / NBI)
- كي كارد (Qi Card / International Smart Card)
- تبادل (Tabadul)
- زين كاش (Zain Cash)، آسيا حوالة، الرافدين، الرشيد، الماستر كارد/فيزا المحلية

## ما يجب أن تفعله
1. حدّد هل الرسالة تخصّ **عملية خصم/شراء/سحب** (المال يخرج من الحساب). إذا نعم: isExpense = true.
2. إذا كانت الرسالة **إيداع/راتب/رمز تحقق (OTP)/إعلان/استعلام رصيد** أو غير متعلقة بمصروف: isExpense = false (واترك القيم الأخرى بأفضل تقدير أو أصفار).
3. استخرج المبلغ كرقم صحيح (تجاهل الفواصل ورموز العملة). الأرقام العربية (٢٥٠٠٠) عاملها كأرقام عادية (25000).
4. استخرج اسم التاجر/المتجر إن وُجد ليكون الوصف؛ وإلا اكتب وصفاً عاماً مثل "عملية شراء بالبطاقة".
5. تعرّف على اسم البطاقة/المصرف من الرسالة وضعه في cardOrBank بالعربية.
6. اختر أنسب فئة من القائمة أدناه.

## الفئات المتاحة (ID: الاسم)
${categoriesList}

## الرسالة البنكية للتحليل
"""
${input.smsText}
"""

## مهم
- amount رقم صحيح فقط
- category يجب أن يكون أحد الـ IDs بالضبط
- date بصيغة YYYY-MM-DD
- إذا كانت العملية إيداعاً أو غير مصروف، اجعل isExpense = false`;

    const { output } = await ai.generate({
      output: { schema: ParseBankSmsOutputSchema },
      config: { thinkingConfig: { thinkingBudget: 0 } },
      prompt: promptText,
    });

    if (!output) throw new Error('No output from Gemini');
    return output;
  }
);
