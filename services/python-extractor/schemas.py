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

# New schemas for specific document types as required by the problem statement

class BankTransaction(BaseModel):
    """Bank transaction with standardized fields for financial analysis"""
    date: str = Field(..., description="Transaction date in YYYY-MM-DD format")
    description: str = Field(..., description="Transaction description")
    debit: Optional[float] = Field(None, description="Debit amount (money out)")
    credit: Optional[float] = Field(None, description="Credit amount (money in)")
    balance: Optional[float] = Field(None, description="Account balance after transaction")
    reference: Optional[str] = Field(None, description="Reference number or transaction ID")
    category: Optional[str] = Field(None, description="Categorized type of transaction")

class TransactionList(BaseModel):
    """List of bank transactions with metadata"""
    transactions: List[BankTransaction] = Field(..., description="List of bank transactions")
    account_number: Optional[str] = Field(None, description="Account number (partially masked)")
    statement_period_start: Optional[str] = Field(None, description="Statement period start date")
    statement_period_end: Optional[str] = Field(None, description="Statement period end date")
    opening_balance: Optional[float] = Field(None, description="Opening balance for the period")
    closing_balance: Optional[float] = Field(None, description="Closing balance for the period")

class RideshareTrip(BaseModel):
    """Individual rideshare trip details"""
    date: str = Field(..., description="Trip date in YYYY-MM-DD format")
    time: Optional[str] = Field(None, description="Trip time")
    pickup_location: Optional[str] = Field(None, description="Pickup location")
    dropoff_location: Optional[str] = Field(None, description="Drop-off location")
    distance: Optional[float] = Field(None, description="Trip distance in miles/km")
    duration: Optional[str] = Field(None, description="Trip duration")
    fare: float = Field(..., description="Base fare amount")
    tips: Optional[float] = Field(None, description="Tips received")
    tolls: Optional[float] = Field(None, description="Tolls paid")
    total_earnings: float = Field(..., description="Total earnings for the trip")

class RideshareTaxSummary(BaseModel):
    """Tax summary for rideshare activities"""
    trips: List[RideshareTrip] = Field(..., description="List of individual trips")
    summary_period_start: Optional[str] = Field(None, description="Summary period start date")
    summary_period_end: Optional[str] = Field(None, description="Summary period end date")
    total_trips: int = Field(..., description="Total number of trips")
    total_distance: Optional[float] = Field(None, description="Total distance driven")
    total_earnings: float = Field(..., description="Total earnings before expenses")
    total_tips: Optional[float] = Field(None, description="Total tips received")
    total_tolls: Optional[float] = Field(None, description="Total tolls paid")
    vehicle_expenses: Optional[float] = Field(None, description="Vehicle-related expenses")
    deductible_expenses: Optional[float] = Field(None, description="Total deductible expenses")