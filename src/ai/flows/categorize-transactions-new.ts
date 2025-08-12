"use server";

/**
 * @fileOverview An AI agent that categorizes financial transactions based on industry.
 *
 * - categorizeTransactions - A function that handles the transaction categorization process.
 */

import {
  CategorizeTransactionsInput,
  CategorizeTransactionsOutput,
} from "@/ai/schemas";

export async function categorizeTransactions(
  input: CategorizeTransactionsInput
): Promise<CategorizeTransactionsOutput> {
  try {
    console.log(
      "categorizeTransactions called with:",
      JSON.stringify(input, null, 2)
    );

    // Use direct Google AI API instead of Genkit (which was causing issues)
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;

    if (!apiKey) {
      throw new Error("GOOGLE_GENAI_API_KEY not found");
    }

    // Process in batches if we have too many transactions
    const BATCH_SIZE = 50; // Process 50 transactions at a time
    const transactions = input.rawTransactions;

    if (transactions.length > BATCH_SIZE) {
      console.log(
        `Processing ${transactions.length} transactions in batches of ${BATCH_SIZE}`
      );

      const allFinalTransactions: any[] = [];
      const allMaybeTransactions: any[] = [];

      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        console.log(
          `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
            transactions.length / BATCH_SIZE
          )} (${batch.length} transactions)`
        );

        const batchResult = await processBatch(
          { ...input, rawTransactions: batch },
          apiKey
        );

        allFinalTransactions.push(...batchResult.transactions);
        if (batchResult.maybeTransactions) {
          allMaybeTransactions.push(...batchResult.maybeTransactions);
        }

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < transactions.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return {
        transactions: allFinalTransactions,
        maybeTransactions:
          allMaybeTransactions.length > 0 ? allMaybeTransactions : undefined,
      };
    } else {
      // Process single batch
      return await processBatch(input, apiKey);
    }
  } catch (error) {
    console.error("Error in categorizeTransactions:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

async function processBatch(
  input: CategorizeTransactionsInput,
  apiKey: string
): Promise<CategorizeTransactionsOutput> {
  // Create industry-specific prompt for rideshare transactions with two-pass categorization
  const firstPassPrompt = `You are a financial analyst specializing in ${
    input.industry
  } Business Activity Statement (BAS) categorization.

FIRST PASS: Categorize transactions only if you are CONFIDENT they belong to specific categories.

For ${input.industry} industry, use these categories only for CLEAR matches:
- Income: UBER/DIDI payments, tips, bonuses, ride-sharing income
- Expenses: Fuel, tolls, vehicle costs, phone bills, car wash, repairs, professional fees

For transactions you're UNCERTAIN about, use:
- Maybe: Could be business-related but unclear, personal expenses that might be deductible, ambiguous transactions

Add confidence scores (0-1) where:
- 0.9-1.0: Very confident (clear business income/expense)
- 0.5-0.8: Somewhat confident (could be business-related)
- 0.0-0.4: Uncertain (needs user review)

Transactions to categorize:
${JSON.stringify(input.rawTransactions, null, 2)}

Return a JSON object with this exact structure:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "original description", 
      "amount": 0.00,
      "category": "Income, Expenses, or Maybe",
      "subCategory": "specific subcategory like Fuel, Tolls, Vehicle Costs, Uncertain Business Expense, etc.",
      "confidence": 0.85
    }
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: firstPassPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google AI API error:", errorText);
    throw new Error(`AI API failed: ${response.status}`);
  }

  const result = await response.json();
  const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  console.log("AI response text:", aiText);

  // Extract JSON from the response
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON found in AI response:", aiText);
    return { transactions: [] };
  }

  try {
    const parsedResult = JSON.parse(jsonMatch[0]);
    console.log("Successfully parsed AI result:", parsedResult);

    // Separate transactions by category
    const categorizedTransactions = parsedResult.transactions || [];
    console.log(
      "Raw categorized transactions from AI:",
      categorizedTransactions.length
    );

    if (categorizedTransactions.length === 0) {
      console.error("AI returned empty transactions array");
      console.error("Full AI response:", aiText);
      // Fallback: mark all as "Maybe" for manual review
      const fallbackMaybeTransactions = input.rawTransactions.map((t) => ({
        ...t,
        category: "Maybe",
        subCategory: "Requires Manual Review",
        confidence: 0.1,
      }));
      return {
        transactions: [],
        maybeTransactions: fallbackMaybeTransactions,
      };
    }

    const finalTransactions: any[] = [];
    const maybeTransactions: any[] = [];

    categorizedTransactions.forEach((transaction: any) => {
      if (
        transaction.category === "Maybe" ||
        (transaction.confidence && transaction.confidence < 0.6)
      ) {
        maybeTransactions.push({
          ...transaction,
          category: "Maybe",
        });
      } else {
        finalTransactions.push(transaction);
      }
    });

    const finalResult = {
      transactions: finalTransactions,
      maybeTransactions:
        maybeTransactions.length > 0 ? maybeTransactions : undefined,
    };

    console.log(
      "processBatch returning:",
      JSON.stringify(finalResult, null, 2)
    );
    console.log(
      `Batch processed: ${finalTransactions.length} certain, ${maybeTransactions.length} uncertain transactions`
    );
    return finalResult;
  } catch (parseError) {
    console.error("Failed to parse AI JSON response:", parseError);
    console.error("Raw AI text:", aiText);
    return { transactions: [] };
  }
}
