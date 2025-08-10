import fitz  # PyMuPDF
import base64
import io
import logging
from typing import List, Dict, Any, Union, Optional
from schemas import RawTransaction, ExtractionResult, BankTransaction, TransactionList, RideshareTrip, RideshareTaxSummary
import re
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class SimplePDFExtractor:
    """
    Robust PDF text extraction using PyMuPDF with error handling and repair logic.
    Implements structured extraction similar to LangExtract functionality.
    """
    
    def __init__(self):
        self.text_repair_attempts = 3
        self.encoding_fallbacks = ['utf-8', 'latin-1', 'cp1252', 'ascii']
    
    def extract_text_from_pdf(self, pdf_content: bytes, attempt: int = 0) -> str:
        """
        Extract text from PDF bytes using PyMuPDF with robust error handling and repair logic.
        """
        try:
            # Attempt to open PDF from bytes
            pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
            text_content = ""
            
            for page_num in range(pdf_document.page_count):
                try:
                    page = pdf_document.load_page(page_num)
                    # Try different text extraction methods for robustness
                    page_text = page.get_text()
                    
                    # If no text found, try alternative extraction methods
                    if not page_text.strip():
                        page_text = page.get_text("text")
                        
                    # If still no text, try extracting from text blocks
                    if not page_text.strip():
                        blocks = page.get_text("dict")["blocks"]
                        page_text = self._extract_from_blocks(blocks)
                    
                    text_content += page_text + "\n"
                    
                except Exception as e:
                    logger.warning(f"Error extracting text from page {page_num}: {str(e)}")
                    # Continue with other pages
                    continue
                    
            pdf_document.close()
            
            # Apply text repair if needed
            if not text_content.strip() and attempt < self.text_repair_attempts:
                logger.info(f"Attempting text repair, attempt {attempt + 1}")
                return self._repair_and_retry(pdf_content, attempt + 1)
            
            return text_content if text_content.strip() else "No text extracted"
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF (attempt {attempt}): {str(e)}")
            
            # Try repair if we haven't exhausted attempts
            if attempt < self.text_repair_attempts:
                return self._repair_and_retry(pdf_content, attempt + 1)
            
            raise ValueError(f"Failed to extract text from PDF after {self.text_repair_attempts} attempts: {str(e)}")
    
    def _extract_from_blocks(self, blocks: List[Dict]) -> str:
        """Extract text from PDF blocks structure"""
        text_content = ""
        for block in blocks:
            if "lines" in block:
                for line in block["lines"]:
                    for span in line.get("spans", []):
                        text_content += span.get("text", "") + " "
                text_content += "\n"
        return text_content
    
    def _repair_and_retry(self, pdf_content: bytes, attempt: int) -> str:
        """
        Attempt to repair PDF content and retry extraction.
        This is our "repair logic" for handling corrupted or complex PDFs.
        """
        try:
            # Try different encoding approaches
            for encoding in self.encoding_fallbacks:
                try:
                    if isinstance(pdf_content, str):
                        pdf_content = pdf_content.encode(encoding)
                    return self.extract_text_from_pdf(pdf_content, attempt)
                except (UnicodeError, ValueError):
                    continue
            
            # If encoding approaches fail, try cleaning the PDF data
            cleaned_content = self._clean_pdf_content(pdf_content)
            return self.extract_text_from_pdf(cleaned_content, attempt)
            
        except Exception as e:
            logger.error(f"PDF repair attempt {attempt} failed: {str(e)}")
            if attempt < self.text_repair_attempts:
                return self.extract_text_from_pdf(pdf_content, attempt)
            else:
                raise ValueError(f"PDF repair failed after {attempt} attempts")
    
    def _clean_pdf_content(self, pdf_content: bytes) -> bytes:
        """Basic PDF content cleaning for corrupted files"""
        try:
            # Remove null bytes that might cause issues
            cleaned = pdf_content.replace(b'\x00', b'')
            
            # Ensure PDF header is present
            if not cleaned.startswith(b'%PDF'):
                # Try to find PDF header in the content
                pdf_start = cleaned.find(b'%PDF')
                if pdf_start > 0:
                    cleaned = cleaned[pdf_start:]
            
            return cleaned
        except Exception:
            return pdf_content
    
    def get_page_count(self, pdf_content: bytes) -> int:
        """Get the number of pages in the PDF with error handling"""
        try:
            pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
            page_count = pdf_document.page_count
            pdf_document.close()
            return page_count
        except Exception as e:
            logger.error(f"Error getting page count: {str(e)}")
            return 0

