#!/usr/bin/env python3
"""
Debug version of main.py to identify the exact issue
"""

import sys
import traceback

try:
    print("Starting imports...")
    
    from fastapi import FastAPI, File, UploadFile, HTTPException, status
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    print("FastAPI imports OK")
    
    import base64
    import logging
    print("Standard library imports OK")
    
    from schemas import ExtractionResult, ExtractionRequest, ErrorResponse
    print("Schemas import OK")
    
    from extractor import LangExtractStyleExtractor
    print("Extractor import OK")
    
    import uvicorn
    import os
    from dotenv import load_dotenv
    print("Additional imports OK")
    
    # Load environment variables
    load_dotenv()
    print("Environment loaded")
    
    # Configure logging
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)
    print("Logging configured")
    
    # Create FastAPI app
    app = FastAPI(
        title="PDF Financial Data Extractor",
        description="Debug version",
        version="2.0.0"
    )
    print("FastAPI app created")
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    print("CORS middleware added")
    
    # Create extractor instance
    print("Creating extractor instance...")
    extractor = LangExtractStyleExtractor()
    print("Extractor instance created successfully")
    
    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "pdf-extractor-debug"}
    
    print("Health endpoint registered")
    
    if __name__ == "__main__":
        port = int(os.getenv("PORT", 8082))
        print(f"Starting server on port {port}...")
        uvicorn.run(app, host="0.0.0.0", port=port)
        
except Exception as e:
    print(f"ERROR: {e}")
    print(f"Exception type: {type(e).__name__}")
    traceback.print_exc()
    sys.exit(1)
