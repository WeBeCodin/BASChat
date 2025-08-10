import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { rawTransactions, industry } = await request.json();
    
    console.log("=== Simple Categorization Test ===");
    console.log("Input transactions:", rawTransactions?.length || 0);
    console.log("Industry:", industry);
    
    // Test with direct Google AI API call instead of Genkit
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "No API key" });
    }
    
    const prompt = `You are a financial analyst. Categorize these ${industry} transactions.

For each transaction, add "category" and "subCategory" fields.

Transactions:
${JSON.stringify(rawTransactions, null, 2)}

Return a JSON object with this exact structure:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "original description",
      "amount": 0.00,
      "category": "Income or Expenses",
      "subCategory": "specific subcategory"
    }
  ]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("AI API error:", errorText);
      return NextResponse.json({
        success: false,
        error: "AI API failed",
        details: errorText
      });
    }

    const result = await response.json();
    console.log("AI raw response:", result);
    
    const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("AI response text:", aiText);
    
    // Try to extract JSON from the response
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResult = JSON.parse(jsonMatch[0]);
        console.log("Parsed result:", parsedResult);
        
        return NextResponse.json({
          success: true,
          result: parsedResult,
          aiText: aiText,
          input: { rawTransactions, industry }
        });
      } else {
        return NextResponse.json({
          success: false,
          error: "No JSON found in AI response",
          aiText: aiText
        });
      }
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: "Failed to parse AI response",
        aiText: aiText,
        parseError: parseError instanceof Error ? parseError.message : String(parseError)
      });
    }

  } catch (error) {
    console.error("Simple categorization error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
