from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

app = FastAPI(title="Simple PDF Extractor")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Simple PDF Extractor Service", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "pdf-extractor"}

@app.post("/extract")
async def extract_pdf(file: UploadFile = File(...)):
    """Simple extract endpoint that returns mock data for testing"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    # For now, return mock data to test the API
    return {
        "transactions": [
            {
                "date": "2024-01-15",
                "description": "Sample Transaction 1",
                "amount": 100.50
            },
            {
                "date": "2024-01-16", 
                "description": "Sample Transaction 2",
                "amount": -25.00
            }
        ],
        "page_count": 1,
        "transaction_count": 2
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
