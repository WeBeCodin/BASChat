'use server';

/**
 * @fileOverview An AI agent that extracts financial transactions from PDF documents and categorizes them into income and expense buckets.
 *
 * - extractFinancialData - A function that handles the financial data extraction and categorization process.
 * - ExtractFinancialDataInput - The input type for the extractFinancialData function.
 * - ExtractFinancialDataOutput - The return type for the extractFinancialData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractFinancialDataInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF document containing financial transactions, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
});
export type ExtractFinancialDataInput = z.infer<typeof ExtractFinancialDataInputSchema>;

const TransactionSchema = z.object({
  date: z.string().describe('The date of the transaction (YYYY-MM-DD).'),
  description: z.string().describe('A description of the transaction.'),
  amount: z.number().describe('The amount of the transaction.'),
  category: z.string().describe('The category of the transaction (e.g., Income, Expenses, etc.).'),
  subCategory: z.string().describe('The sub-category of the transaction (e.g., Sales, Rent, Utilities, etc.).').optional(),
});

const ExtractFinancialDataOutputSchema = z.object({
  transactions: z.array(TransactionSchema).describe('An array of extracted and categorized financial transactions.'),
});

export type ExtractFinancialDataOutput = z.infer<typeof ExtractFinancialDataOutputSchema>;

export async function extractFinancialData(input: ExtractFinancialDataInput): Promise<ExtractFinancialDataOutput> {
  return extractFinancialDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractFinancialDataPrompt',
  input: {schema: ExtractFinancialDataInputSchema},
  output: {schema: ExtractFinancialDataOutputSchema},
  prompt: `You are a financial expert tasked with extracting and categorizing financial transactions from PDF documents.

  Analyze the provided PDF document and extract all financial transactions. For each transaction, identify the date, description, amount, category, and sub-category (if applicable).
  Categorize transactions into industry-specific income and expense buckets.

  Here is the PDF document:
  {{media url=pdfDataUri}}

  Return the extracted transactions in a structured JSON format.
  Make sure that date is in YYYY-MM-DD format, amount is a number and all fields conform to the schema.
  It is critical that you only include transactions for which you could extract all the required fields (date, description, amount, category). If any of these fields are missing for a transaction, you MUST omit the entire transaction from the output. Do not include partial transactions.
`,
});

const extractFinancialDataFlow = ai.defineFlow(
  {
    name: 'extractFinancialDataFlow',
    inputSchema: ExtractFinancialDataInputSchema,
    outputSchema: ExtractFinancialDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
