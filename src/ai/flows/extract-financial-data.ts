'use server';

/**
 * @fileOverview An AI agent that extracts financial transactions from PDF documents.
 *
 * - extractFinancialData - A function that handles the financial data extraction process.
 */

import {ai} from '@/ai/genkit';
import {
  ExtractFinancialDataInputSchema,
  ExtractFinancialDataOutputSchema,
  ExtractFinancialDataInput,
  ExtractFinancialDataOutput,
} from '@/ai/schemas';

export async function extractFinancialData(
  input: ExtractFinancialDataInput
): Promise<ExtractFinancialDataOutput> {
  return extractFinancialDataFlow(input);
}

const extractionPrompt = ai.definePrompt({
  name: 'financialDataExtractionPrompt',
  input: {schema: ExtractFinancialDataInputSchema},
  output: {schema: ExtractFinancialDataOutputSchema},
  prompt: `You are an expert financial data analyst. Your task is to extract transaction data from the provided PDF document and return it as a structured JSON object.

  Analyze the document and identify all financial transactions. For each transaction, you must extract the following fields:
  - date (in YYYY-MM-DD format)
  - description
  - amount
  - category (e.g., 'Income', 'Expenses')
  - subCategory (e.g., 'Sales', 'Rent', 'Utilities')

  **CRITICAL INSTRUCTIONS:**
  1.  **Accuracy is paramount.** Only include transactions for which you can confidently extract all required fields.
  2.  **Discard Incomplete Data:** If you cannot determine the date, description, amount, AND category for a specific line item, you MUST discard and completely omit that transaction from the output. Do not under any circumstances include partial or incomplete transaction records.
  3.  **Strict JSON Output:** Ensure your final output is a valid JSON object that strictly adheres to the required schema, containing a single key "transactions" which is an array of transaction objects.

  PDF Document:
  {{media url=pdfDataUri}}`,
});

const extractFinancialDataFlow = ai.defineFlow(
  {
    name: 'extractFinancialDataFlow',
    inputSchema: ExtractFinancialDataInputSchema,
    outputSchema: ExtractFinancialDataOutputSchema,
  },
  async input => {
    const {output} = await extractionPrompt(input);

    // If the model fails to produce any output or an empty transaction list,
    // return a valid empty response.
    if (!output || !output.transactions) {
      return {transactions: []};
    }

    return output;
  }
);
