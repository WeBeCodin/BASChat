import { config } from 'dotenv';
config();

import '@/ai/flows/bas-analysis-chatbot.ts';
import '@/ai/flows/extract-financial-data.ts';
import '@/ai/flows/categorize-transactions.ts';
import '@/ai/schemas.ts';
