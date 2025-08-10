import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL = process.env.PYTHON_EXTRACTOR_URL || "http://localhost:8000";

export async function GET() {
  try {
    // Test the Python service health
    const healthResponse = await fetch(`${PYTHON_SERVICE_URL}/health`);
    const healthData = await healthResponse.json();
    
    // Test with a simple PDF (we'll create a minimal test PDF data)
    const testPdfBase64 = "JVBERi0xLjQKJcOkw7zDqAoxIDAgb2JqCjw8Ci9UeXBlIC9DYXRhbG9nCi9QYWdlcyAyIDAgUgo+PgplbmRvYmoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzMgMCBSXQovQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDQgMCBSCj4+Cj4+Ci9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwIDc0MCBUZAKJRUFURSA6IDIwMjUtMDYtMzAgQU1PVU5UOiAkMTAuMDBdCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmCjAwMDAwMDAwMDkgMDAwMDAgbgowMDAwMDAwMDc0IDAwMDAwIG4KMDAwMDAwMDEyMCAwMDAwMCBuCjAwMDAwMDAyNzkgMDAwMDAgbgowMDAwMDAwMzY0IDAwMDAwIG4KdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0NTgKJSVFT0Y=";
    
    // Test direct extraction
    const extractResponse = await fetch(`${PYTHON_SERVICE_URL}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdf_base64: testPdfBase64
      })
    });
    
    let extractData = null;
    if (extractResponse.ok) {
      extractData = await extractResponse.json();
    } else {
      extractData = { error: `Extract failed: ${extractResponse.status}` };
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      service_url: PYTHON_SERVICE_URL,
      health: healthData,
      test_extraction: extractData,
      notes: "This is a test endpoint to debug the Python extraction service"
    });
    
  } catch (error) {
    return NextResponse.json({
      error: "Test failed",
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
