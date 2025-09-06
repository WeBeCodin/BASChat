import { NextRequest, NextResponse } from "next/server";

// Types for extraction results
interface ExtractionResult {
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
  pageCount: number;
  transactionCount: number;
  extractionEngine: 'python' | 'vertex-ai';
  extractionTime: number;
  confidence?: number;
}

interface ExtractorResponse {
  success: boolean;
  data?: ExtractionResult;
  error?: string;
  errorType?: 'connection' | 'processing' | 'format' | 'timeout';
}

// Configuration
const CONFIG = {
  pageLimit: parseInt(process.env.EXTRACT_PAGE_LIMIT_FOR_PYTHON || '1'),
  pythonServiceUrl: process.env.PYTHON_EXTRACTOR_URL || 'http://localhost:8000',
  langExtractUrl: process.env.LANGEXTRACT_SERVICE_URL || 'http://localhost:8084',
  vertexAiModel: process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash-lite',
  enableLogging: process.env.ENABLE_EXTRACTION_LOGGING === 'true',
  timeouts: {
    python: 30000, // 30 seconds for Python service
    vertexAi: 60000, // 60 seconds for Vertex AI
  }
};

// Logging utility
function logExtractionEvent(event: {
  engine: string;
  success: boolean;
  pageCount?: number;
  transactionCount?: number;
  executionTime?: number;
  errorType?: string;
  fileName?: string;
  fileSize?: number;
}) {
  if (!CONFIG.enableLogging) return;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event
  };
  
  console.log('[EXTRACTION_LOG]', JSON.stringify(logEntry));
}

// Analyze PDF to determine page count and complexity
async function analyzePdf(fileBuffer: ArrayBuffer): Promise<{ pageCount: number; isComplex: boolean; confidence: number }> {
  try {
    // Convert to base64 for Python service analysis
    const base64Content = Buffer.from(fileBuffer).toString('base64');
    
    // Call Python service for detailed PDF analysis
    const response = await fetch(`${CONFIG.langExtractUrl}/analyze-pdf`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_content: base64Content }),
      signal: AbortSignal.timeout(10000), // 10 second timeout for analysis
    });

    if (response.ok) {
      const analysis = await response.json();
      console.log('[HYBRID] PDF Analysis:', analysis);
      
      // Determine complexity based on detailed analysis
      const isComplex = 
        analysis.page_count > CONFIG.pageLimit ||
        analysis.layout_complexity === 'complex' ||
        analysis.has_forms ||
        !analysis.is_searchable ||
        analysis.extraction_confidence < 0.7;
      
      return {
        pageCount: analysis.page_count,
        isComplex,
        confidence: analysis.extraction_confidence
      };
    } else {
      console.warn('[HYBRID] PDF analysis service unavailable, falling back to heuristics');
    }
  } catch (error) {
    console.warn('[HYBRID] PDF analysis failed, using heuristics:', error);
  }
  
  // Fallback to original heuristic method
  const fileSizeKB = fileBuffer.byteLength / 1024;
  const estimatedPageCount = Math.max(1, Math.floor(fileSizeKB / 50)); // ~50KB per page average
  const isComplex = estimatedPageCount > CONFIG.pageLimit || fileSizeKB > 500;
  
  return {
    pageCount: estimatedPageCount,
    isComplex,
    confidence: 0.6 // Lower confidence for heuristic analysis
  };
}

// Python/PyMuPDF extractor
async function extractWithPython(file: File): Promise<ExtractorResponse> {
  const startTime = Date.now();
  
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", "bank_statement");

    const response = await fetch(`${CONFIG.langExtractUrl}/extract`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(CONFIG.timeouts.python),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      return {
        success: false,
        error: `Python service error: ${response.status} - ${errorData.error || 'Unknown error'}`,
        errorType: response.status >= 500 ? 'processing' : 'connection'
      };
    }

    const result = await response.json();
    const executionTime = Date.now() - startTime;

    // Transform to unified schema
    const unifiedResult: ExtractionResult = {
      transactions: result.transactions.map((t: any) => ({
        date: t.date || t.transaction_date,
        description: t.description,
        amount: t.amount
      })),
      pageCount: result.page_count || 1,
      transactionCount: result.transaction_count || result.transactions.length,
      extractionEngine: 'python',
      extractionTime: executionTime,
      confidence: result.extraction_confidence || 0.95
    };

    logExtractionEvent({
      engine: 'python',
      success: true,
      pageCount: unifiedResult.pageCount,
      transactionCount: unifiedResult.transactionCount,
      executionTime,
      fileName: file.name,
      fileSize: file.size
    });

    return {
      success: true,
      data: unifiedResult
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorType = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'connection';
    
    logExtractionEvent({
      engine: 'python',
      success: false,
      executionTime,
      errorType,
      fileName: file.name,
      fileSize: file.size
    });

    return {
      success: false,
      error: `Python extraction failed: ${error}`,
      errorType
    };
  }
}

