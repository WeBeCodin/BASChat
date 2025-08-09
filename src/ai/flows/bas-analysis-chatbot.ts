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

export async function basAnalysisChatbot(input: BasAnalysisChatbotInput): Promise<BasAnalysisChatbotOutput> {
  return basAnalysisChatbotFlow(input);
}

const prompt = ai.definePrompt({
  name: 'basAnalysisChatbotPrompt',
  input: {
    schema: BasAnalysisChatbotInputSchema,
  },
  output: {
    schema: BasAnalysisChatbotOutputSchema,
  },
  prompt: `You are a financial expert chatbot assisting users with their BAS analysis.
  Your goal is to:
  1. Summarize the financial data provided.
  2. Answer user questions about the data.
  3. Ask clarifying questions to better understand the user's needs.
  4. Apply corrections based on user feedback to ensure accurate BAS calculations.
  5. If the user questions the accuracy of a transaction, refer to the original document provided to verify the information.

  Original Documents:
  {{#each pdfDataUris}}
    {{media url=this}}
  {{/each}}

  Extracted Financial Data:
  {{{financialData}}}

  Conversation History:
  {{#each conversationHistory}}
    {{#if (this.role === "user")}}
      User: {{{this.content}}}
    {{else}}
      Bot: {{{this.content}}}
    {{/if}}
  {{/each}}

  User Query: {{{userQuery}}}

  Response:`, // Ensure the response is tailored to be useful for the chatbot.
});

const basAnalysisChatbotFlow = ai.defineFlow(
  {
    name: 'basAnalysisChatbotFlow',
    inputSchema: BasAnalysisChatbotInputSchema,
    outputSchema: BasAnalysisChatbotOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);

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