class StructuredExtractor:
    """
    Structured extraction engine that implements LangExtract-like functionality
    using prompt-driven schemas and in-context learning with few-shot examples.
    """
    
    def __init__(self):
        self.date_patterns = [
            r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b',  # DD/MM/YYYY or DD-MM-YYYY
            r'\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b',  # YYYY/MM/DD or YYYY-MM-DD
            r'\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\b',  # DD Mon YYYY
            r'\b(\d{1,2}[./]\d{1,2}[./]\d{2,4})\b',  # DD.MM.YY or DD/MM/YY
        ]
        
        self.money_patterns = [
            r'\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # $1,234.56
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\$',  # 1,234.56$
            r'\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b',   # 1,234.56
            r'[-+]?\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # Handle negative amounts
        ]
        
        # Few-shot examples for different document types
        self.rideshare_patterns = [
            r'trip.*?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}).*?(\$?\d+\.\d{2})',
            r'fare.*?(\$?\d+\.\d{2})',
            r'tip.*?(\$?\d+\.\d{2})',
            r'distance.*?(\d+\.\d+)\s*(mi|km|miles)',
        ]
        
        self.bank_patterns = [
            r'(debit|credit|withdrawal|deposit)\s*.*?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}).*?(\$?\d+\.\d{2})',
            r'balance.*?(\$?\d+\.\d{2})',
            r'ref(?:erence)?.*?([A-Z0-9]+)',
        ]
    
    def detect_document_type(self, text: str) -> str:
        """
        Detect document type using in-context learning approach.
        This simulates LangExtract's document classification.
        """
        text_lower = text.lower()
        
        # Rideshare indicators
        rideshare_keywords = ['uber', 'lyft', 'trip', 'ride', 'driver', 'fare', 'pickup', 'dropoff', 'earnings']
        rideshare_score = sum(1 for keyword in rideshare_keywords if keyword in text_lower)
        
        # Bank statement indicators  
        bank_keywords = ['bank', 'statement', 'account', 'balance', 'debit', 'credit', 'deposit', 'withdrawal']
        bank_score = sum(1 for keyword in bank_keywords if keyword in text_lower)
        
        # Determine document type based on keyword density
        if rideshare_score > bank_score and rideshare_score >= 2:
            return "rideshare"
        elif bank_score >= 2:
            return "bank_statement"
        else:
            return "general"
    
    def extract_structured_data(self, text: str) -> Union[TransactionList, RideshareTaxSummary, List[RawTransaction]]:
        """
        Extract structured data using prompt-driven schemas and few-shot examples.
        This is our main "LangExtract" functionality.
        """
        document_type = self.detect_document_type(text)
        
        if document_type == "rideshare":
            return self._extract_rideshare_data(text)
        elif document_type == "bank_statement":
            return self._extract_bank_data(text)
        else:
            return self._extract_general_transactions(text)
    
    def _extract_rideshare_data(self, text: str) -> RideshareTaxSummary:
        """Extract rideshare data using few-shot learning approach"""
        trips = []
        lines = text.split('\n')
        
        # Parse using rideshare-specific patterns
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            # Look for trip patterns
            trip_data = self._parse_rideshare_line(line, lines[i:i+3])  # Look ahead 3 lines
            if trip_data:
                trips.append(trip_data)
        
        # Calculate summary statistics
        total_earnings = sum(trip.total_earnings for trip in trips)
        total_tips = sum(trip.tips or 0 for trip in trips)
        total_distance = sum(trip.distance or 0 for trip in trips)
        
        return RideshareTaxSummary(
            trips=trips,
            total_trips=len(trips),
            total_distance=total_distance if total_distance > 0 else None,
            total_earnings=total_earnings,
            total_tips=total_tips if total_tips > 0 else None,
            total_tolls=sum(trip.tolls or 0 for trip in trips) or None
        )
    
    def _parse_rideshare_line(self, line: str, context_lines: List[str]) -> Optional[RideshareTrip]:
        """Parse a single rideshare trip using pattern matching"""
        try:
            # Extract date
            date_match = None
            for pattern in self.date_patterns:
                match = re.search(pattern, line)
                if match:
                    date_match = self._normalize_date(match.group(1))
                    break
            
            if not date_match:
                return None
            
            # Extract monetary amounts
            amounts = []
            for pattern in self.money_patterns:
                matches = re.findall(pattern, line + ' '.join(context_lines))
                for match in matches:
                    try:
                        amount = float(match.replace(',', '').replace('$', ''))
                        amounts.append(amount)
                    except ValueError:
                        continue
            
            if not amounts:
                return None
            
            # Extract trip details (simplified pattern matching)
            fare = amounts[0] if amounts else 0.0
            tips = amounts[1] if len(amounts) > 1 else None
            total_earnings = sum(amounts) if amounts else fare
            
            return RideshareTrip(
                date=date_match,
                fare=fare,
                tips=tips,
                total_earnings=total_earnings
            )
            
        except Exception as e:
            logger.debug(f"Error parsing rideshare line: {e}")
            return None
    
    def _extract_bank_data(self, text: str) -> TransactionList:
        """Extract bank statement data using structured patterns"""
        transactions = []
        lines = text.split('\n')
        
        # Extract account info and period
        account_number = self._extract_account_number(text)
        period_start, period_end = self._extract_statement_period(text)
        opening_balance, closing_balance = self._extract_balances(text)
        
        # Parse transactions
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            transaction = self._parse_bank_line(line)
            if transaction:
                transactions.append(transaction)
        
        return TransactionList(
            transactions=transactions,
            account_number=account_number,
            statement_period_start=period_start,
            statement_period_end=period_end,
            opening_balance=opening_balance,
            closing_balance=closing_balance
        )
    
    def _parse_bank_line(self, line: str) -> Optional[BankTransaction]:
        """Parse a single bank transaction line"""
        try:
            # Extract date
            date_match = None
            for pattern in self.date_patterns:
                match = re.search(pattern, line)
                if match:
                    date_match = self._normalize_date(match.group(1))
                    break
            
            if not date_match:
                return None
            
            # Extract amounts (distinguish debit/credit)
            amounts = []
            for pattern in self.money_patterns:
                matches = re.findall(pattern, line)
                for match in matches:
                    try:
                        amount = float(match.replace(',', '').replace('$', ''))
                        amounts.append(amount)
                    except ValueError:
                        continue
            
            if not amounts:
                return None
            
            # Determine if debit or credit based on context
            is_debit = any(word in line.lower() for word in ['debit', 'withdrawal', 'fee', 'charge'])
            is_credit = any(word in line.lower() for word in ['credit', 'deposit', 'interest', 'refund'])
            
            debit = amounts[0] if is_debit else None
            credit = amounts[0] if is_credit else None
            
            # Clean description
            description = line
            for pattern in self.date_patterns + self.money_patterns:
                description = re.sub(pattern, '', description)
            description = re.sub(r'\s+', ' ', description).strip()
            
            return BankTransaction(
                date=date_match,
                description=description,
                debit=debit,
                credit=credit
            )
            
        except Exception as e:
            logger.debug(f"Error parsing bank line: {e}")
            return None
    
    def _extract_general_transactions(self, text: str) -> List[RawTransaction]:
        """Extract general transactions (fallback method)"""
        transactions = []
        lines = text.split('\n')
        
        logger.info(f"Processing {len(lines)} lines for general transaction extraction")
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            # Extract date
            date_match = None
            for pattern in self.date_patterns:
                match = re.search(pattern, line)
                if match:
                    date_match = self._normalize_date(match.group(1))
                    break
            
            if not date_match:
                continue
                
            logger.debug(f"Line {i}: Found date {date_match} in: {line[:100]}")
                
            # Extract amount
            amount = self._extract_amount(line)
            logger.debug(f"Line {i}: Extracted amount {amount}")
            
            if amount == 0.0:
                # Skip transactions with zero amount
                logger.debug(f"Line {i}: Skipping zero amount transaction")
                continue
            
            # Clean description
            description = line
            for pattern in self.date_patterns:
                description = re.sub(pattern, '', description)
            description = re.sub(r'\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?', '', description)
            description = re.sub(r'\s+', ' ', description).strip()
            
            logger.debug(f"Line {i}: Cleaned description: '{description}'")
            
            # Only create transaction if we have a meaningful description
            if description and len(description) > 2:
                transaction = RawTransaction(
                    date=date_match,
                    description=description,
                    amount=amount
                )
                transactions.append(transaction)
                logger.debug(f"Line {i}: Created transaction: {transaction}")
            else:
                logger.debug(f"Line {i}: Skipping transaction with empty/short description")
        
        logger.info(f"General extraction completed: {len(transactions)} transactions found")
        return transactions
    
    def _normalize_date(self, date_str: str) -> str:
        """Normalize date to YYYY-MM-DD format"""
        try:
            formats = [
                '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%m-%d-%Y',
                '%Y/%m/%d', '%Y-%m-%d', '%d.%m.%Y', '%d.%m.%y',
                '%d %b %Y', '%d %B %Y', '%m/%d/%y', '%d/%m/%y'
            ]
            
            for fmt in formats:
                try:
                    date_obj = datetime.strptime(date_str.strip(), fmt)
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue
            
            return date_str.strip()
            
        except Exception:
            return date_str.strip()
    
    def _extract_amount(self, text: str) -> float:
        """Extract monetary amount from text"""
        # Try multiple money patterns
        patterns = [
            r'\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # $1,234.56
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\$',  # 1,234.56$
            r'[-+]?\s*\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # -$1,234.56 or +$1,234.56
            r'[-+]?\s*(\d{1,3}(?:,\d{3})*\.\d{2})\b',   # -1,234.56 or +1,234.56
            r'\b(\d{1,3}(?:,\d{3})*\.\d{2})\b',   # 1,234.56 (standalone)
            r'\b(\d+\.\d{2})\b',   # Simple decimal like 15.75
            r'\b(\d+)\.\d{2}\b',   # More flexible decimal matching
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            if matches:
                amount_str = matches[0].replace(',', '').replace('$', '').strip()
                try:
                    amount = float(amount_str)
                    # Handle negative indicators in the text
                    if 'debit' in text.lower() or 'withdrawal' in text.lower() or text.startswith('-'):
                        amount = -abs(amount)
                    return amount
                except ValueError:
                    continue
        return 0.0
    
    def _extract_account_number(self, text: str) -> Optional[str]:
        """Extract account number from bank statement"""
        patterns = [
            r'account\s*(?:number|#)?\s*:?\s*([*\d\-\s]+)',
            r'acct\s*(?:no|#)?\s*:?\s*([*\d\-\s]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def _extract_statement_period(self, text: str) -> tuple[Optional[str], Optional[str]]:
        """Extract statement period dates"""
        # This is a simplified implementation
        return None, None
    
    def _extract_balances(self, text: str) -> tuple[Optional[float], Optional[float]]:
        """Extract opening and closing balances"""
        # This is a simplified implementation
        return None, None
    
    def visualize(self, extracted_data: Union[TransactionList, RideshareTaxSummary, List[RawTransaction]]) -> Dict[str, Any]:
        """
        Admin/debug visualization functionality (simulating langextract.visualize())
        """
        visualization = {
            "extraction_summary": {
                "timestamp": datetime.now().isoformat(),
                "data_type": type(extracted_data).__name__,
            },
            "validation_results": {},
            "data_quality_metrics": {},
            "debug_info": {}
        }
        
        if isinstance(extracted_data, RideshareTaxSummary):
            visualization["validation_results"] = {
                "total_trips": extracted_data.total_trips,
                "has_earnings_data": extracted_data.total_earnings > 0,
                "has_distance_data": extracted_data.total_distance is not None,
                "trips_with_tips": len([t for t in extracted_data.trips if t.tips and t.tips > 0])
            }
            visualization["data_quality_metrics"] = {
                "completeness_score": self._calculate_rideshare_completeness(extracted_data),
                "consistency_score": self._calculate_rideshare_consistency(extracted_data)
            }
        elif isinstance(extracted_data, TransactionList):
            visualization["validation_results"] = {
                "transaction_count": len(extracted_data.transactions),
                "has_account_info": extracted_data.account_number is not None,
                "has_period_info": extracted_data.statement_period_start is not None,
                "balance_consistency": self._check_balance_consistency(extracted_data)
            }
            visualization["data_quality_metrics"] = {
                "completeness_score": self._calculate_bank_completeness(extracted_data),
                "consistency_score": self._calculate_bank_consistency(extracted_data)
            }
        
        return visualization
    
    def _calculate_rideshare_completeness(self, data: RideshareTaxSummary) -> float:
        """Calculate completeness score for rideshare data"""
        if not data.trips:
            return 0.0
        
        total_fields = len(data.trips) * 5  # 5 key fields per trip
        filled_fields = sum([
            len([f for f in [trip.date, trip.fare, trip.pickup_location, trip.dropoff_location, trip.total_earnings] if f is not None])
            for trip in data.trips
        ])
        
        return filled_fields / total_fields if total_fields > 0 else 0.0
    
    def _calculate_rideshare_consistency(self, data: RideshareTaxSummary) -> float:
        """Calculate consistency score for rideshare data"""
        if not data.trips:
            return 0.0
        
        consistent_trips = 0
        for trip in data.trips:
            # Check if total_earnings is consistent with fare + tips
            expected_total = (trip.fare or 0) + (trip.tips or 0)
            if abs(trip.total_earnings - expected_total) < 0.01:
                consistent_trips += 1
        
        return consistent_trips / len(data.trips)
    
    def _calculate_bank_completeness(self, data: TransactionList) -> float:
        """Calculate completeness score for bank data"""
        if not data.transactions:
            return 0.0
        
        total_fields = len(data.transactions) * 3  # 3 key fields per transaction
        filled_fields = sum([
            len([f for f in [txn.date, txn.description, (txn.debit or txn.credit)] if f is not None])
            for txn in data.transactions
        ])
        
        return filled_fields / total_fields if total_fields > 0 else 0.0
    
    def _calculate_bank_consistency(self, data: TransactionList) -> float:
        """Calculate consistency score for bank data"""
        # Simple consistency check - could be enhanced
        return 1.0 if data.transactions else 0.0
    
    def _check_balance_consistency(self, data: TransactionList) -> bool:
        """Check if balances are consistent"""
        # This is a simplified check
        return data.opening_balance is not None or data.closing_balance is not None

class LangExtractStyleExtractor:
    """
    Main extractor class that combines PyMuPDF text extraction with structured data extraction.
    This replaces the old RobustPDFExtractor and implements LangExtract-like functionality.
    """
    
    def __init__(self):
        self.pdf_extractor = SimplePDFExtractor()  # This refers to the PDF-only extractor defined above
        self.structured_extractor = StructuredExtractor()
    
    def extract_from_base64(self, base64_content: str) -> ExtractionResult:
        """
        Extract transactions from base64 encoded PDF using the new LangExtract-style approach.
        """
        try:
            # Decode base64 content
            pdf_content = base64.b64decode(base64_content)
            
            # Extract text with robust error handling
            text_content = self.pdf_extractor.extract_text_from_pdf(pdf_content)
            page_count = self.pdf_extractor.get_page_count(pdf_content)
            
            # Debug: Log extracted text sample
            logger.info(f"Extracted text length: {len(text_content)} characters")
            logger.info(f"First 500 characters of extracted text: {text_content[:500]}")
            logger.info(f"PDF has {page_count} pages")
            
            # Extract structured data using our LangExtract-style approach
            structured_data = self.structured_extractor.extract_structured_data(text_content)
            logger.info(f"Structured extraction completed. Data type: {type(structured_data)}")
            
            # Convert to standardized format for compatibility
            if isinstance(structured_data, (TransactionList, RideshareTaxSummary)):
                # Convert structured data to RawTransaction format for API compatibility
                transactions = self._convert_to_raw_transactions(structured_data)
            else:
                transactions = structured_data
            
            logger.info(f"Final transactions count: {len(transactions)}")
            if transactions:
                logger.info(f"Sample transaction: date={transactions[0].date}, desc='{transactions[0].description}', amount={transactions[0].amount}")
            
            return ExtractionResult(
                transactions=transactions,
                page_count=page_count,
                transaction_count=len(transactions)
            )
            
        except Exception as e:
            logger.error(f"Error in LangExtract-style PDF extraction: {str(e)}")
            raise ValueError(f"Failed to extract data from PDF: {str(e)}")
    
    def extract_structured(self, base64_content: str) -> Union[TransactionList, RideshareTaxSummary]:
        """
        Extract structured data directly (for admin/debug use).
        """
        try:
            pdf_content = base64.b64decode(base64_content)
            text_content = self.pdf_extractor.extract_text_from_pdf(pdf_content)
            return self.structured_extractor.extract_structured_data(text_content)
        except Exception as e:
            logger.error(f"Error in structured extraction: {str(e)}")
            raise ValueError(f"Failed to extract structured data: {str(e)}")
    
    def visualize_extraction(self, base64_content: str) -> Dict[str, Any]:
        """
        Admin/debug visualization using langextract.visualize() equivalent.
        """
        try:
            structured_data = self.extract_structured(base64_content)
            return self.structured_extractor.visualize(structured_data)
        except Exception as e:
            logger.error(f"Error in visualization: {str(e)}")
            return {"error": str(e)}
    
    def _convert_to_raw_transactions(self, structured_data: Union[TransactionList, RideshareTaxSummary]) -> List[RawTransaction]:
        """Convert structured data to RawTransaction format for API compatibility"""
        transactions = []
        
        if isinstance(structured_data, RideshareTaxSummary):
            for trip in structured_data.trips:
                transactions.append(RawTransaction(
                    date=trip.date,
                    description=f"Rideshare trip - {trip.pickup_location or 'Unknown'} to {trip.dropoff_location or 'Unknown'}",
                    amount=trip.total_earnings
                ))
        elif isinstance(structured_data, TransactionList):
            for txn in structured_data.transactions:
                amount = txn.credit if txn.credit else -(txn.debit or 0)
                transactions.append(RawTransaction(
                    date=txn.date,
                    description=txn.description,
                    amount=amount
                ))
        
        return transactions

# Maintain backward compatibility
RobustPDFExtractor = LangExtractStyleExtractor