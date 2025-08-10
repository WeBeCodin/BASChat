from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import base64
import logging
from schemas import ExtractionResult, ExtractionRequest, ErrorResponse
from extractor import RobustPDFExtractor
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="PDF Transaction Extractor",
    description="Microservice for extracting financial transactions from PDF documents",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize extractor
extractor = RobustPDFExtractor()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "PDF Transaction Extractor Service", "status": "healthy"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "pdf-extractor"}

@app.post("/extract", response_model=ExtractionResult)
async def extract_transactions(file: UploadFile = File(...)):
    """
    Extract transactions from an uploaded PDF file
    """
    try:
        # Validate file type
        if not file.content_type or "pdf" not in file.content_type.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be a PDF"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Encode to base64
        base64_content = base64.b64encode(file_content).decode('utf-8')
        
        # Extract transactions
        result = extractor.extract_from_base64(base64_content)
        
        logger.info(f"Successfully extracted {result.transaction_count} transactions from {result.page_count} pages")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract transactions: {str(e)}"
        )

@app.post("/extract-base64", response_model=ExtractionResult)
async def extract_transactions_from_base64(request: ExtractionRequest):
    """
    Extract transactions from base64 encoded PDF content
    """
    try:
        # Extract transactions
        result = extractor.extract_from_base64(request.file_content)
        
        logger.info(f"Successfully extracted {result.transaction_count} transactions from {result.page_count} pages")
        
        return result
        
    except Exception as e:
        logger.error(f"Extraction error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract transactions: {str(e)}"
        )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)