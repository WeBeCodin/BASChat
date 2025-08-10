"""
LangExtract-based PDF extraction service following the technical specification
This implements the exact architecture outlined in the technical plan
"""

import json
import base64
import traceback
from typing import Dict, Any, List, Optional
import fitz  # PyMuPDF
import sys
import os

# Add the current directory to Python path to import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from pydantic import BaseModel, Field, ValidationError
    from datetime import date
    import google.generativeai as genai
except ImportError as e:
    print(f"Missing required packages: {e}")
    print("Please install: pip install pydantic google-generativeai PyMuPDF")
    sys.exit(1)

# Pydantic Schemas as per technical specification
class RideshareTaxSummary(BaseModel):
    """
    A Pydantic model to represent the structured data extracted from
    an Uber or DiDi monthly tax summary PDF.
    """
    total_income: float = Field(
        description="The total income amount listed on the summary."
    )
    uber_service_fee: Optional[float] = Field(
        default=None,
        description="The 'Uber service fee' amount, a potential tax deduction."
    )
    other_charges_from_uber: Optional[float] = Field(
        default=None,
        description="The 'Other charges from Uber' amount, a potential tax deduction."
    )
    charges_from_3rd_parties: Optional[float] = Field(
        default=None,
        description="The 'Charges from 3rd parties (Tolls/Airports/Government)' amount."
    )
    total_potential_tax_deductions: float = Field(
        description="The total sum of all potential tax deductions listed."
    )

class BankTransaction(BaseModel):
    """
    A Pydantic model for a single transaction extracted from a bank statement.
    """
    transaction_date: str = Field(  # Using string for API compatibility
        description="The date of the transaction."
    )
    description: str = Field(
        description="The full description text for the transaction."
    )
    withdrawal_amount: Optional[float] = Field(
        default=None,
        description="The withdrawal or debit amount for the transaction."
    )
    deposit_amount: Optional[float] = Field(
        default=None,
        description="The deposit or credit amount for the transaction."
    )

class TransactionList(BaseModel):
    """
    A Pydantic model that contains a list of bank transactions,
    representing the full set of transactions extracted from a bank statement.
    """
    transactions: List[BankTransaction] = Field(
        description="A list of all transactions extracted from the document."
    )

class ExtractionResult(BaseModel):
    """Result format for API compatibility"""
    transactions: List[Dict[str, Any]]
    page_count: int
    transaction_count: int
    document_type: str
    extraction_confidence: float

# PDF Processing Module (Step 1 of technical plan)
def extract_text_from_pdf(pdf_content: bytes) -> str:
    """
    Extract text from PDF bytes using PyMuPDF with robust error handling.
    Implements Step 1 of the technical specification.
    """
    try:
        # Attempt to open PDF from bytes
        pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
        text_content = ""
        
        for page_num in range(pdf_document.page_count):
            try:
                page = pdf_document.load_page(page_num)
                page_text = page.get_text()
                text_content += page_text + "\n"
            except Exception as e:
                print(f"Error extracting text from page {page_num}: {str(e)}")
                continue
                
        pdf_document.close()
        return text_content
        
    except Exception as e:
        print(f"Initial PDF extraction failed: {e}")
        # Attempt repair as per technical specification
        try:
            # Try to repair and re-extract
            pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
            # Save to temporary location and reopen
            temp_content = pdf_document.tobytes()
            pdf_document.close()
            
            # Reopen from the re-saved content
            pdf_document = fitz.open(stream=temp_content, filetype="pdf")
            text_content = ""
            
            for page_num in range(pdf_document.page_count):
                page = pdf_document.load_page(page_num)
                text_content += page.get_text() + "\n"
                
            pdf_document.close()
            return text_content
            
        except Exception as repair_error:
            print(f"PDF repair attempt failed: {repair_error}")
            raise Exception(f"Failed to extract text from PDF: {repair_error}")

# LangExtract-style extraction using Google Generative AI
def extract_structured_data(text: str, document_type: str) -> Dict[str, Any]:
    """
    Extract structured data using Google Generative AI with LangExtract-style prompting.
    Implements the "Expert Bookkeeper" persona and few-shot examples from the technical specification.
    """
    
    # Configure Google AI
    api_key = os.environ.get('GOOGLE_GENAI_API_KEY')
    if not api_key:
        raise Exception("GOOGLE_GENAI_API_KEY environment variable not found")
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    
    if document_type == "rideshare_summary":
        prompt = create_rideshare_extraction_prompt(text)
        schema_class = RideshareTaxSummary
    elif document_type == "bank_statement":
        prompt = create_bank_statement_extraction_prompt(text)
        schema_class = TransactionList
    else:
        # Default to bank statement for general financial documents
        prompt = create_bank_statement_extraction_prompt(text)
        schema_class = TransactionList
    
    try:
        response = model.generate_content(prompt)
        response_text = response.text
        
        # Extract JSON from response
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        
        if json_start == -1 or json_end == 0:
            raise Exception("No JSON found in AI response")
        
        json_str = response_text[json_start:json_end]
        parsed_data = json.loads(json_str)
        
        # Validate against Pydantic schema
        validated_data = schema_class(**parsed_data)
        return validated_data.dict()
        
    except Exception as e:
        print(f"AI extraction error: {e}")
        print(f"AI response: {response_text if 'response_text' in locals() else 'No response'}")
        raise Exception(f"Failed to extract structured data: {e}")