// Vertex AI extractor
async function extractWithVertexAI(file: File): Promise<ExtractorResponse> {
  const startTime = Date.now();
  
  try {
    // Convert file to base64 for AI processing
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString('base64');
    const dataUri = `data:application/pdf;base64,${base64Content}`;

    // Use the existing AI flow
    const { extractFinancialData } = await import('@/ai/flows/extract-financial-data');
    const result = await extractFinancialData({ pdfDataUri: dataUri });
    
    const executionTime = Date.now() - startTime;

    const unifiedResult: ExtractionResult = {
      transactions: result.transactions,
      pageCount: result.pageCount,
      transactionCount: result.transactionCount,
      extractionEngine: 'vertex-ai',
      extractionTime: executionTime,
      confidence: 0.90 // Vertex AI confidence estimate
    };

    logExtractionEvent({
      engine: 'vertex-ai',
      success: true,
      pageCount: unifiedResult.pageCount,
      transactionCount: unifiedResult.transactionCount,
      executionTime,
      fileName: file.name,
      fileSize: file.size
    });

    return {
      success: true,
      data: unifiedResult
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorType = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'processing';
    
    logExtractionEvent({
      engine: 'vertex-ai',
      success: false,
      executionTime,
      errorType,
      fileName: file.name,
      fileSize: file.size
    });

    return {
      success: false,
      error: `Vertex AI extraction failed: ${error}`,
      errorType
    };
  }
}

// Main hybrid extraction function
async function hybridExtract(file: File): Promise<ExtractionResult> {
  const fileBuffer = await file.arrayBuffer();
  const { pageCount, isComplex, confidence } = await analyzePdf(fileBuffer);
  
  console.log(`[HYBRID] File: ${file.name}, Pages: ${pageCount}, Complex: ${isComplex}, Confidence: ${confidence}, Threshold: ${CONFIG.pageLimit}`);

  // Routing logic: Use Python for simple, single-page documents with high confidence
  const usePython = !isComplex && pageCount <= CONFIG.pageLimit && confidence > 0.7;
  
  if (usePython) {
    console.log('[HYBRID] Routing to Python/PyMuPDF extractor (high confidence, simple document)');
    const pythonResult = await extractWithPython(file);
    
    if (pythonResult.success) {
      return pythonResult.data!;
    }
    
    // Fallback to Vertex AI if Python fails
    console.log('[HYBRID] Python failed, falling back to Vertex AI');
    const vertexResult = await extractWithVertexAI(file);
    
    if (vertexResult.success) {
      return vertexResult.data!;
    }
    
    // Both failed
    throw new Error(`Both extractors failed. Python: ${pythonResult.error}, Vertex AI: ${vertexResult.error}`);
  } else {
    console.log('[HYBRID] Routing to Vertex AI extractor for multi-page/complex document or low confidence');
    const vertexResult = await extractWithVertexAI(file);
    
    if (vertexResult.success) {
      return vertexResult.data!;
    }
    
    // Fallback to Python if Vertex AI fails
    console.log('[HYBRID] Vertex AI failed, falling back to Python');
    const pythonResult = await extractWithPython(file);
    
    if (pythonResult.success) {
      return pythonResult.data!;
    }
    
    // Both failed
    throw new Error(`Both extractors failed. Vertex AI: ${vertexResult.error}, Python: ${pythonResult.error}`);
  }
}

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

    console.log(`[HYBRID] Processing: ${file.name} (${file.size} bytes)`);
    
    const result = await hybridExtract(file);
    
    console.log(`[HYBRID] Extraction completed: ${result.transactionCount} transactions from ${result.pageCount} pages using ${result.extractionEngine} in ${result.extractionTime}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error("[HYBRID] Extraction pipeline failed:", error);
    
    logExtractionEvent({
      engine: 'hybrid',
      success: false,
      errorType: 'processing'
    });

    return NextResponse.json(
      {
        error: "Document extraction failed",
        details: error instanceof Error ? error.message : "Both extraction engines failed to process the document. Please ensure the document is a valid PDF with readable financial data.",
        extractionEngine: null,
        extractionTime: 0
      },
      { status: 500 }
    );
  }
}