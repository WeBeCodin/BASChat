import { NextRequest, NextResponse } from "next/server";
import {
  CategorizeTransactionsInput,
  CategorizeTransactionsOutput,
} from "@/ai/schemas";

export async function POST(request: NextRequest) {
  let input: CategorizeTransactionsInput | null = null;
  
  try {
    console.log("=== SIMPLE Categorization API Route Starting ===");
    
    const body = await request.json();
    console.log("Transaction count:", body?.rawTransactions?.length);
    console.log("Industry:", body?.industry);
    
    input = body;
    
    if (!input) {
      throw new Error("No input provided");
    }
    
    const result = await simpleProcessBatch(input);
    
    console.log("Simple categorization success:", !!result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("=== SIMPLE Categorization ERROR ===");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        transactions: [],
        error: "Simple categorization failed",
        errorDetails: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function simpleProcessBatch(
  input: CategorizeTransactionsInput
): Promise<CategorizeTransactionsOutput> {
  
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENAI_API_KEY not found");
  }

  // SIMPLE PROMPT FOR TESTING
  const prompt = `Categorize these ${input.industry} transactions for Australian BAS:

Transactions:
${JSON.stringify(input.rawTransactions, null, 2)}

Rules:
- Gross fares = Income (Business Income)
- Tolls, fees = Expenses (Vehicle Expenses)
- Service fees = Expenses (Professional Services)

Return JSON:
{
  "transactions": [
    {
      "date": "2025-04-01",
      "description": "original description", 
      "amount": 422.78,
      "category": "Income or Expenses",
      "subCategory": "Business Income or Vehicle Expenses or Professional Services",
      "confidence": 0.9
    }
  ]
}`;

  console.log("Using simple prompt, length:", prompt.length);

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
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google AI API error:", errorText);
    throw new Error(`AI API failed: ${response.status} - ${errorText}`);
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
    
    return {
      transactions: parsedResult.transactions || [],
      maybeTransactions: undefined,
    };
  } catch (parseError) {
    console.error("Failed to parse AI JSON response:", parseError);
    console.error("Raw AI text:", aiText);
    return { transactions: [] };
  }
}
