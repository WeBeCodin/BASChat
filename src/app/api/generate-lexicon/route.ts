import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { industry } = await request.json();
    
    if (!industry?.trim()) {
      return NextResponse.json(
        { error: "Industry name is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GENAI_API_KEY not found");
    }

    console.log(`Generating lexicon for industry: ${industry}`);

    const prompt = `You are a financial and taxation expert specializing in Australian business categories. Generate a comprehensive industry-specific lexicon for "${industry}" sole traders for BAS (Business Activity Statement) and tax purposes.

Please provide a detailed analysis including:

1. **Common Income Sources**: List typical revenue streams and how they appear on bank statements
2. **Deductible Business Expenses**: Comprehensive list of tax-deductible expenses specific to this industry
3. **Equipment & Tools**: Industry-specific equipment, tools, and depreciation considerations
4. **Vehicle Expenses**: If applicable, vehicle usage patterns and deductibility rules
5. **Professional Development**: Training, certification, and education expenses
6. **Insurance Requirements**: Industry-specific insurance types (professional indemnity, public liability, etc.)
7. **GST Considerations**: GST registration requirements and special considerations
8. **Record Keeping**: Specific documentation requirements for this industry
9. **Search Keywords**: Common terms that would appear in bank transactions for this industry

Focus on practical, actionable information that would help categorize financial transactions and optimize tax deductions for Australian sole traders in the ${industry} industry.

Provide specific examples of how transactions might appear in bank statements and their correct tax treatment.

Return a comprehensive response that covers all aspects of financial management for this industry.`;

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
            temperature: 0.3,
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
    const lexiconContent = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!lexiconContent) {
      throw new Error("No lexicon content generated");
    }

    console.log(`Successfully generated lexicon for ${industry} (${lexiconContent.length} characters)`);

    // Parse the lexicon to extract search keywords
    const keywordSection = lexiconContent.match(/(?:Search Keywords|Keywords|Transaction Terms)[\s\S]*?(?=\n\n|\n#|$)/i);
    let searchTerms: string[] = [];
    
    if (keywordSection) {
      // Extract keywords from lists, bullet points, or comma-separated values
      const keywordText = keywordSection[0];
      const keywords = keywordText.match(/(?:\*\s*|•\s*|-\s*|,\s*)([a-zA-Z\s&]+?)(?=\n|\*|•|-|,|$)/g);
      if (keywords) {
        searchTerms = keywords
          .map((k: string) => k.replace(/^\*\s*|^•\s*|^-\s*|^,\s*/, '').trim())
          .filter((k: string) => k.length > 2 && k.length < 30)
          .slice(0, 15); // Limit to 15 terms
      }
    }

    // If no keywords found, generate some basic ones
    if (searchTerms.length === 0) {
      searchTerms = [
        "equipment",
        "supplies",
        "professional",
        "training",
        "insurance",
        "subscription",
        "software",
        "maintenance",
        "fuel",
        "telecommunications"
      ];
    }

    return NextResponse.json({
      industry,
      lexicon: lexiconContent,
      searchTerms,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Lexicon generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate industry lexicon",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
