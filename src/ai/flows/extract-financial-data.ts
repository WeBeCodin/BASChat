'use server';

/**
 * @fileOverview An AI agent that extracts financial transactions from PDF documents and categorizes them into income and expense buckets.
 *
 * - extractFinancialData - A function that handles the financial data extraction and categorization process.
 */

import {ai} from '@/ai/genkit';
import {
  ExtractFinancialDataInputSchema,
  ExtractFinancialDataOutputSchema,
  ExtractFinancialDataInput,
  ExtractFinancialDataOutput
} from '@/ai/schemas';
import { z } from 'genkit';


export async function extractFinancialData(input: ExtractFinancialDataInput): Promise<ExtractFinancialDataOutput> {
  return orchestrateFinancialDataExtraction(input);
}

// Phase 1: Raw Data Extraction
const extractRawTextPrompt = ai.definePrompt({
  name: 'extractRawTextPrompt',
  input: { schema: ExtractFinancialDataInputSchema },
  output: { schema: z.object({ rawText: z.string() }) },
  prompt: `Extract all text content from the provided PDF document.
  Focus on capturing everything, including tables and line items.
  
  PDF Document:
  {{media url=pdfDataUri}}`,
});

// Phase 2: Structured Data Conversion & Validation
const structureDataPrompt = ai.definePrompt({
  name: 'structureDataPrompt',
  input: { schema: z.object({ rawText: z.string() }) },
  output: { schema: ExtractFinancialDataOutputSchema },
  prompt: `You are a data processing expert. Convert the following raw text into a structured JSON array of financial transactions.
  
  It is absolutely critical that you only include transactions for which you could extract all the required fields (date, description, amount, category). If any of these fields are missing for a transaction, you MUST discard and completely omit the entire transaction from the output. Do not ever include partial or incomplete transactions.
  Ensure the date is in YYYY-MM-DD format.
  
  Raw Text:
  {{{rawText}}}
  `,
});

// Phase 3: Categorization & Refinement
const categorizeTransactionsPrompt = ai.definePrompt({
    name: 'categorizeTransactionsPrompt',
    input: { schema: ExtractFinancialDataOutputSchema },
    output: { schema: ExtractFinancialDataOutputSchema },
    prompt: `You are a financial expert. Review the following list of financial transactions and categorize them into appropriate industry-specific income and expense buckets.
    Refine the category and subCategory for each transaction based on its description.

    Transactions:
    {{{JSON transactions}}}
    `
});


const orchestrateFinancialDataExtraction = ai.defineFlow(
  {
    name: 'orchestrateFinancialDataExtraction',
    inputSchema: ExtractFinancialDataInputSchema,
    outputSchema: ExtractFinancialDataOutputSchema,
  },
  async (input) => {
    // Phase 1
    const rawExtraction = await extractRawTextPrompt(input);
    const rawText = rawExtraction.output?.rawText ?? '';
    if (!rawText) {
      return { transactions: [] };
    }

    // Phase 2
    const structuredData = await structureDataPrompt({ rawText });
    if (!structuredData.output || structuredData.output.transactions.length === 0) {
        return { transactions: [] };
    }

    // Phase 3
    const finalCategorization = await categorizeTransactionsPrompt(structuredData.output);
    if (!finalCategorization.output) {
      return { transactions: [] };
    }

    return finalCategorization.output;
  }
);
