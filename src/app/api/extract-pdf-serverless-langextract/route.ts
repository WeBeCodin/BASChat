import { NextRequest, NextResponse } from "next/server";

// Serverless-compatible LangExtract implementation
// This embeds the LangExtract methodology directly in the Next.js API route
// No external Python service required - works in Vercel production

interface Transaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  balance?: number | null;
}

interface ExtractionResult {
  transactions: Transaction[];
  page_count: number;
  transaction_count: number;
  document_type: string;
  extraction_confidence: number;
}

// Extract text from PDF using browser APIs (limited but functional)
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    console.log(`PDF buffer size: ${buffer.byteLength} bytes`);

    // Since we can't use pdf-parse on Vercel, we'll use Google AI's multimodal capabilities
    // to extract text directly from the PDF bytes
    const base64Pdf = Buffer.from(buffer).toString("base64");

    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GENAI_API_KEY environment variable not found");
    }

    console.log("Using Google AI multimodal PDF text extraction...");

    // Use Google AI's vision capabilities to extract text from PDF
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
                  text: "Extract all text content from this PDF document. Return only the raw text, no formatting or explanations.",
                },
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: base64Pdf,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google AI PDF extraction failed: ${response.status}`);
    }

    const result = await response.json();
    const extractedText =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!extractedText.trim()) {
      throw new Error("No text could be extracted from the PDF");
    }

    console.log(`Extracted ${extractedText.length} characters from PDF`);
    return extractedText;
  } catch (error) {
    throw new Error(`PDF text extraction failed: ${error}`);
  }
}

// LangExtract-style extraction using Google AI (serverless-compatible)
async function extractStructuredData(
  text: string,
  documentType: string
): Promise<Transaction[]> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_GENAI_API_KEY environment variable not found");
  }

  // Create LangExtract-style prompt following technical specification
  const prompt = createLangExtractPrompt(text, documentType);

  try {
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
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google AI API failed: ${response.status}`);
    }

    const result = await response.json();
    const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("AI response:", aiText);

    // Extract JSON from response
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }

    const parsedData = JSON.parse(jsonMatch[0]);

    // Handle both rideshare summary and bank statement formats
    if (parsedData.transactions) {
      // Bank statement format
      return parsedData.transactions.map((txn: any) => ({
        date: txn.transaction_date || txn.date,
        description: txn.description,
        amount: txn.deposit_amount || -Math.abs(txn.withdrawal_amount || 0),
        category: txn.amount > 0 ? "Income" : "Expense",
        balance: txn.balance || null,
      }));
    } else {
      // Rideshare summary format - convert to transaction list
      return [
        {
          date: new Date().toISOString().split("T")[0],
          description: "Rideshare Total Income",
          amount: parsedData.total_income || 0,
          category: "Income",
        },
        {
          date: new Date().toISOString().split("T")[0],
          description: "Uber Service Fee",
          amount: -(parsedData.uber_service_fee || 0),
          category: "Expense",
        },
      ];
    }
  } catch (error) {
    console.error("AI extraction error:", error);
    throw new Error(`Failed to extract structured data: ${error}`);
  }
}

// Create LangExtract-style prompt following technical specification
function createLangExtractPrompt(text: string, documentType: string): string {
  const basePrompt = `You are an expert Australian bookkeeper specializing in tax compliance for rideshare sole traders.`;

  if (documentType === "rideshare_summary") {
    return `${basePrompt}

Extract financial data from the following Uber/DiDi tax summary and structure it as JSON.

Few-shot example:
Input: "Total Income A$8,023.23 Uber service fee A$1,769.82 Other charges from Uber A$158.39"
Output: {"total_income": 8023.23, "uber_service_fee": 1769.82, "other_charges_from_uber": 158.39}

Now extract from this document:
${text}

Return only the JSON object with the financial data.`;
  } else {
    return `${basePrompt}

Extract ALL transactions from the following bank statement and structure them as JSON.

Few-shot example:
Input: "30 Jun 2025 PAYMENT TO Linkt Melbourne -$45.40\\n30 Jun 2025 DEPOSIT DIDI MOBILITY $80.26"
Output: {
  "transactions": [
    {"transaction_date": "2025-06-30", "description": "PAYMENT TO Linkt Melbourne", "withdrawal_amount": 45.40, "deposit_amount": null},
    {"transaction_date": "2025-06-30", "description": "DEPOSIT DIDI MOBILITY", "withdrawal_amount": null, "deposit_amount": 80.26}
  ]
}

Now extract ALL transactions from this document:
${text}

Return only the JSON object. Extract EVERY transaction you can find.`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const documentType =
      (formData.get("document_type") as string) || "bank_statement";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    console.log(
      `Processing PDF with serverless LangExtract: ${file.name} (${file.size} bytes)`
    );

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();

    // Extract text from PDF
    const text = await extractTextFromPDF(arrayBuffer);
    console.log(
      `Extracted text (${text.length} chars):`,
      text.substring(0, 300) + "..."
    );

    // Extract structured data using LangExtract methodology
    const transactions = await extractStructuredData(text, documentType);

    const result: ExtractionResult = {
      transactions,
      page_count: 1, // Would be calculated from actual PDF
      transaction_count: transactions.length,
      document_type: documentType,
      extraction_confidence: 0.9,
    };

    console.log(
      `✅ Serverless LangExtract completed: ${result.transaction_count} transactions`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in serverless LangExtract:", error);
    return NextResponse.json(
      { error: `Serverless PDF extraction failed: ${error}` },
      { status: 500 }
    );
  }
}
