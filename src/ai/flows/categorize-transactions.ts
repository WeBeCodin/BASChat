'use server';

/**
 * @fileOverview An AI agent that categorizes financial transactions based on industry.
 *
 * - categorizeTransactions - A function that handles the transaction categorization process.
 */

import {ai} from '@/ai/genkit';
import {
  CategorizeTransactionsInputSchema,
  CategorizeTransactionsOutputSchema,
  CategorizeTransactionsInput,
  CategorizeTransactionsOutput,
} from '@/ai/schemas';

export async function categorizeTransactions(
  input: CategorizeTransactionsInput
): Promise<CategorizeTransactionsOutput> {
  return categorizeTransactionsFlow(input);
}

const categorizationPrompt = ai.definePrompt({
  name: 'transactionCategorizationPrompt',
  input: {schema: CategorizeTransactionsInputSchema},
  output: {schema: CategorizeTransactionsOutputSchema},
  prompt: `You are an expert financial analyst specializing in categorizing transactions for Business Activity Statements (BAS). Your task is to categorize a list of raw transactions based on the user's specified industry.

  **User's Industry:** {{industry}}

  **Your Instructions:**
  1.  Analyze each raw transaction in the provided JSON array.
  2.  Based on the transaction description and the user's industry, determine the correct 'category' and 'subCategory'.
  3.  Use the industry-specific lexicons below to guide your categorization. The description of the transaction is the most important factor.
  4.  Every single transaction MUST be assigned a 'category' and a 'subCategory'.
  5.  Return a new JSON array containing all the original transactions, now with the added 'category' and 'subCategory' fields.

  **Industry Lexicons:**

  **Construction:**
  - **Income:** Customer Payments, Progress Payments, Variation Claims, Retention Releases.
  - **Expenses:**
    - **Materials:** Bunnings, Reece, Mitre 10, Steel Supplies, Concrete & Cement.
    - **Subcontractors:** Plumbers, Electricians, Carpenters, Landscapers.
    - **Equipment Hire:** Coates Hire, Kennards Hire.
    - **Vehicle:** Fuel, Tolls, Registration, Maintenance.
    - **Other:** Site Safety, Council Fees, Insurance.

  **Retail (Cafe/Restaurant):**
  - **Income:** Daily Sales, Uber Eats, DoorDash, MenuLog, Catering.
  - **Expenses:**
    - **Cost of Goods Sold:** Meat Supplier, Fruit & Veg Supplier, Dairy & Co, Bakery Delight, Coffee Beans Inc.
    - **Wages & Super:** Staff Wages, Superannuation.
    - **Rent & Utilities:** Commercial Real Estate Agents, AGL, Origin, Water Corp.
    - **Marketing:** Facebook Ads, Google Ads, Local Newspaper.
    - **Other:** POS System Fees (Square, Tyro), Bank Fees, Cleaning Supplies.

  **Professional Services (e.g., IT Consultant, Marketing Agency):**
  - **Income:** Client Project Fees, Retainer Payments, Service Fees.
  - **Expenses:**
    - **Software & Subscriptions:** Google Workspace, Microsoft 365, Adobe, Slack, Xero.
    - **Wages & Contractors:** Employee Salaries, Freelancer Payments.
    - **Marketing & Advertising:** Google Ads, LinkedIn Ads, SEO Services.
    - **Office Expenses:** Officeworks, Rent, Electricity, Internet.
    - **Other:** Professional Indemnity Insurance, Bank Fees, Travel.

  **Raw Transactions Data:**
  {{{jsonStringify rawTransactions}}}
  `,
});

const categorizeTransactionsFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionsFlow',
    inputSchema: CategorizeTransactionsInputSchema,
    outputSchema: CategorizeTransactionsOutputSchema,
  },
  async (input) => {
    try {
      const {output} = await categorizationPrompt(input);
      if (!output) {
        return {transactions: []};
      }
      return {
        transactions: output.transactions || [],
      };
    } catch (error) {
      console.error('Error in categorizeTransactionsFlow:', error);
      return {transactions: []};
    }
  }
);
