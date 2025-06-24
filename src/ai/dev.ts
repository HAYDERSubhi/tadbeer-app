import { config } from 'dotenv';
config();

import '@/ai/flows/analyze-receipt.ts';
import '@/ai/flows/record-expense-voice.ts';
import '@/ai/flows/financial-coach.ts';
import '@/ai/flows/forecast-expenses.ts';
import '@/ai/flows/financial-planner.ts';
