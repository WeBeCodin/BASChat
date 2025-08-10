import { NextRequest, NextResponse } from "next/server";

// Test endpoint that simulates real PDF extraction results
// This shows what the Python service would actually return
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`Testing PDF extraction for file: ${file.name} (${file.size} bytes)`);

    // Simulate what the Python LangExtractStyleExtractor would return
    // This is based on the schemas.py ExtractionResult format
    const realPdfExtractionResult = {
      transactions: [
        {
          date: "2025-06-30",
          description: "Transfer from NAB to Commbank - Rideshare Business Account",
          amount: 450.75,
          category: "Transfer",
          balance: 1250.30
        },
        {
          date: "2025-06-29",
          description: "UBER TECHNOLOGIES WEEKLY PAYOUT",
          amount: 387.45,
          category: "Deposit", 
          balance: 799.55
        },
        {
          date: "2025-06-28",
          description: "DIDI WEEKLY EARNINGS PAYOUT",
          amount: 156.80,
          category: "Deposit",
          balance: 412.10
        },
        {
          date: "2025-06-27",
          description: "AMPOL FUEL STATION - Card Payment",
          amount: -72.30,
          category: "Purchase",
          balance: 255.30
        },
        {
          date: "2025-06-26", 
          description: "LINKT TOLL CHARGES - M1/M2 SYDNEY",
          amount: -15.60,
          category: "Fee",
          balance: 327.60
        },
        {
          date: "2025-06-25",
          description: "COSTCO GASOLINE #123 - Vehicle Fuel",
          amount: -68.90,
          category: "Purchase", 
          balance: 343.20
        },
        {
          date: "2025-06-24",
          description: "WOOLWORTHS 1234 - Snacks & Beverages",
          amount: -24.50,
          category: "Purchase",
          balance: 412.10
        },
        {
          date: "2025-06-23",
          description: "OPTUS MOBILE SERVICE - Monthly Plan",
          amount: -45.00,
          category: "Fee",
          balance: 436.60
        },
        {
          date: "2025-06-22",
          description: "CASH WITHDRAWAL - ATM Westfield",
          amount: -80.00,
          category: "Withdrawal",
          balance: 481.60
        },
        {
          date: "2025-06-21",
          description: "UBER TECHNOLOGIES WEEKLY PAYOUT",
          amount: 298.75,
          category: "Deposit",
          balance: 561.60
        }
      ],
      page_count: 3,
      transaction_count: 10,
      document_type: "bank_statement",
      extraction_confidence: 0.92,
      metadata: {
        account_number: "****1234",
        statement_period: "2025-06-21 to 2025-06-30", 
        institution: "Commonwealth Bank",
        account_type: "Business Transaction Account"
      }
    };

    console.log("Generated realistic PDF extraction result:", {
      transactionCount: realPdfExtractionResult.transaction_count,
      pageCount: realPdfExtractionResult.page_count,
      documentType: realPdfExtractionResult.document_type,
      confidence: realPdfExtractionResult.extraction_confidence
    });

    return NextResponse.json(realPdfExtractionResult);

  } catch (error) {
    console.error("Error in test PDF extraction:", error);
    return NextResponse.json(
      { error: "Test extraction failed" },
      { status: 500 }
    );
  }
}
