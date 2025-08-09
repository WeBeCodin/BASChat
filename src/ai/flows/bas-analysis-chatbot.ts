'use server';

/**
 * @fileOverview An AI chatbot for BAS analysis.
 *
 * - basAnalysisChatbot - A function that handles the interaction with the chatbot.
 */

import {ai} from '@/ai/genkit';
import {
  BasAnalysisChatbotInputSchema,
  BasAnalysisChatbotOutputSchema,
  BasAnalysisChatbotInput,
  BasAnalysisChatbotOutput,
} from '@/ai/schemas';
import {MessageData} from 'genkit';

export async function basAnalysisChatbot(
  input: BasAnalysisChatbotInput
): Promise<BasAnalysisChatbotOutput> {
  return basAnalysisChatbotFlow(input);
}

const systemPrompt = `You are a financial expert chatbot assisting users with their BAS analysis. Your goal is to:
1.  Answer user questions about the financial data and the documents it came from.
2.  Use the provided PDF documents as the primary source of truth to answer any questions about their content, including metadata like page count or total transaction counts.
3.  Summarize the financial data that has been extracted from the documents.
4.  Ask clarifying questions to better understand the user's needs.
5.  Apply corrections based on user feedback to ensure accurate BAS calculations.

The user has provided one or more PDF documents. The key financial data has been extracted for your convenience, but you must refer to the original PDFs to answer any specific questions about them.

Original PDF Documents:
{{#each pdfDataUris}}
  {{media url=this}}
{{/each}}

Extracted Financial Data Summary:
{{{financialData}}}
`;

const basAnalysisChatbotFlow = ai.defineFlow(
  {
    name: 'basAnalysisChatbotFlow',
    inputSchema: BasAnalysisChatbotInputSchema,
    outputSchema: BasAnalysisChatbotOutputSchema,
  },
  async input => {
    const history: MessageData[] = (input.conversationHistory || []).map(
      message => ({
        role: message.role,
        content: [{text: message.content}],
      })
    );

    const {output} = await ai.generate({
      model: 'googleai/gemini-1.5-flash-latest',
      system: systemPrompt,
      prompt: input.userQuery,
      history,
      input: {
        financialData: input.financialData,
        pdfDataUris: input.pdfDataUris,
      },
      output: {
        schema: BasAnalysisChatbotOutputSchema,
      },
    });

    if (!output?.response) {
      return {
        response:
          "I'm sorry, but I encountered an issue and can't provide a response right now. Please try again later.",
      };
    }

    return {
      response: output.response,
    };
  }
);
