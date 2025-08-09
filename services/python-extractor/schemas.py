from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

class RawTransaction(BaseModel):
    """Raw transaction extracted from PDF"""
    date: str = Field(..., description="The date of the transaction (YYYY-MM-DD)")
    description: str = Field(..., description="A description of the transaction")
    amount: float = Field(..., description="The amount of the transaction")

class ExtractionResult(BaseModel):
    """Result of PDF extraction"""
    transactions: List[RawTransaction] = Field(..., description="List of extracted transactions")
    page_count: int = Field(..., description="Total number of pages in the document")
    transaction_count: int = Field(..., description="Total number of transactions found")
    
class ExtractionRequest(BaseModel):
    """Request for PDF extraction"""
    file_content: str = Field(..., description="Base64 encoded PDF content")

class ErrorResponse(BaseModel):
    """Error response"""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")