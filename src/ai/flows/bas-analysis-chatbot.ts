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

const systemPrompt = `You are a financial expert chatbot. Your primary function is to assist users with BAS (Business Activity Statement) analysis based on documents they provide.

You have been given one or more PDF documents and a summary of financial data that was extracted from them.

**Your Instructions:**

1.  **Answer all questions based on the provided documents.** The PDF documents are your primary source of truth.
2.  **You MUST use the content of the PDF documents to answer any questions about the documents themselves.** This includes questions about page count, number of transactions, specific transaction details, or any other content within the PDFs. Do not claim you cannot access them.
3.  Use the "Extracted Financial Data Summary" as a reference for summarizing the user's financial position, but always defer to the original PDF documents if the user asks for specifics or questions the extracted data.
4.  Be helpful and conversational. If a user's request is unclear, ask clarifying questions.

**Source Documents and Data:**

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
    } catch (error) {
      console.error('Error in basAnalysisChatbotFlow:', error);
      return {
        response:
          "I'm sorry, I'm having trouble connecting to the AI service at the moment. Please try again in a little while.",
      };
    }
  }
);