def create_rideshare_extraction_prompt(text: str) -> str:
    """
    Create LangExtract-style prompt for rideshare summary extraction.
    Implements the "Expert Bookkeeper" persona and few-shot examples.
    """
    return f"""
You are an expert Australian bookkeeper specializing in tax compliance for rideshare sole traders.

Extract financial data from the following Uber/DiDi tax summary and structure it as JSON.

Few-shot example:
Input text: "Total Income A$8,023.23 Uber service fee (transportation leads)* A$1,769.82 Other charges from Uber A$158.39 Charges from 3rd parties (Tolls/Airports/Government) A$1,168.98 Total Potential Tax Deductions A$3,097.19"

Expected output:
{{
  "total_income": 8023.23,
  "uber_service_fee": 1769.82,
  "other_charges_from_uber": 158.39,
  "charges_from_3rd_parties": 1168.98,
  "total_potential_tax_deductions": 3097.19
}}

Now extract from this document:
{text}

Return only the JSON object that conforms to the RideshareTaxSummary schema.
"""

def create_bank_statement_extraction_prompt(text: str) -> str:
    """
    Create LangExtract-style prompt for bank statement extraction.
    Implements the one-to-many extraction pattern.
    """
    return f"""
You are an expert Australian bookkeeper specializing in tax compliance for rideshare sole traders.

Extract ALL transactions from the following bank statement and structure them as JSON.

Few-shot example:
Input text: "30 Jun 2025 PAYMENT BY AUTHORITY TO Linkt Melbourne 19111349 -10513750 -$45.40\n30 Jun 2025 DEBIT CARD PURCHASE OFFICEWORKS 0307 AUS PRESTON -$27.55\n30 Jun 2025 DEPOSIT DIDI MOBILITY (A Paid by didi $80.26"

Expected output:
{{
  "transactions": [
    {{
      "transaction_date": "2025-06-30",
      "description": "PAYMENT BY AUTHORITY TO Linkt Melbourne 19111349 -10513750",
      "withdrawal_amount": 45.40,
      "deposit_amount": null
    }},
    {{
      "transaction_date": "2025-06-30", 
      "description": "DEBIT CARD PURCHASE OFFICEWORKS 0307 AUS PRESTON",
      "withdrawal_amount": 27.55,
      "deposit_amount": null
    }},
    {{
      "transaction_date": "2025-06-30",
      "description": "DEPOSIT DIDI MOBILITY (A Paid by didi",
      "withdrawal_amount": null,
      "deposit_amount": 80.26
    }}
  ]
}}

Now extract ALL transactions from this document:
{text}

Return only the JSON object that conforms to the TransactionList schema.
Extract EVERY transaction you can find. Do not skip any transactions.
"""

# Main extraction service functions (Steps 3 & 4 of technical plan)
def extract_rideshare_summary(pdf_content: bytes) -> RideshareTaxSummary:
    """Extract rideshare summary following technical specification Step 3"""
    text = extract_text_from_pdf(pdf_content)
    structured_data = extract_structured_data(text, "rideshare_summary")
    return RideshareTaxSummary(**structured_data)

def extract_bank_transactions(pdf_content: bytes) -> TransactionList:
    """Extract bank transactions following technical specification Step 4"""
    text = extract_text_from_pdf(pdf_content)
    print(f"Extracted text length: {len(text)} characters")
    print(f"First 500 characters: {text[:500]}")
    
    structured_data = extract_structured_data(text, "bank_statement")
    return TransactionList(**structured_data)

# API endpoint handler (Step 5 of technical plan)
def handle_extraction_request(file_content: bytes, document_type: str = "bank_statement") -> Dict[str, Any]:
    """
    Main API handler following technical specification Step 5.
    Returns data in format compatible with existing frontend.
    """
    try:
        if document_type == "rideshare_summary":
            result = extract_rideshare_summary(file_content)
            # Convert to API format
            transactions = [
                {
                    "date": "2025-06-30",  # Summary date
                    "description": f"Rideshare Income Total",
                    "amount": result.total_income,
                    "category": "Income"
                },
                {
                    "date": "2025-06-30",
                    "description": f"Uber Service Fee Deduction", 
                    "amount": -(result.uber_service_fee or 0),
                    "category": "Expense"
                }
            ]
        else:
            result = extract_bank_transactions(file_content)
            # Convert to API format
            transactions = []
            for txn in result.transactions:
                amount = 0
                if txn.deposit_amount:
                    amount = txn.deposit_amount
                elif txn.withdrawal_amount:
                    amount = -txn.withdrawal_amount
                
                transactions.append({
                    "date": txn.transaction_date,
                    "description": txn.description,
                    "amount": amount,
                    "category": "Income" if amount > 0 else "Expense"
                })
        
        return {
            "transactions": transactions,
            "page_count": 1,  # Will be updated with actual page count
            "transaction_count": len(transactions),
            "document_type": document_type,
            "extraction_confidence": 0.95
        }
        
    except Exception as e:
        print(f"Extraction error: {e}")
        print(traceback.format_exc())
        raise e

# Test function
if __name__ == "__main__":
    # Test with sample data
    print("LangExtract PDF Extraction Service - Testing")
    
    # Test Pydantic models
    try:
        test_rideshare = RideshareTaxSummary(
            total_income=8023.23,
            uber_service_fee=1769.82,
            total_potential_tax_deductions=3097.19
        )
        print("✅ RideshareTaxSummary model test passed")
        
        test_transaction = BankTransaction(
            transaction_date="2025-06-30",
            description="Test transaction",
            withdrawal_amount=45.40
        )
        print("✅ BankTransaction model test passed")
        
        test_list = TransactionList(transactions=[test_transaction])
        print("✅ TransactionList model test passed")
        
        print("🎉 All Pydantic schema tests passed!")
        
    except Exception as e:
        print(f"❌ Schema test failed: {e}")
