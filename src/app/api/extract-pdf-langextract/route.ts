import { NextRequest, NextResponse } from "next/server";

// LangExtract-based PDF extraction following the technical specification
// This calls the Python LangExtract service with proper error handling

const LANGEXTRACT_SERVICE_URL = process.env.LANGEXTRACT_SERVICE_URL || "http://localhost:8084";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const documentType = formData.get("document_type") as string || "bank_statement";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    console.log(`Processing PDF with LangExtract: ${file.name} (${file.size} bytes)`);
    console.log(`Document type: ${documentType}`);

    // Convert file to base64 for Python service
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString('base64');

    // Call LangExtract Python service
    try {
      const response = await fetch(`${LANGEXTRACT_SERVICE_URL}/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_content: base64Content,
          document_type: documentType,
          filename: file.name
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout for AI processing
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("LangExtract service error:", errorData);
        throw new Error(`LangExtract service failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      
      console.log(`LangExtract extraction completed: ${result.transaction_count} transactions from ${result.page_count} pages`);
      console.log(`Confidence: ${result.extraction_confidence}, Type: ${result.document_type}`);
      
      // Log first few transactions for verification
      if (result.transactions && result.transactions.length > 0) {
        console.log("Sample transactions:", result.transactions.slice(0, 3));
      }
      
      return NextResponse.json(result);

    } catch (fetchError) {
      console.error("Failed to connect to LangExtract service:", fetchError);
      
      // Return error instead of fallback to avoid Vercel build issues
      return NextResponse.json(
        { 
          error: `LangExtract service unavailable. Please ensure the Python service is running on ${LANGEXTRACT_SERVICE_URL}. Error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}` 
        },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error("Error in LangExtract PDF extraction:", error);
    return NextResponse.json(
      { error: `PDF extraction failed: ${error}` },
      { status: 500 }
    );
  }
}
