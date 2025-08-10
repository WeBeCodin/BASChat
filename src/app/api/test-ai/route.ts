import { NextRequest, NextResponse } from "next/server";
import { categorizeTransactions } from "@/ai/flows/categorize-transactions";

export async function POST(request: NextRequest) {
  try {
    console.log("=== AI Test Endpoint Called ===");

    // Test with simple data
    const testInput = {
      rawTransactions: [
        {
          date: "2025-06-30",
          description: "UBER BV Trip - Melbourne Airport",
          amount: 45.5,
        },
      ],
      industry: "Rideshare",
    };

    console.log("Testing AI with input:", JSON.stringify(testInput, null, 2));

    // Check environment variables
    console.log("Environment check:");
    console.log(
      "- GOOGLE_GENAI_API_KEY exists:",
      !!process.env.GOOGLE_GENAI_API_KEY
    );
    console.log(
      "- API key length:",
      process.env.GOOGLE_GENAI_API_KEY?.length || 0
    );
    console.log("- NODE_ENV:", process.env.NODE_ENV);

    // Test the AI function
    const result = await categorizeTransactions(testInput);

    console.log("AI Test Result:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      input: testInput,
      result: result,
      environment: {
        hasApiKey: !!process.env.GOOGLE_GENAI_API_KEY,
        keyLength: process.env.GOOGLE_GENAI_API_KEY?.length || 0,
        nodeEnv: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    console.error("=== AI Test Error ===", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorDetails: {
          name: error instanceof Error ? error.name : "Unknown",
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}
