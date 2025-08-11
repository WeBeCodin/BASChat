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

**CRITICAL: Transaction Search Instructions**
When users ask about finding specific transactions, merchants, or want to search for terms like "UBER", "fuel", "tolls", etc:

1. **ALWAYS direct them to use the Transaction Search tool** (located above the transactions table)
2. **Never claim to know how many transactions exist** for a specific merchant
3. **Always respond with**: "To find [search term] transactions, please use the Transaction Search tool above the transactions table. It will search through ALL {{documentInsights.transactionCount}} extracted transactions and show you exactly what matches your search term. You can then select and add any found transactions directly to your income or expenses."

**Your Other Instructions:**
1. Use the "Extracted Financial Data Summary" to answer general questions about currently categorized transactions.
2. For BAS calculations, work with the categorized transaction data provided.
3. When users mention missing income or transactions, direct them to search for specific terms.
4. Do not make assumptions about transaction completeness - direct users to verify using search.

**Available Tools for Users:**
- **Transaction Search**: Searches ALL extracted transactions (Ctrl+Shift+F functionality)
- **Maybe Transaction Review**: Orange transactions needing approval  
- **Manual Addition**: Add search results directly as income/expenses

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
