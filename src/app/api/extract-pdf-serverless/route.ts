import { NextRequest, NextResponse } from "next/server";

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

    // For now, let's use enhanced mock data that simulates real PDF extraction
    // We'll implement actual PDF parsing later with a different approach
    console.log("Processing PDF file:", file.name, "Size:", file.size);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Enhanced mock data with more realistic rideshare transactions
    const mockTransactions = [
      {
        date: "2025-06-30",
        description: "UBER BV Trip - Melbourne Airport to CBD",
        amount: 67.8,
      },
      {
        date: "2025-06-30",
        description: "UBER BV Trip - Carlton to South Yarra",
        amount: 23.45,
      },
      {
        date: "2025-06-29",
        description: "DIDI MOBILITY Trip - Richmond to Fitzroy",
        amount: 15.6,
      },
      {
        date: "2025-06-29",
        description: "Uber Passenger Tip",
        amount: 8.0,
      },
      {
        date: "2025-06-28",
        description: "AMPOL Fuel Station - Premium Unleaded",
        amount: -72.3,
      },
      {
        date: "2025-06-28",
        description: "UBER BV Trip - Southbank to Docklands",
        amount: 19.9,
      },
      {
        date: "2025-06-27",
        description: "LINKT Melbourne CityLink Toll",
        amount: -8.5,
      },
      {
        date: "2025-06-27",
        description: "DIDI MOBILITY Trip - St Kilda to Brighton",
        amount: 28.75,
      },
      {
        date: "2025-06-26",
        description: "IMO CARWASH Premium Car Wash",
        amount: -35.0,
      },
      {
        date: "2025-06-26",
        description: "Felix Mobile Monthly Phone Bill",
        amount: -25.0,
      },
      {
        date: "2025-06-25",
        description: "UBER BV Trip - Toorak to Chapel Street",
        amount: 16.2,
      },
      {
        date: "2025-06-25",
        description: "Knights Windscreen Repairs Service",
        amount: -180.0,
      },
      {
        date: "2025-06-24",
        description: "CALTEX Fuel Station - Regular Unleaded",
        amount: -68.9,
      },
      {
        date: "2025-06-24",
        description: "UBER BV Trip - Prahran to Caulfield",
        amount: 22.3,
      },
      {
        date: "2025-06-23",
        description: "MYOB Accounting Software Subscription",
        amount: -59.0,
      },
    ];

    return NextResponse.json({
      transactions: mockTransactions,
      pageCount: 5,
      transactionCount: mockTransactions.length,
      source: "serverless-mock-extraction",
    });
  } catch (error) {
    console.error("Error in serverless PDF extraction:", error);
    return NextResponse.json(
      {
        error: "PDF extraction failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
