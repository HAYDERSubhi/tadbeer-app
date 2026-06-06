// src/ai/flows/record-expense-voice.ts
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecordExpenseWithVoiceInputSchema = z.object({
  voiceRecordingDataUri: z
    .string()
    .describe(
      "A voice recording as a data URI: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  categories: z
    .record(z.string(), z.string())
    .describe('Map of category IDs to Arabic names.'),
});
export type RecordExpenseWithVoiceInput = z.infer<typeof RecordExpenseWithVoiceInputSchema>;

const RecordExpenseWithVoiceOutputSchema = z.object({
  amount: z.number().describe('The expense amount as a plain number.'),
  category: z.string().describe('The category ID from the provided list.'),
  date: z.string().describe('Date in YYYY-MM-DD format. Default to today if not mentioned.'),
  description: z.string().optional().describe('Short Arabic description of the expense.'),
});
export type RecordExpenseWithVoiceOutput = z.infer<typeof RecordExpenseWithVoiceOutputSchema>;

export async function recordExpenseWithVoice(
  input: RecordExpenseWithVoiceInput
): Promise<RecordExpenseWithVoiceOutput> {
  return recordExpenseWithVoiceFlow(input);
}

const recordExpenseWithVoiceFlow = ai.defineFlow(
  {
    name: 'recordExpenseWithVoiceFlow',
    inputSchema: RecordExpenseWithVoiceInputSchema,
    outputSchema: RecordExpenseWithVoiceOutputSchema,
  },
  async (input) => {
    const categoriesList = Object.entries(input.categories)
      .map(([id, name]) => `- ${id}: ${name}`)
      .join('\n');

    // Real "today" in Baghdad timezone so the model never guesses an old date.
    const todayISO = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()); // → YYYY-MM-DD

    const promptText = `أنت مساعد ذكي متخصص في تسجيل المصاريف من التسجيلات الصوتية باللهجة العراقية.

## مهمتك
استمع للتسجيل الصوتي واستخرج بيانات المصروف.

## تاريخ اليوم
تاريخ اليوم الفعلي هو: ${todayISO}
إذا لم يذكر المستخدم تاريخاً صراحةً، استخدم تاريخ اليوم هذا بالضبط (${todayISO}).
"اليوم" = ${todayISO}. "أمس" = اليوم ناقص يوم واحد. لا تخمّن تاريخاً من معلوماتك القديمة.

## أمثلة على الأرقام العراقية
- "خمسين ألف" = 50000
- "مية ألف" = 100000
- "عشرتالاف" = 10000
- "ألفين وخمسمية" = 2500
- "خمسة وعشرين" = 25000 (في سياق المصاريف اليومية)

## التعليمات
1. استمع بعناية للتسجيل
2. استخرج: المبلغ، وصف المصروف، والتاريخ
3. اختر أنسب فئة من القائمة أدناه
4. أعد إجابة JSON صحيحة دائماً

## الفئات المتاحة (ID: الاسم)
${categoriesList}

## مهم
- amount يجب أن يكون رقم صحيح (مثال: 50000 وليس "خمسين ألف")
- category يجب أن يكون أحد الـ IDs بالضبط
- date بصيغة YYYY-MM-DD، والافتراضي هو ${todayISO}
- description وصف قصير بالعربية`;

    // Extract MIME type from data URI
    const mimeMatch = input.voiceRecordingDataUri.match(/^data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';

    const { output } = await ai.generate({
      output: { schema: RecordExpenseWithVoiceOutputSchema },
      // Disable "thinking" — this is a simple extraction task, and thinking
      // adds significant latency on gemini-2.5-flash. Speeds up analysis a lot.
      config: { thinkingConfig: { thinkingBudget: 0 } },
      prompt: [
        {
          media: {
            url: input.voiceRecordingDataUri,
            contentType: mimeType,
          },
        },
        { text: promptText },
      ],
    });

    if (!output) throw new Error('No output from Gemini');
    return output;
  }
);
