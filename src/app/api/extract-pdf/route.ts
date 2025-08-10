import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL =
  process.env.PYTHON_EXTRACTOR_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

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

    // Create form data for Python service
    const pythonFormData = new FormData();
    pythonFormData.append("file", file);

    // Check if Python service is available
    const useMockData = PYTHON_SERVICE_URL === "http://localhost:8000" && process.env.NODE_ENV !== "development";

    if (useMockData) {
      // Mock implementation for development
      console.log("Using mock PDF extraction for development");
      const mockResult = {
        transactions: [
          {
            date: "2024-01-15",
            description: "ATM Withdrawal",
            amount: -200.0,
          },
          {
            date: "2024-01-16",
            description: "Grocery Store Purchase",
            amount: -85.5,
          },
          {
            date: "2024-01-17",
            description: "Salary Deposit",
            amount: 3500.0,
          },
          {
            date: "2024-01-18",
            description: "Online Transfer",
            amount: -150.0,
          },
        ],
        pageCount: 1,
        transactionCount: 4,
      };

      return NextResponse.json(mockResult);
    }

    // Forward request to Python service
    let response;
    try {
      response = await fetch(`${PYTHON_SERVICE_URL}/extract`, {
        method: "POST",
        body: pythonFormData,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
    } catch (error) {
      console.error("Failed to connect to Python service:", error);
      return NextResponse.json(
        {
          error: "PDF extraction service is unavailable",
          detail:
            "The Python service for extracting PDF data is not running. Please start the Python service on port 8000.",
        },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(
        { error: errorData.detail || "Extraction failed" },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // Debug: Log what we got from Python service
    console.log("Raw Python service response:", JSON.stringify(result, null, 2));
    console.log("Python service transaction count:", result.transactions?.length);
    console.log("First few transactions from Python:", result.transactions?.slice(0, 3));

    // Transform the response to match the existing schema
    const transformedResult = {
      transactions: result.transactions.map((t: any) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
      })),
      pageCount: result.page_count,
      transactionCount: result.transaction_count,
    };
    
    console.log("Transformed result for frontend:", JSON.stringify(transformedResult, null, 2));

    return NextResponse.json(transformedResult);
  } catch (error) {
    console.error("Error in extract-pdf API:", error);

    // Provide more specific error messages
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          error: "PDF extraction service is unavailable",
          detail:
            "Cannot connect to the Python service. Please ensure the Python service is running on port 8000.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
