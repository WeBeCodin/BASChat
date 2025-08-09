from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import base64
import logging
from schemas import ExtractionResult, ExtractionRequest, ErrorResponse
from extractor import LangExtractStyleExtractor
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="PDF Financial Data Extractor",
    description="LangExtract-powered microservice for extracting financial transactions from PDF documents",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the new LangExtract-style extractor
extractor = LangExtractStyleExtractor()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "PDF Financial Data Extractor Service", 
        "status": "healthy",
        "version": "2.0.0",
        "engine": "LangExtract-powered extraction with PyMuPDF"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "pdf-extractor", "version": "2.0.0"}

@app.post("/extract", response_model=ExtractionResult)
async def extract_transactions(file: UploadFile = File(...)):
    """
    Extract transactions from an uploaded PDF file using LangExtract-style structured extraction
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
        
        # Validate file size (add reasonable limits)
        if len(file_content) > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds 50MB limit"
            )
        
        # Encode to base64
        base64_content = base64.b64encode(file_content).decode('utf-8')
        
        # Extract transactions using the new LangExtract-style approach
        result = extractor.extract_from_base64(base64_content)
        
        logger.info(f"Successfully extracted {result.transaction_count} transactions from {result.page_count} pages using LangExtract-style extraction")
        
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Extraction error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract transactions: {str(e)}"
        )

@app.post("/extract-base64", response_model=ExtractionResult)
async def extract_transactions_from_base64(request: ExtractionRequest):
    """
    Extract transactions from base64 encoded PDF content using LangExtract-style structured extraction
    """
    try:
        # Validate base64 content
        try:
            # Test decode to validate base64
            test_decode = base64.b64decode(request.file_content)
            if len(test_decode) == 0:
                raise ValueError("Empty file content")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid base64 content"
            )
        
        # Extract transactions using the new LangExtract-style approach
        result = extractor.extract_from_base64(request.file_content)
        
        logger.info(f"Successfully extracted {result.transaction_count} transactions from {result.page_count} pages using LangExtract-style extraction")
        
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Extraction error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract transactions: {str(e)}"
        )

@app.post("/extract-structured")
async def extract_structured_data(request: ExtractionRequest):
    """
    Extract structured data directly (returns RideshareTaxSummary or TransactionList)
    For admin/debug use only
    """
    try:
        # Extract structured data
        structured_data = extractor.extract_structured(request.file_content)
        
        logger.info(f"Successfully extracted structured data of type: {type(structured_data).__name__}")
        
        # Convert to dict for JSON response
        if hasattr(structured_data, 'dict'):
            return structured_data.dict()
        else:
            return [item.dict() for item in structured_data]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Structured extraction error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract structured data: {str(e)}"
        )

@app.post("/visualize")
async def visualize_extraction(request: ExtractionRequest):
    """
    Admin/debug-only visualization using langextract.visualize() equivalent
    """
    try:
        # Get visualization data
        visualization = extractor.visualize_extraction(request.file_content)
        
        logger.info("Generated extraction visualization for admin/debug")
        
        return visualization
        
    except Exception as e:
        logger.error(f"Visualization error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate visualization: {str(e)}"
        )

@app.get("/admin/status")
async def admin_status():
    """Admin endpoint for service status and configuration"""
    return {
        "service": "PDF Financial Data Extractor",
        "version": "2.0.0",
        "extraction_engine": "LangExtract-style with PyMuPDF",
        "supported_document_types": ["bank_statements", "rideshare_summaries", "general_financial"],
        "features": {
            "robust_pdf_extraction": True,
            "structured_data_extraction": True,
            "error_handling_and_repair": True,
            "admin_visualization": True,
            "pydantic_validation": True
        },
        "schemas": {
            "BankTransaction": "Standardized bank transaction format",
            "TransactionList": "Bank statement with metadata",
            "RideshareTaxSummary": "Rideshare earnings summary",
            "RideshareTrip": "Individual rideshare trip details"
        }
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)