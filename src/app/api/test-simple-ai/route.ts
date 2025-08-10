import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    console.log("=== Simple AI Test ===");
    
    // Check environment variables first
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    console.log("API Key exists:", !!apiKey);
    console.log("API Key length:", apiKey?.length || 0);
    console.log("API Key starts with:", apiKey?.substring(0, 10) || 'N/A');
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "GOOGLE_GENAI_API_KEY not found in environment variables",
        available_env_vars: Object.keys(process.env).filter(key => key.includes('GOOGLE') || key.includes('AI'))
      });
    }
    
    // Test basic Google AI API call without Genkit
    const testPrompt = "Say hello and confirm you can categorize a transaction.";
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: testPrompt
            }]
          }]
        })
      });
      
      console.log("Google AI API response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log("Google AI API error:", errorText);
        return NextResponse.json({
          success: false,
          error: "Google AI API call failed",
          status: response.status,
          response: errorText
        });
      }
      
      const result = await response.json();
      console.log("Google AI API result:", result);
      
      return NextResponse.json({
        success: true,
        message: "Google AI API is working!",
        api_response: result,
        environment: {
          hasApiKey: true,
          keyLength: apiKey.length,
          nodeEnv: process.env.NODE_ENV
        }
      });
      
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);
      return NextResponse.json({
        success: false,
        error: "Failed to call Google AI API",
        details: fetchError instanceof Error ? fetchError.message : String(fetchError)
      });
    }
    
  } catch (error) {
    console.error("=== Simple AI Test Error ===", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetails: {
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}
