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
import {getDocumentInsights} from '@/ai/flows/get-document-insights';

export async function basAnalysisChatbot(
  input: BasAnalysisChatbotInput
): Promise<BasAnalysisChatbotOutput> {
  return basAnalysisChatbotFlow(input);
}

const systemPrompt = `You are a financial expert chatbot. Your primary function is to assist users with BAS (Business Activity Statement) analysis.

**Your Instructions:**

1.  Use the "Extracted Financial Data Summary" to answer general questions about the user's financial position.
2.  If the user asks for specific details about the original documents themselves (e.g., page count, total number of transactions), you MUST use the \`getDocumentInsights\` tool. Pass the first available PDF data URI from the user's uploaded documents to the tool.

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
        tools: [getDocumentInsights],
        input: {
          financialData: input.financialData,
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
