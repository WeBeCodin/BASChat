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

const systemPrompt = `You are a financial expert chatbot. Your primary function is to assist users with BAS (Business Activity Statement) analysis.

You have been provided with the following information:
- A summary of extracted financial transactions.
- Key insights from the original document: Page count is {{pageCount}} and total transaction count is {{transactionCount}}.

**Your Instructions:**
1.  Use the "Extracted Financial Data Summary" to answer general questions about the user's financial position.
2.  Use the provided page and transaction counts to answer specific questions about the source document. Do not invent or infer any other details about the original document.

**Extracted Financial Data Summary:**
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
        role: message.role === 'user' ? 'user' : 'model',
        content: [{text: message.content}],
      })
    );

    try {
      const {output} = await ai.generate({
        model: 'googleai/gemini-1.5-flash-latest',
        system: systemPrompt,
        prompt: input.userQuery,
        history,
        input: {
          financialData: input.financialData,
          pageCount: input.documentInsights.pageCount,
          transactionCount: input.documentInsights.transactionCount,
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
    } catch (error) {
      console.error('Error in basAnalysisChatbotFlow:', error);
      return {
        response:
          "I'm sorry, I'm having trouble connecting to the AI service at the moment. Please try again in a little while.",
      };
    }
  }
);
