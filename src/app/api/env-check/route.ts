import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasGoogleAIKey: !!process.env.GOOGLE_GENAI_API_KEY,
        keyLength: process.env.GOOGLE_GENAI_API_KEY?.length || 0,
        vercelEnv: process.env.VERCEL_ENV,
        allEnvKeys: Object.keys(process.env).filter(key => 
          key.includes('GOOGLE') || 
          key.includes('AI') || 
          key.includes('GENAI') ||
          key.includes('API_KEY')
        ),
        status: "Environment check endpoint working"
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: "Environment check failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
