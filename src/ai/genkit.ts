import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// IMPORTANT: Do NOT call config() from dotenv here.
// Next.js handles loading .env files automatically.

if (!process.env.GOOGLE_API_KEY) {
  // This check runs at build time and on server start.
  // It provides a clear error if the key is missing from the environment.
  if (process.env.NODE_ENV === 'production') {
    // In production, log an error. The app might still run but AI features will fail.
    console.error(
      'CRITICAL: GOOGLE_API_KEY is not defined in the environment. AI features will not work.'
    );
  } else {
    // In development, it's more helpful to throw a hard error to stop the process.
    throw new Error(
      'GOOGLE_API_KEY is not defined. Please ensure it is set in your .env file and the development server is restarted.'
    );
  }
}

export const ai = genkit({
  plugins: [
    // Pass the API key directly to the plugin.
    // Next.js ensures process.env.GOOGLE_API_KEY is available in the server environment.
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY,
    }),
  ],
  // Set a default model for stability.
  model: 'googleai/gemini-2.0-flash',
});
