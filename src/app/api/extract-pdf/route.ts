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

    // Check if Python service is available - temporarily force mock data for debugging
    const useMockData = true; // Temporarily force mock data to test AI categorization

    if (useMockData) {
      // Enhanced mock implementation with realistic rideshare data
      console.log("Using enhanced mock PDF extraction for debugging");
      const mockResult = {
        transactions: [
          {
            date: "2025-06-30",
            description: "UBER BV Trip - Downtown to Airport",
            amount: 45.50,
          },
          {
            date: "2025-06-29", 
            description: "DIDI MOBILITY Trip - Home to Mall",
            amount: 18.75,
          },
          {
            date: "2025-06-28",
            description: "AMPOL Fuel Purchase - Vehicle Refuel",
            amount: -65.00,
          },
          {
            date: "2025-06-27",
            description: "Uber Tip from Passenger",
            amount: 5.00,
          },
          {
            date: "2025-06-26",
            description: "LINKT Melbourne Toll Charges",
            amount: -12.30,
          },
          {
            date: "2025-06-25",
            description: "IMO CARWASH Vehicle Cleaning",
            amount: -25.00,
          },
          {
            date: "2025-06-24",
            description: "Felix Mobile Phone Bill",
            amount: -30.00,
          },
          {
            date: "2025-06-23",
            description: "UBER BV Trip - City to Suburbs",
            amount: 32.80,
          },
        ],
        pageCount: 1,
        transactionCount: 8,
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
