import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Use environment variable for model selection with fallback
const defaultModel = process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash-lite';

export const ai = genkit({
  plugins: [googleAI()],
  model: `googleai/${defaultModel}`,
});
