
'use server';

/**
 * @fileOverview An AI tool to extract metadata from a PDF document.
 *
 * - getDocumentInsights - A Genkit tool that analyzes a PDF and returns insights.
 */

import {ai} from '@/ai/genkit';
import {
  GetDocumentInsightsInputSchema,
  GetDocumentInsightsOutputSchema,
} from '@/ai/schemas';

const insightPrompt = ai.definePrompt({
  name: 'documentInsightPrompt',
  input: {schema: GetDocumentInsightsInputSchema},
  output: {schema: GetDocumentInsightsOutputSchema},
  prompt: `You are a document analysis expert. Your task is to analyze the provided PDF and extract specific metadata.

  1.  Count the total number of pages in the document.
  2.  Count the total number of distinct financial transactions listed in the document.

  Return the results as a structured JSON object.

  PDF Document:
  {{media url=pdfDataUri}}`,
});

export const getDocumentInsights = ai.defineTool(
  {
    name: 'getDocumentInsights',
    description: 'Analyzes a given PDF document to extract metadata like page count and total number of transactions.',
    inputSchema: GetDocumentInsightsInputSchema,
    outputSchema: GetDocumentInsightsOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await insightPrompt(input);
      if (!output) {
        return { pageCount: 0, transactionCount: 0 };
      }
      return output;
    } catch (error) {
      console.error('Error in getDocumentInsights tool:', error);
      // Return a default value in case of failure to prevent crashes.
      return { pageCount: 0, transactionCount: 0 };
    }
  }
);
