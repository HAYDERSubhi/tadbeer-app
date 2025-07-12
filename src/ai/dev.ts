// src/ai/dev.ts
import {config} from 'dotenv';

// IMPORTANT: config() must be called before any other file is imported.
config();

import '@/ai/genkit';

import '@/ai/flows/analyze-detailed-receipt.ts';
import '@/ai/flows/record-expense-voice.ts';
import '@/ai/flows/financial-coach.ts';
import '@/ai/flows/forecast-expenses.ts';
import '@/ai/flows/financial-planner.ts';
import '@/ai/flows/record-expense-text.ts';
import '@/ai/flows/simulate-card-transactions.ts';
import '@/ai/flows/categorize-expense-text.ts';
import '@/ai/flows/re-categorize-expenses.ts'; // Add new flow
