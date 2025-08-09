import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_EXTRACTOR_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    // Create form data for Python service
    const pythonFormData = new FormData();
    pythonFormData.append('file', file);

    // Forward request to Python service
    const response = await fetch(`${PYTHON_SERVICE_URL}/extract`, {
      method: 'POST',
      body: pythonFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Extraction failed' },
        { status: response.status }
      );
    }

    const result = await response.json();
    
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

    return NextResponse.json(transformedResult);
  } catch (error) {
    console.error('Error in extract-pdf API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}