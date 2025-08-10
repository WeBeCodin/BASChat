import { NextRequest, NextResponse } from "next/server";

// Test endpoint to validate hybrid extraction routing logic and configuration
export async function GET(request: NextRequest) {
  try {
    const CONFIG = {
      pageLimit: parseInt(process.env.EXTRACT_PAGE_LIMIT_FOR_PYTHON || '1'),
      pythonServiceUrl: process.env.PYTHON_EXTRACTOR_URL || 'http://localhost:8000',
      langExtractUrl: process.env.LANGEXTRACT_SERVICE_URL || 'http://localhost:8084',
      vertexAiModel: process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash-lite',
      enableLogging: process.env.ENABLE_EXTRACTION_LOGGING === 'true',
    };

    // Test the routing logic with mock file scenarios
    const testScenarios = [
      {
        name: "Small single-page PDF",
        fileSize: 45000, // 45KB
        estimatedPages: 1,
        expectedEngine: "python",
        reason: "Small file, single page, within Python threshold"
      },
      {
        name: "Large multi-page PDF",
        fileSize: 250000, // 250KB
        estimatedPages: 5,
        expectedEngine: "vertex-ai",
        reason: "Multi-page document exceeds Python threshold"
      },
      {
        name: "Complex single-page PDF",
        fileSize: 800000, // 800KB
        estimatedPages: 1,
        expectedEngine: "vertex-ai",
        reason: "Large file size indicates complexity"
      },
      {
        name: "Medium PDF at threshold",
        fileSize: 50000, // 50KB
        estimatedPages: 1,
        expectedEngine: CONFIG.pageLimit >= 1 ? "python" : "vertex-ai",
        reason: `At page threshold (${CONFIG.pageLimit})`
      }
    ];

    // Simulate routing decisions for each scenario
    const routingResults = testScenarios.map(scenario => {
      const fileSizeKB = scenario.fileSize / 1024;
      const estimatedPageCount = Math.max(1, Math.floor(fileSizeKB / 50));
      const isComplex = estimatedPageCount > CONFIG.pageLimit || fileSizeKB > 500;
      const usePython = !isComplex && estimatedPageCount <= CONFIG.pageLimit;
      const actualEngine = usePython ? "python" : "vertex-ai";
      
      return {
        ...scenario,
        actualPageCount: estimatedPageCount,
        isComplex,
        actualEngine,
        routingCorrect: actualEngine === scenario.expectedEngine
      };
    });

    // Test service connectivity (simulate without actually calling)
    const serviceStatus = {
      pythonService: {
        url: CONFIG.langExtractUrl,
        available: "simulated", // Would test actual connectivity in real scenario
      },
      vertexAi: {
        model: CONFIG.vertexAiModel,
        available: "simulated",
      }
    };

    const result = {
      configuration: CONFIG,
      routingTests: routingResults,
      serviceStatus,
      summary: {
        totalTests: routingResults.length,
        passingTests: routingResults.filter(r => r.routingCorrect).length,
        failingTests: routingResults.filter(r => !r.routingCorrect).length,
      }
    };

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error("Hybrid extraction test error:", error);
    return NextResponse.json(
      {
        error: "Test failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Test specific routing scenarios via POST
export async function POST(request: NextRequest) {
  try {
    const { fileSize, fileName } = await request.json();
    
    if (!fileSize || !fileName) {
      return NextResponse.json(
        { error: "fileSize and fileName are required" },
        { status: 400 }
      );
    }

    const CONFIG = {
      pageLimit: parseInt(process.env.EXTRACT_PAGE_LIMIT_FOR_PYTHON || '1'),
      enableLogging: process.env.ENABLE_EXTRACTION_LOGGING === 'true',
    };

    // Simulate the same analysis logic as the hybrid extractor
    const fileSizeKB = fileSize / 1024;
    const estimatedPageCount = Math.max(1, Math.floor(fileSizeKB / 50));
    const isComplex = estimatedPageCount > CONFIG.pageLimit || fileSizeKB > 500;
    const usePython = !isComplex && estimatedPageCount <= CONFIG.pageLimit;
    const selectedEngine = usePython ? "python" : "vertex-ai";

    const result = {
      fileName,
      fileSize,
      fileSizeKB: Math.round(fileSizeKB),
      estimatedPageCount,
      isComplex,
      pageThreshold: CONFIG.pageLimit,
      selectedEngine,
      routingReason: usePython 
        ? `File is simple (${estimatedPageCount} pages, ${Math.round(fileSizeKB)}KB) and within Python threshold`
        : `File is complex (${estimatedPageCount} pages, ${Math.round(fileSizeKB)}KB) or exceeds Python threshold`,
      fallbackEngine: usePython ? "vertex-ai" : "python",
      timestamp: new Date().toISOString()
    };

    // Log if enabled
    if (CONFIG.enableLogging) {
      console.log('[ROUTING_TEST]', JSON.stringify(result));
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error("Routing test error:", error);
    return NextResponse.json(
      {
        error: "Routing test failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}