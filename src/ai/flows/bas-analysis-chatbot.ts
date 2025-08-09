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

export async function basAnalysisChatbot(
  input: BasAnalysisChatbotInput
): Promise<BasAnalysisChatbotOutput> {
  return basAnalysisChatbotFlow(input);
}

const chatbotPrompt = ai.definePrompt({
  name: 'basAnalysisChatbotPrompt',
  input: {schema: BasAnalysisChatbotInputSchema},
  output: {schema: BasAnalysisChatbotOutputSchema},
  prompt: `You are a financial expert chatbot. Your primary function is to assist users with BAS (Business Activity Statement) analysis.

You have been provided with the following information:
- A summary of extracted financial transactions.
- Key insights from the original document: Page count is {{documentInsights.pageCount}} and total transaction count is {{documentInsights.transactionCount}}.

**Your Instructions:**
1.  Use the "Extracted Financial Data Summary" to answer general questions about the user's financial position.
2.  Use the provided page and transaction counts to answer specific questions about the source document. Do not invent or infer any other details about the original document.

**Extracted Financial Data Summary:**
{{financialData}}

**Conversation History:**
{{#each conversationHistory}}
{{role}}: {{content}}
{{/each}}

**User Query:**
{{userQuery}}`,
});

const basAnalysisChatbotFlow = ai.defineFlow(
  {
    name: 'basAnalysisChatbotFlow',
    inputSchema: BasAnalysisChatbotInputSchema,
    outputSchema: BasAnalysisChatbotOutputSchema,
  },
  async input => {
    try {
      const {output} = await chatbotPrompt(input);

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
