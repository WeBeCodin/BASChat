#!/usr/bin/env python3
"""
LangExtract FastAPI service implementing the technical specification
This provides the /extract endpoint for the Node.js frontend
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import uvicorn
import os
import sys
import logging

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from langextract_service import handle_extraction_request
except ImportError as e:
    print(f"Failed to import langextract_service: {e}")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="LangExtract PDF Extraction Service",
    description="Technical specification compliant PDF extraction using LangExtract methodology",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model
class ExtractionRequest(BaseModel):
    file_content: str  # base64 encoded PDF
    document_type: str = "bank_statement"
    filename: str = "document.pdf"

@app.get("/")
async def root():
    return {
        "service": "LangExtract PDF Extraction",
        "version": "1.0.0",
        "status": "operational",
        "technical_spec": "Implements LangExtract methodology with PyMuPDF and Pydantic schemas"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "langextract-pdf-extractor",
        "google_ai_configured": bool(os.environ.get('GOOGLE_GENAI_API_KEY'))
    }

@app.post("/extract")
async def extract_pdf(request: ExtractionRequest):
    """
    Main extraction endpoint following technical specification Step 5
    """
    try:
        logger.info(f"Processing extraction request for {request.filename}")
        logger.info(f"Document type: {request.document_type}")
        logger.info(f"File content size: {len(request.file_content)} base64 chars")
        
        # Decode base64 content
        try:
            pdf_content = base64.b64decode(request.file_content)
            logger.info(f"Decoded PDF size: {len(pdf_content)} bytes")
        except Exception as e:
            logger.error(f"Base64 decode error: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid base64 content: {e}")
        
        # Process with LangExtract service
        result = handle_extraction_request(pdf_content, request.document_type)
        
        logger.info(f"✅ Extraction completed: {result['transaction_count']} transactions")
        logger.info(f"Confidence: {result['extraction_confidence']}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}"
        )

@app.get("/test")
async def test_environment():
    """Test endpoint to verify environment setup"""
    try:
        # Test imports
        import fitz
        import google.generativeai as genai
        from pydantic import BaseModel
        
        # Test Google AI configuration
        api_key = os.environ.get('GOOGLE_GENAI_API_KEY')
        
        return {
            "status": "environment_ok",
            "pymupdf_version": fitz.version[0],
            "google_ai_configured": bool(api_key),
            "google_ai_key_length": len(api_key) if api_key else 0,
            "pydantic_available": True
        }
        
    except Exception as e:
        return {
            "status": "environment_error",
            "error": str(e)
        }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8084))
    logger.info(f"Starting LangExtract PDF Extraction Service on port {port}")
    logger.info("Technical specification: LangExtract with PyMuPDF and Pydantic schemas")
    uvicorn.run(app, host="0.0.0.0", port=port)
