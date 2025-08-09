import {z} from 'genkit';

/**
 * @fileOverview
 * This file contains the Zod schemas and TypeScript types for the AI flows.
 * By centralizing the schemas here, we can avoid Next.js "use server" errors
 * that occur when exporting non-function objects from server-side files.
 */

// Schemas for bas-analysis-chatbot.ts
export const BasAnalysisChatbotInputSchema = z.object({
  financialData: z
    .string()
    .describe('Financial transactions data extracted from uploaded PDFs.'),
  documentInsights: z.object({
    pageCount: z.number(),
    transactionCount: z.number(),
  }),
  userQuery: z.string().describe('The user’s query or feedback.'),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'bot']),
        content: z.string(),
      })
    )
    .optional()
    .describe('Previous conversation history.'),
});
export type BasAnalysisChatbotInput = z.infer<
  typeof BasAnalysisChatbotInputSchema
>;

export const BasAnalysisChatbotOutputSchema = z.object({
  response: z.string().describe('The chatbot’s response to the user query.'),
});
export type BasAnalysisChatbotOutput = z.infer<
  typeof BasAnalysisChatbotOutputSchema
>;

// Schemas for extract-financial-data.ts
export const ExtractFinancialDataInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF document containing financial transactions, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
});
export type ExtractFinancialDataInput = z.infer<
  typeof ExtractFinancialDataInputSchema
>;

export const RawTransactionSchema = z.object({
  date: z.string().describe('The date of the transaction (YYYY-MM-DD).'),
  description: z.string().describe('A description of the transaction.'),
  amount: z.number().describe('The amount of the transaction.'),
});
export type RawTransaction = z.infer<typeof RawTransactionSchema>;

export const ExtractFinancialDataOutputSchema = z.object({
  transactions: z
    .array(RawTransactionSchema)
    .describe('An array of extracted raw financial transactions.'),
  pageCount: z.number().describe('The total number of pages in the document.'),
  transactionCount: z
    .number()
    .describe(
      'The total number of financial transactions found in the document.'
    ),
});
export type ExtractFinancialDataOutput = z.infer<
  typeof ExtractFinancialDataOutputSchema
>;

// Schemas for categorize-transactions.ts
export const CategorizeTransactionsInputSchema = z.object({
    rawTransactions: z.array(RawTransactionSchema).describe("An array of raw transaction data."),
    industry: z.string().describe("The user's selected industry."),
});
export type CategorizeTransactionsInput = z.infer<typeof CategorizeTransactionsInputSchema>;


export const TransactionSchema = z.object({
  date: z.string().describe('The date of the transaction (YYYY-MM-DD).'),
  description: z.string().describe('A description of the transaction.'),
  amount: z.number().describe('The amount of the transaction.'),
  category: z
    .string()
    .describe(
      'The category of the transaction (e.g., Income, Expenses, etc.).'
    ),
  subCategory: z
    .string()
    .describe(
      'The sub-category of the transaction (e.g., Sales, Rent, Utilities, etc.).'
    )
    .optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const CategorizeTransactionsOutputSchema = z.object({
    transactions: z.array(TransactionSchema).describe("An array of categorized financial transactions.")
});
export type CategorizeTransactionsOutput = z.infer<typeof CategorizeTransactionsOutputSchema>;
