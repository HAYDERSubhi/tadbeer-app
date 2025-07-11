import { config } from 'dotenv';
// config() has been moved to dev.ts to ensure it runs first.

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

if (!process.env.GOOGLE_API_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'GOOGLE_API_KEY is not defined. Please set it in your environment variables.'
    );
  } else {
    // In development, it's more helpful to throw an error.
    throw new Error(
      'GOOGLE_API_KEY is not defined. Please set it in your .env file.'
    );
  }
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY,
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
