import { config } from 'dotenv';
config();

import '@/ai/flows/analyze-receipt.ts';
import '@/ai/flows/record-expense-voice.ts';
import '@/ai/flows/financial-coach.ts';
