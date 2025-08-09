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
1. Summarize the financial data provided.
2. Answer user questions about the data.
3. Ask clarifying questions to better understand the user's needs.
4. Apply corrections based on user feedback to ensure accurate BAS calculations.
5. If the user questions the accuracy of a transaction, refer to the original document provided to verify the information.

The user has provided financial data extracted from one or more documents, and may provide the original documents for reference.
Extracted Financial Data:
{{{financialData}}}

Original Documents:
{{#each pdfDataUris}}
  {{media url=this}}
{{/each}}
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
