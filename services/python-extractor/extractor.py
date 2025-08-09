import fitz  # PyMuPDF
import base64
import io
import logging
from typing import List, Dict, Any
from schemas import RawTransaction, ExtractionResult
import re
from datetime import datetime

logger = logging.getLogger(__name__)

class PDFExtractor:
    """PDF text extraction using PyMuPDF"""
    
    def extract_text_from_pdf(self, pdf_content: bytes) -> str:
        """Extract text from PDF bytes using PyMuPDF"""
        try:
            # Open PDF from bytes
            pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
            text_content = ""
            
            for page_num in range(pdf_document.page_count):
                page = pdf_document.load_page(page_num)
                text_content += page.get_text()
                
            pdf_document.close()
            return text_content
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            raise ValueError(f"Failed to extract text from PDF: {str(e)}")
    
    def get_page_count(self, pdf_content: bytes) -> int:
        """Get the number of pages in the PDF"""
        try:
            pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
            page_count = pdf_document.page_count
            pdf_document.close()
            return page_count
        except Exception as e:
            logger.error(f"Error getting page count: {str(e)}")
            return 0

class TransactionExtractor:
    """Extract transactions from text using pattern matching and basic NLP"""
    
    def __init__(self):
        # Common date patterns
        self.date_patterns = [
            r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b',  # DD/MM/YYYY or DD-MM-YYYY
            r'\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b',  # YYYY/MM/DD or YYYY-MM-DD
            r'\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\b',  # DD Mon YYYY
        ]
        
        # Money patterns
        self.money_patterns = [
            r'\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # $1,234.56
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\$',  # 1,234.56$
            r'\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b',   # 1,234.56
        ]
    
    def normalize_date(self, date_str: str) -> str:
        """Normalize date to YYYY-MM-DD format"""
        try:
            # Try different date formats
            formats = [
                '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%m-%d-%Y',
                '%Y/%m/%d', '%Y-%m-%d',
                '%d %b %Y', '%d %B %Y'
            ]
            
            for fmt in formats:
                try:
                    date_obj = datetime.strptime(date_str.strip(), fmt)
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue
            
            # If all formats fail, return original
            return date_str.strip()
            
        except Exception:
            return date_str.strip()
    
    def extract_amount(self, text: str) -> float:
        """Extract monetary amount from text"""
        for pattern in self.money_patterns:
            matches = re.findall(pattern, text)
            if matches:
                amount_str = matches[0].replace(',', '').replace('$', '').strip()
                try:
                    return float(amount_str)
                except ValueError:
                    continue
        return 0.0
    
    def extract_transactions_from_text(self, text: str) -> List[RawTransaction]:
        """Extract transactions from text using pattern matching"""
        transactions = []
        lines = text.split('\n')
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            # Look for lines that might contain transactions
            # This is a basic heuristic - could be improved with ML
            
            # Check if line contains a date pattern
            date_match = None
            for pattern in self.date_patterns:
                match = re.search(pattern, line)
                if match:
                    date_match = match.group(1)
                    break
            
            if not date_match:
                continue
                
            # Extract amount from the same line or nearby lines
            amount = self.extract_amount(line)
            if amount == 0.0:
                # Check next few lines for amount
                for j in range(1, min(3, len(lines) - i)):
                    if i + j < len(lines):
                        amount = self.extract_amount(lines[i + j])
                        if amount > 0:
                            break
            
            if amount > 0:
                # Clean description (remove date and amount)
                description = line
                description = re.sub(r'\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?', '', description)
                description = re.sub(r'\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*\$', '', description)
                for pattern in self.date_patterns:
                    description = re.sub(pattern, '', description)
                description = description.strip()
                
                if description:
                    normalized_date = self.normalize_date(date_match)
                    transactions.append(RawTransaction(
                        date=normalized_date,
                        description=description,
                        amount=amount
                    ))
        
        return transactions

class RobustPDFExtractor:
    """Main extractor class that combines PDF text extraction with transaction parsing"""
    
    def __init__(self):
        self.pdf_extractor = PDFExtractor()
        self.transaction_extractor = TransactionExtractor()
    
    def extract_from_base64(self, base64_content: str) -> ExtractionResult:
        """Extract transactions from base64 encoded PDF"""
        try:
            # Decode base64 content
            pdf_content = base64.b64decode(base64_content)
            
            # Extract text and page count
            text_content = self.pdf_extractor.extract_text_from_pdf(pdf_content)
            page_count = self.pdf_extractor.get_page_count(pdf_content)
            
            # Extract transactions
            transactions = self.transaction_extractor.extract_transactions_from_text(text_content)
            
            return ExtractionResult(
                transactions=transactions,
                page_count=page_count,
                transaction_count=len(transactions)
            )
            
        except Exception as e:
            logger.error(f"Error in PDF extraction: {str(e)}")
            raise ValueError(f"Failed to extract data from PDF: {str(e)}")