
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// IMPORTANT: Do NOT call config() from dotenv here.
// Next.js handles loading .env files automatically.

// The check for the API key was causing issues with Next.js's build process.
// Next.js ensures that process.env variables from .env are available in the
// server environment when the code is actually executed, but not always when
// the module is first initialized during the build.
// We now rely on this behavior and pass the key directly. If the key is missing
// at runtime, the googleAI plugin itself will throw a more specific error.

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY, // Pass the key directly from the environment.
    }),
  ],
  // Set a default model for stability.
  // NOTE: gemini-2.0-flash was retired by Google (404). Use 2.5-flash.
  model: 'googleai/gemini-2.5-flash',
});
