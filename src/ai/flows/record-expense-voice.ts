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
  // z.coerce.number() accepts both numeric strings ("50000") and real numbers (50000).
  amount: z.coerce.number().describe('The expense amount as a plain number.'),
  category: z.string().describe('The category ID from the provided list.'),
  date: z.string().describe('Date in YYYY-MM-DD format. Default to today if not mentioned.'),
  // nullable() so Gemini returning null (instead of omitting) doesn't break validation.
  description: z.string().nullable().optional().describe('Short Arabic description of the expense.'),
  // النص المُفرّغ كما سمعه النموذج — يُعرض للمستخدم ليتحقّق من فهم AI (P5).
  transcript: z.string().nullable().optional().describe('The exact words transcribed from the audio, verbatim in Arabic.'),
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

## مهمتك الأولى: التفريغ الصوتي الدقيق
استمع بدقة شديدة لكل كلمة في التسجيل. اكتب الكلمات العربية **بالضبط** كما نُطقت.
لا تخمّن الكلمات غير الواضحة — ركّز على الفروق الدقيقة بين الأصوات المتشابهة:
- (ح) و (خ) و (ه) و (ع) — أصوات مختلفة كلياً
- (ق) و (ك) و (ج)
- (س) و (ص) و (ث)
- (ذ) و (ز) و (ض) و (ظ)

## قاموس مساعد للكلمات الشائعة في المصاريف
| ما قد تسمعه | الكلمة الصحيحة |
|---|---|
| حاسوب / لابتوب / كمبيوتر | حاسوب |
| موبايل / تلفون / جوال | هاتف |
| سيارة / عربية / سيار | سيارة |
| بنزين / وقود | بنزين |
| أكل / طعام / غداء / عشاء | وجبة |
| كهربا / فاتورة كهرباء | فاتورة كهرباء |
| ماي / ماء / مياه | ماء |
| دوا / دواء / حبوب | دواء |
| ملابس / هدوم / ثياب | ملابس |
| جامعة / مدرسة / كلية | رسوم دراسية |
| فرن / ثلاجة / غسالة / مكيف | أجهزة منزلية |
| تاكسي / كريم / أوبر | مواصلات |

## تاريخ اليوم
تاريخ اليوم الفعلي هو: ${todayISO}
إذا لم يذكر المستخدم تاريخاً صراحةً، استخدم تاريخ اليوم هذا بالضبط (${todayISO}).
"اليوم" = ${todayISO}. "أمس" = اليوم ناقص يوم واحد. لا تخمّن تاريخاً من معلوماتك القديمة.

## قواعد فهم الأرقام العراقية (دقّق جداً — الخطأ في المبلغ هو الأخطر)
- "خمسين ألف" / "50 ألف" = 50000
- "مية ألف" / "100 ألف" = 100000
- "عشرتالاف" / "10 ألف" = 10000
- "ألفين وخمسمية" = 2500 · "ألف وخمسمية" = 1500
- "مليون" = 1000000 · "نص مليون" = 500000 · "مليون ونص" = 1500000
- "ربع مليون" = 250000

### الأرقام المبهمة (وحّد السياق العراقي للمصاريف اليومية):
- "خمسة وعشرين" بمفردها = 25000 · لكن "خمسة وعشرين ألف" = 25000 أيضاً (لا تضربها مرتين)
- "خمسطعش" / "خمستعشر" = 15000 (انتبه: ليست 50000)
- إذا قال رقماً صغيراً جداً (أقل من 250) في سياق مصروف، فالأرجح أنه يقصد الآلاف (مثال: "خمسة" لوجبة = 5000)
- **تجاهل علامات الترقيم والفواصل والوقفات** في الكلام ("ألفين... وخمسمية" = 2500، لا تعتبر الوقفة فاصلاً بين رقمين)
- إذا ذكر رقمين منفصلين بوضوح (مثال: "اشتريت بعشرة آلاف ودفعت أجرة بخمسة آلاف") فالمبلغ هو **مجموع المصروف المقصود**؛ خذ المبلغ الأوضح للمصروف الواحد المطلوب تسجيله
- **الترتيب مرن تماماً:** المستخدم قد يقول المبلغ أولاً ("خمسين ألف غداء") أو العنصر أولاً ("غداء بخمسين ألف") — استخرج المعنى من السياق لا من الترتيب
- لا تخمّن منزلة عشرية لا وجود لها (الدينار العراقي لا يستخدم الكسور في المصاريف اليومية)

## التعليمات
1. فرّغ التسجيل بدقة (ركّز على الحروف المتشابهة)
2. استخرج: المبلغ، اسم/وصف المصروف، والتاريخ
3. اختر أنسب فئة من القائمة أدناه
4. أعد إجابة JSON صحيحة دائماً

## الفئات المتاحة (ID: الاسم)
${categoriesList}

## مهم
- amount يجب أن يكون رقم صحيح (مثال: 50000 وليس "خمسين ألف")
- category يجب أن يكون أحد الـ IDs بالضبط
- date بصيغة YYYY-MM-DD، والافتراضي هو ${todayISO}
- description اسم المصروف بالعربية (اكتب ما سمعته بدقة، لا تخمّن)
- transcript: اكتب **النص الكامل الحرفي** كما نطقه المستخدم بالضبط (كل الكلمات التي سمعتها) — ليتمكّن المستخدم من التحقّق`;

    // Extract MIME type from data URI
    const mimeMatch = input.voiceRecordingDataUri.match(/^data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';

    const { output } = await ai.generate({
      output: { schema: RecordExpenseWithVoiceOutputSchema },
      // Small thinking budget — improves Arabic transcription accuracy
      // (especially distinguishing similar consonants like ح/خ/ه/ع)
      // without adding significant latency.
      config: { thinkingConfig: { thinkingBudget: 512 } },
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
