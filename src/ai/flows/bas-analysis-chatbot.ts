'use server';

/**
 * @fileOverview An AI chatbot for BAS analysis.
 *
 * - basAnalysisChatbot - A function that handles the interaction with the chatbot.
 * - BasAnalysisChatbotInput - The input type for the basAnalysisChatbot function.
 * - BasAnalysisChatbotOutput - The return type for the basAnalysisChatbot function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BasAnalysisChatbotInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "The original PDF document as a data URI. This is used for verification if the user questions the accuracy of the extracted data."
    ),
  financialData: z
    .string()
    .describe('Financial transactions data extracted from uploaded PDFs.'),
  userQuery: z.string().describe('The user\s query or feedback.'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'bot']),
    content: z.string(),
  })).optional().describe('Previous conversation history.'),
});
export type BasAnalysisChatbotInput = z.infer<typeof BasAnalysisChatbotInputSchema>;

const BasAnalysisChatbotOutputSchema = z.object({
  response: z.string().describe('The chatbot\s response to the user query.'),
});
export type BasAnalysisChatbotOutput = z.infer<typeof BasAnalysisChatbotOutputSchema>;

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

  Original Document:
  {{media url=pdfDataUri}}

  Extracted Financial Data:
  {{{financialData}}}

  Conversation History:
  {{#each conversationHistory}}
    {{#if (eq this.role "user")}}
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
    return {
      response: output!.response,
    };
  }
);
