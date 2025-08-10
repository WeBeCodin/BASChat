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
      
      // Fallback to in-process extraction if service unavailable
      console.log("Attempting in-process extraction as fallback...");
      
      try {
        const fallbackResult = await extractInProcess(buffer, documentType);
        console.log("✅ Fallback extraction successful");
        return NextResponse.json(fallbackResult);
      } catch (fallbackError) {
        console.error("❌ Fallback extraction also failed:", fallbackError);
        return NextResponse.json(
          { 
            error: `Both LangExtract service and fallback failed. Service: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}, Fallback: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}` 
          },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    console.error("Error in LangExtract PDF extraction:", error);
    return NextResponse.json(
      { error: `PDF extraction failed: ${error}` },
      { status: 500 }
    );
  }
}

// Fallback in-process extraction using simple parsing
async function extractInProcess(buffer: Buffer, documentType: string) {
  // Import pdf-parse dynamically
  const pdf = await import('pdf-parse');
  
  const data = await pdf.default(buffer);
  const text = data.text;
  
  console.log(`Fallback extraction: ${data.numpages} pages, ${text.length} characters`);
  
  // Basic transaction parsing for fallback
  const transactions = parseTransactionsBasic(text);
  
  return {
    transactions,
    page_count: data.numpages,
    transaction_count: transactions.length,
    document_type: documentType,
    extraction_confidence: 0.7, // Lower confidence for fallback
    extraction_method: "fallback_basic_parsing"
  };
}

// Basic transaction parsing for fallback mode
function parseTransactionsBasic(text: string) {
  const transactions = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.trim().length < 15) continue;
    
    // Look for date patterns
    const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (!dateMatch) continue;
    
    // Look for amount patterns
    const amountMatch = line.match(/([-+]?\$?[\d,]+\.?\d*)/g);
    if (!amountMatch) continue;
    
    // Extract description (text between date and first amount)
    const datePos = line.indexOf(dateMatch[0]);
    const firstAmountPos = line.indexOf(amountMatch[0]);
    
    if (firstAmountPos <= datePos) continue;
    
    const description = line.substring(datePos + dateMatch[0].length, firstAmountPos).trim();
    if (description.length < 3) continue;
    
    // Parse amount
    const amountStr = amountMatch[amountMatch.length - 1]; // Take last amount (usually the transaction amount)
    let amount = parseFloat(amountStr.replace(/[$,\s]/g, ''));
    if (line.includes('-') || line.toLowerCase().includes('withdrawal')) {
      amount = -Math.abs(amount);
    }
    
    // Format date
    let formattedDate;
    try {
      const [day, month, year] = dateMatch[0].split(/[\/\-]/);
      const fullYear = year.length === 2 ? `20${year}` : year;
      formattedDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } catch {
      formattedDate = new Date().toISOString().split('T')[0]; // Default to today
    }
    
    transactions.push({
      date: formattedDate,
      description: description,
      amount: amount,
      category: amount > 0 ? "Income" : "Expense"
    });
  }
  
  return transactions;
}
