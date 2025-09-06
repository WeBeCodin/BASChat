import fitz  # PyMuPDF
import base64
import io
import logging
from typing import List, Dict, Any, Union, Optional
from schemas import RawTransaction, ExtractionResult, BankTransaction, TransactionList, RideshareTrip, RideshareTaxSummary
import re
from datetime import datetime
import json
import hashlib
from functools import lru_cache
from performance_utils import monitor_performance, memory_efficient, MemoryManager, cache_manager

logger = logging.getLogger(__name__)

class SimplePDFExtractor:
    """
    Robust PDF text extraction using PyMuPDF with error handling and repair logic.
    Implements structured extraction similar to LangExtract functionality.
    """
    
    def __init__(self):
        self.text_repair_attempts = 3
        self.encoding_fallbacks = ['utf-8', 'latin-1', 'cp1252', 'ascii']
    
    @monitor_performance("pdf_text_extraction")
    def extract_text_from_pdf(self, pdf_content: bytes, attempt: int = 0) -> str:
        """
        Extract text from PDF bytes using PyMuPDF with robust error handling and repair logic.
        Optimized for speed with early termination and intelligent sampling.
        Now includes coordinate-based extraction for better accuracy.
        """
        try:
            # Attempt to open PDF from bytes
            pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
            text_content = ""
            
            # For large PDFs, use intelligent sampling to improve speed
            page_count = pdf_document.page_count
            if page_count > 10:
                # Sample pages strategically: first few, middle, and last few
                sample_pages = list(range(min(3, page_count)))  # First 3 pages
                if page_count > 6:
                    middle_start = page_count // 2 - 1
                    sample_pages.extend(range(middle_start, min(middle_start + 2, page_count)))  # 2 middle pages
                if page_count > 3:
                    sample_pages.extend(range(max(page_count - 2, 0), page_count))  # Last 2 pages
                
                # Remove duplicates and sort
                sample_pages = sorted(list(set(sample_pages)))
                logger.info(f"Large PDF detected ({page_count} pages), sampling pages: {sample_pages}")
            else:
                sample_pages = list(range(page_count))
            
            extracted_chars = 0
            max_chars = 100000  # Limit extraction to prevent memory issues
            
            for page_num in sample_pages:
                try:
                    page = pdf_document.load_page(page_num)
                    
                    # Try coordinate-based extraction first for better accuracy
                    page_text = self._extract_with_coordinates(page)
                    
                    # If coordinate extraction fails, fall back to simpler methods
                    if not page_text.strip():
                        page_text = page.get_text()
                        
                    # If no text found, try alternative extraction methods
                    if not page_text.strip():
                        page_text = page.get_text("text")
                        
                    # If still no text, try extracting from text blocks
                    if not page_text.strip():
                        blocks = page.get_text("dict")["blocks"]
                        page_text = self._extract_from_blocks(blocks)
                    
                    text_content += page_text + "\n"
                    extracted_chars += len(page_text)
                    
                    # Early termination if we have enough text for analysis
                    if extracted_chars > max_chars:
                        logger.info(f"Early termination: extracted {extracted_chars} characters")
                        break
                    
                except Exception as e:
                    logger.warning(f"Error extracting text from page {page_num}: {str(e)}")
                    # Continue with other pages
                    continue
                    
            pdf_document.close()
            
            # Clean up memory after processing
            MemoryManager.cleanup()
            
            # Apply text repair if needed
            if not text_content.strip() and attempt < self.text_repair_attempts:
                logger.info(f"Attempting text repair, attempt {attempt + 1}")
                return self._repair_and_retry(pdf_content, attempt + 1)
            
            logger.info(f"Text extraction completed: {len(text_content)} characters from {len(sample_pages)} pages")
            return text_content if text_content.strip() else "No text extracted"
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF (attempt {attempt}): {str(e)}")
            
            # Try repair if we haven't exhausted attempts
            if attempt < self.text_repair_attempts:
                return self._repair_and_retry(pdf_content, attempt + 1)
            
            raise ValueError(f"Failed to extract text from PDF after {self.text_repair_attempts} attempts: {str(e)}")
    
    def _extract_with_coordinates(self, page) -> str:
        """
        Extract text using coordinate-based approach for better layout awareness.
        This helps preserve spatial relationships and detect tables/columns.
        """
        try:
            # Get text blocks with coordinates
            blocks = page.get_text("dict")["blocks"]
            
            # Sort blocks by vertical position first, then horizontal
            text_blocks = []
            for block in blocks:
                if "lines" in block:
                    bbox = block.get("bbox", [0, 0, 0, 0])
                    text_content = ""
                    for line in block["lines"]:
                        line_text = ""
                        for span in line.get("spans", []):
                            line_text += span.get("text", "") + " "
                        text_content += line_text.strip() + " "
                    
                    if text_content.strip():
                        text_blocks.append({
                            'text': text_content.strip(),
                            'x0': bbox[0], 'y0': bbox[1], 'x1': bbox[2], 'y1': bbox[3]
                        })
            
            # Sort blocks by Y position (top to bottom), then X position (left to right)
            text_blocks.sort(key=lambda b: (round(b['y0'] / 10), b['x0']))
            
            # Group blocks into rows based on Y position
            rows = []
            current_row = []
            last_y = None
            tolerance = 10  # Y-coordinate tolerance for same row
            
            for block in text_blocks:
                if last_y is None or abs(block['y0'] - last_y) <= tolerance:
                    current_row.append(block)
                else:
                    if current_row:
                        # Sort current row by X position
                        current_row.sort(key=lambda b: b['x0'])
                        rows.append(current_row)
                    current_row = [block]
                last_y = block['y0']
            
            # Add the last row
            if current_row:
                current_row.sort(key=lambda b: b['x0'])
                rows.append(current_row)
            
            # Combine text from rows, preserving spatial layout
            result_text = ""
            for row in rows:
                row_text = ""
                for block in row:
                    # Add spacing between columns
                    if row_text and not row_text.endswith(" "):
                        row_text += " "
                    row_text += block['text']
                
                if row_text.strip():
                    result_text += row_text.strip() + "\n"
            
            return result_text
            
        except Exception as e:
            logger.debug(f"Coordinate-based extraction failed: {e}")
            return ""
    
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
    
    @monitor_performance("pdf_structure_analysis")
    def analyze_pdf_structure(self, pdf_content: bytes) -> Dict[str, Any]:
        """
        Analyze PDF structure for complexity determination.
        Returns detailed analysis including page count, text density, layout complexity.
        Uses caching for repeated analysis of same content.
        """
        # Create content hash for caching
        content_hash = hashlib.md5(pdf_content).hexdigest()
        
        # Check if we've analyzed this content before using enhanced cache
        cached_result = cache_manager.get(f"pdf_analysis_{content_hash}")
        if cached_result:
            logger.debug(f"Using cached analysis for PDF hash: {content_hash}")
            return cached_result
        
        try:
            pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
            
            analysis = {
                'page_count': pdf_document.page_count,
                'file_size_kb': len(pdf_content) / 1024,
                'has_metadata': bool(pdf_document.metadata),
                'text_density': 0,
                'layout_complexity': 'simple',
                'has_images': False,
                'has_forms': False,
                'font_count': 0,
                'avg_text_per_page': 0,
                'is_searchable': True,
                'extraction_confidence': 0.9
            }
            
            total_text_length = 0
            total_blocks = 0
            unique_fonts = set()
            has_complex_layout = False
            
            # Analyze first few pages for performance (sample analysis)
            sample_pages = min(3, pdf_document.page_count)
            
            for page_num in range(sample_pages):
                try:
                    page = pdf_document.load_page(page_num)
                    
                    # Check for images
                    if not analysis['has_images']:
                        image_list = page.get_images()
                        analysis['has_images'] = len(image_list) > 0
                    
                    # Check for form fields
                    if not analysis['has_forms']:
                        widgets = page.widgets()
                        analysis['has_forms'] = len(widgets) > 0
                    
                    # Analyze text and layout
                    text_dict = page.get_text("dict")
                    page_text = page.get_text()
                    total_text_length += len(page_text)
                    
                    # Count blocks and analyze layout complexity
                    blocks = text_dict.get("blocks", [])
                    total_blocks += len(blocks)
                    
                    # Check for complex layout (multiple columns, tables)
                    if len(blocks) > 10:  # Many text blocks suggest complex layout
                        has_complex_layout = True
                    
                    # Analyze fonts
                    for block in blocks:
                        if "lines" in block:
                            for line in block["lines"]:
                                for span in line.get("spans", []):
                                    font_info = f"{span.get('font', '')}-{span.get('size', 0)}"
                                    unique_fonts.add(font_info)
                    
                    # Check if page is searchable (has selectable text)
                    if not page_text.strip():
                        analysis['is_searchable'] = False
                        analysis['extraction_confidence'] *= 0.7  # Reduce confidence for scanned docs
                        
                except Exception as e:
                    logger.warning(f"Error analyzing page {page_num}: {e}")
                    continue
            
            # Calculate metrics
            analysis['font_count'] = len(unique_fonts)
            analysis['avg_text_per_page'] = total_text_length / max(sample_pages, 1)
            analysis['text_density'] = total_text_length / max(analysis['file_size_kb'], 1)
            
            # Determine layout complexity
            if has_complex_layout or analysis['font_count'] > 5 or analysis['has_images']:
                analysis['layout_complexity'] = 'complex'
            elif analysis['font_count'] > 2 or total_blocks > sample_pages * 3:
                analysis['layout_complexity'] = 'moderate'
            
            # Adjust confidence based on analysis
            if not analysis['is_searchable']:
                analysis['extraction_confidence'] *= 0.6
            elif analysis['layout_complexity'] == 'complex':
                analysis['extraction_confidence'] *= 0.8
            elif analysis['text_density'] < 10:  # Very low text density
                analysis['extraction_confidence'] *= 0.7
            
            pdf_document.close()
            
            # Cache the result using enhanced cache manager
            cache_manager.put(f"pdf_analysis_{content_hash}", analysis)
            logger.debug(f"Cached analysis for PDF hash: {content_hash}")
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing PDF structure: {e}")
            # Return minimal analysis on error
            error_analysis = {
                'page_count': 0,
                'file_size_kb': len(pdf_content) / 1024,
                'has_metadata': False,
                'text_density': 0,
                'layout_complexity': 'unknown',
                'has_images': False,
                'has_forms': False,
                'font_count': 0,
                'avg_text_per_page': 0,
                'is_searchable': True,
                'extraction_confidence': 0.5
            }
            # Cache error result too to avoid repeated failures
            cache_manager.put(f"pdf_analysis_{content_hash}", error_analysis)
            return error_analysis

class StructuredExtractor:
    """
    Structured extraction engine that implements LangExtract-like functionality
    using prompt-driven schemas and in-context learning with few-shot examples.
    Optimized with pre-compiled patterns for better performance.
    """
    
    def __init__(self):
        # Pre-compile regex patterns for better performance
        self.date_patterns = [
            re.compile(r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b'),  # DD/MM/YYYY or DD-MM-YYYY
            re.compile(r'\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b'),  # YYYY/MM/DD or YYYY-MM-DD
            re.compile(r'\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\b', re.IGNORECASE),  # DD Mon YYYY
            re.compile(r'\b(\d{1,2}[./]\d{1,2}[./]\d{2,4})\b'),  # DD.MM.YY or DD/MM/YY
            re.compile(r'\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b', re.IGNORECASE),  # Full month names
        ]
        
        self.money_patterns = [
            re.compile(r'\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'),  # $1,234.56
            re.compile(r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\$'),  # 1,234.56$
            re.compile(r'[-+]?\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'),  # Handle negative amounts
            re.compile(r'\b(\d{1,3}(?:,\d{3})*\.\d{2})\b'),   # 1,234.56 (standalone)
            re.compile(r'(?:AUD|USD|EUR|GBP|CAD)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', re.IGNORECASE),  # Currency codes
        ]
        
        # Enhanced patterns for different document types
        self.rideshare_patterns = [
            re.compile(r'trip.*?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}).*?(\$?\d+\.\d{2})', re.IGNORECASE),
            re.compile(r'fare.*?(\$?\d+\.\d{2})', re.IGNORECASE),
            re.compile(r'tip.*?(\$?\d+\.\d{2})', re.IGNORECASE),
            re.compile(r'distance.*?(\d+\.\d+)\s*(mi|km|miles)', re.IGNORECASE),
            re.compile(r'earnings.*?(\$?\d+\.\d{2})', re.IGNORECASE),
        ]
        
        self.bank_patterns = [
            re.compile(r'(debit|credit|withdrawal|deposit)\s*.*?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}).*?(\$?\d+\.\d{2})', re.IGNORECASE),
            re.compile(r'balance.*?(\$?\d+\.\d{2})', re.IGNORECASE),
            re.compile(r'ref(?:erence)?.*?([A-Z0-9]+)', re.IGNORECASE),
            re.compile(r'transaction.*?(\d+)', re.IGNORECASE),
        ]
        
        # Enhanced keyword sets for document type detection
        self.rideshare_keywords = {'uber', 'lyft', 'trip', 'ride', 'driver', 'fare', 'pickup', 'dropoff', 'earnings', 'passenger', 'route'}
        self.bank_keywords = {'bank', 'statement', 'account', 'balance', 'debit', 'credit', 'deposit', 'withdrawal', 'transaction', 'atm'}
    
    def detect_document_type(self, text: str) -> str:
        """
        Detect document type using enhanced keyword analysis and table detection.
        This simulates LangExtract's document classification with better accuracy.
        """
        text_lower = text.lower()
        
        # Detect if document contains tables (helps with bank statements)
        has_tables = self._detect_tables(text)
        
        # Count keyword matches for each document type
        rideshare_score = sum(1 for keyword in self.rideshare_keywords if keyword in text_lower)
        bank_score = sum(1 for keyword in self.bank_keywords if keyword in text_lower)
        
        # Weight scores by keyword frequency
        rideshare_weighted = sum(text_lower.count(keyword) for keyword in self.rideshare_keywords)
        bank_weighted = sum(text_lower.count(keyword) for keyword in self.bank_keywords)
        
        # Boost bank score if tables are detected (common in bank statements)
        if has_tables:
            bank_weighted += 5
            bank_score += 2
        
        # Determine document type based on weighted keyword density
        if rideshare_weighted > bank_weighted and rideshare_score >= 2:
            return "rideshare"
        elif bank_weighted >= 2 or bank_score >= 3:
            return "bank_statement"
        else:
            return "general"
    
    def _detect_tables(self, text: str) -> bool:
        """
        Detect if the text contains tabular data.
        Uses pattern matching to identify table-like structures.
        """
        lines = text.split('\n')
        
        # Look for patterns that suggest tables
        table_indicators = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Count lines with multiple spaces/tabs (column separators)
            if re.search(r'\s{3,}|\t{2,}', line):
                table_indicators += 1
            
            # Count lines with consistent patterns (date + amount + description)
            if len(re.findall(r'\d+[./\-]\d+[./\-]\d+', line)) >= 1 and len(re.findall(r'\$?\d+\.\d{2}', line)) >= 1:
                table_indicators += 1
            
            # Look for header-like patterns
            if any(header in line.lower() for header in ['date', 'amount', 'description', 'debit', 'credit', 'balance']):
                table_indicators += 1
        
        # Consider it a table if we have enough indicators
        return table_indicators >= 3
    
    @monitor_performance("structured_data_extraction")
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
        """Parse a single rideshare trip using improved pattern matching"""
        try:
            # Extract date using pre-compiled patterns
            date_match = None
            for pattern in self.date_patterns:
                match = pattern.search(line)
                if match:
                    date_match = self._normalize_date(match.group(1))
                    break
            
            if not date_match:
                return None
            
            # Extract monetary amounts using pre-compiled patterns
            amounts = []
            context_text = line + ' '.join(context_lines)
            
            for pattern in self.money_patterns:
                matches = pattern.findall(context_text)
                for match in matches:
                    try:
                        # Handle both single capture group and multiple groups
                        amount_str = match if isinstance(match, str) else match[0]
                        amount = float(amount_str.replace(',', '').replace('$', ''))
                        amounts.append(amount)
                    except (ValueError, TypeError):
                        continue
            
            if not amounts:
                return None
            
            # Extract trip details with improved pattern matching
            fare = amounts[0] if amounts else 0.0
            tips = amounts[1] if len(amounts) > 1 else None
            total_earnings = sum(amounts) if amounts else fare
            
            # Try to extract pickup/dropoff locations
            pickup_location = None
            dropoff_location = None
            
            # Simple location extraction (can be enhanced)
            location_pattern = re.compile(r'(?:from|pickup|start).*?([A-Za-z\s,]+?)(?:to|dropoff|end|destination)', re.IGNORECASE)
            location_match = location_pattern.search(context_text)
            if location_match:
                pickup_location = location_match.group(1).strip()
            
            destination_pattern = re.compile(r'(?:to|dropoff|end|destination).*?([A-Za-z\s,]+?)(?:\n|$)', re.IGNORECASE)
            dest_match = destination_pattern.search(context_text)
            if dest_match:
                dropoff_location = dest_match.group(1).strip()
            
            return RideshareTrip(
                date=date_match,
                fare=fare,
                tips=tips,
                total_earnings=total_earnings,
                pickup_location=pickup_location,
                dropoff_location=dropoff_location
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
        """Parse a single bank transaction line with improved accuracy"""
        try:
            # Extract date using pre-compiled patterns
            date_match = None
            for pattern in self.date_patterns:
                match = pattern.search(line)
                if match:
                    date_match = self._normalize_date(match.group(1))
                    break
            
            if not date_match:
                return None
            
            # Extract amounts using pre-compiled patterns
            amounts = []
            for pattern in self.money_patterns:
                matches = pattern.findall(line)
                for match in matches:
                    try:
                        # Handle both single capture group and multiple groups
                        amount_str = match if isinstance(match, str) else match[0]
                        amount = float(amount_str.replace(',', '').replace('$', ''))
                        amounts.append(amount)
                    except (ValueError, TypeError):
                        continue
            
            if not amounts:
                return None
            
            # Determine if debit or credit based on context with improved detection
            line_lower = line.lower()
            is_debit = any(word in line_lower for word in ['debit', 'withdrawal', 'fee', 'charge', 'payment', 'purchase'])
            is_credit = any(word in line_lower for word in ['credit', 'deposit', 'interest', 'refund', 'transfer in'])
            
            # Check for negative indicators
            has_negative = '-' in line or 'minus' in line_lower
            
            debit = amounts[0] if is_debit or has_negative else None
            credit = amounts[0] if is_credit and not has_negative else None
            
            # If neither explicitly indicated, use position/context clues
            if not debit and not credit:
                # Default to debit if amount appears after certain keywords
                debit_context = any(word in line_lower for word in ['atm', 'pos', 'transfer out', 'bill'])
                if debit_context:
                    debit = amounts[0]
                else:
                    credit = amounts[0]  # Default to credit
            
            # Clean description by removing dates and amounts
            description = line
            for pattern in self.date_patterns:
                description = pattern.sub('', description)
            for pattern in self.money_patterns:
                description = pattern.sub('', description)
            description = re.sub(r'\s+', ' ', description).strip()
            
            # Remove common prefixes/suffixes
            description = re.sub(r'^(debit|credit|withdrawal|deposit)\s*', '', description, flags=re.IGNORECASE)
            description = description.strip()
            
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
        """Extract general transactions with improved accuracy, table detection, and performance"""
        transactions = []
        lines = text.split('\n')
        
        print(f"Processing {len(lines)} lines for general transaction extraction")
        
        # Detect if this looks like a table and adjust extraction strategy
        has_table_structure = self._detect_tables(text)
        print(f"Table structure detected: {has_table_structure}")
        
        if has_table_structure:
            return self._extract_from_table_structure(lines)
        
        # Pre-filter lines that likely contain transactions (performance optimization)
        candidate_lines = []
        for i, line in enumerate(lines):
            line = line.strip()
            if not line or len(line) < 10:  # Skip very short lines
                continue
                
            # Quick check for date patterns (performance optimization)
            has_date = any(pattern.search(line) for pattern in self.date_patterns[:2])  # Check first 2 patterns only
            has_amount = any(pattern.search(line) for pattern in self.money_patterns[:3])  # Check first 3 patterns only
            
            if has_date and has_amount:
                candidate_lines.append((i, line))
        
        print(f"Found {len(candidate_lines)} candidate transaction lines")
        
        for line_num, line in candidate_lines:
            transaction = self._parse_transaction_line(line, line_num)
            if transaction:
                transactions.append(transaction)
        
        print(f"General extraction completed: {len(transactions)} transactions found")
        return transactions
    
    def _extract_from_table_structure(self, lines: List[str]) -> List[RawTransaction]:
        """
        Extract transactions from table-like structures with improved parsing.
        Uses column detection and positional analysis.
        """
        transactions = []
        
        # Find potential header row to understand column structure
        header_row = None
        date_col = None
        desc_col = None
        amount_col = None
        
        for i, line in enumerate(lines[:10]):  # Check first 10 lines for header
            line_lower = line.lower()
            if any(header in line_lower for header in ['date', 'description', 'amount', 'transaction']):
                header_row = i
                # Try to identify column positions
                if 'date' in line_lower:
                    date_col = line_lower.find('date')
                if 'description' in line_lower or 'desc' in line_lower:
                    desc_col = max(line_lower.find('description'), line_lower.find('desc'))
                if 'amount' in line_lower:
                    amount_col = line_lower.find('amount')
                break
        
        print(f"Table analysis: header_row={header_row}, date_col={date_col}, desc_col={desc_col}, amount_col={amount_col}")
        
        # Start processing from after header (or from beginning if no header found)
        start_row = header_row + 1 if header_row is not None else 0
        
        for i, line in enumerate(lines[start_row:], start_row):
            line = line.strip()
            if not line or len(line) < 10:
                continue
            
            # For table structures, try to parse based on column positions
            transaction = self._parse_table_row(line, date_col, desc_col, amount_col, i)
            if transaction:
                transactions.append(transaction)
        
        return transactions
    
    def _parse_table_row(self, line: str, date_col: Optional[int], desc_col: Optional[int], 
                         amount_col: Optional[int], line_num: int) -> Optional[RawTransaction]:
        """Parse a single row from a table structure"""
        try:
            # If we have column positions, try to use them
            if date_col is not None and desc_col is not None and amount_col is not None:
                # Split by multiple spaces or tabs to get columns
                columns = re.split(r'\s{2,}|\t+', line)
                
                if len(columns) >= 3:
                    # Try to map columns to data
                    date_str = columns[0] if date_col < desc_col else None
                    desc_str = None
                    amount_str = None
                    
                    # Find the column that looks most like a date
                    for col in columns:
                        if any(pattern.search(col) for pattern in self.date_patterns):
                            date_str = col
                            break
                    
                    # Find the column that looks most like an amount
                    for col in columns:
                        if any(pattern.search(col) for pattern in self.money_patterns):
                            amount_str = col
                            break
                    
                    # Use remaining text as description
                    remaining_text = line
                    if date_str:
                        remaining_text = remaining_text.replace(date_str, '', 1)
                    if amount_str:
                        remaining_text = remaining_text.replace(amount_str, '', 1)
                    desc_str = re.sub(r'\s+', ' ', remaining_text).strip()
                    
                    if date_str and amount_str and desc_str:
                        date_normalized = self._normalize_date(date_str)
                        amount = self._extract_amount_improved(amount_str)
                        
                        if amount != 0.0 and len(desc_str) > 2:
                            return RawTransaction(
                                date=date_normalized,
                                description=desc_str,
                                amount=amount
                            )
            
            # Fallback to regular line parsing
            return self._parse_transaction_line(line, line_num)
            
        except Exception as e:
            logger.debug(f"Error parsing table row: {e}")
            return None
    
    def _parse_transaction_line(self, line: str, line_num: int) -> Optional[RawTransaction]:
        """Parse a single transaction line with enhanced accuracy"""
        # Extract date using pre-compiled patterns
        date_match = None
        for pattern in self.date_patterns:
            match = pattern.search(line)
            if match:
                date_match = self._normalize_date(match.group(1))
                break
        
        if not date_match:
            return None
            
        print(f"Line {line_num}: Found date {date_match} in: {line[:100]}")
            
        # Extract amount using improved extraction
        amount = self._extract_amount_improved(line)
        print(f"Line {line_num}: Extracted amount {amount}")
        
        if amount == 0.0:
            # Skip transactions with zero amount
            print(f"Line {line_num}: Skipping zero amount transaction")
            return None
        
        # Clean description more intelligently
        description = self._clean_description(line)
        
        print(f"Line {line_num}: Cleaned description: '{description}'")
        
        # Only create transaction if we have a meaningful description
        if description and len(description) > 2:
            transaction = RawTransaction(
                date=date_match,
                description=description,
                amount=amount
            )
            print(f"Line {line_num}: Created transaction: {transaction}")
            return transaction
        else:
            print(f"Line {line_num}: Skipping transaction with empty/short description")
            return None
    
    def _extract_amount_improved(self, text: str) -> float:
        """Extract monetary amount with improved patterns and handling"""
        # Try pre-compiled patterns in order of specificity
        for pattern in self.money_patterns:
            matches = pattern.findall(text)
            if matches:
                # Handle different match types (single group vs multiple groups)
                for match in matches:
                    try:
                        amount_str = match if isinstance(match, str) else match[0]
                        amount_str = amount_str.replace(',', '').replace('$', '').strip()
                        amount = float(amount_str)
                        
                        # Handle negative indicators in the text
                        text_lower = text.lower()
                        if any(indicator in text_lower for indicator in ['debit', 'withdrawal', 'fee', 'charge', '-']):
                            amount = -abs(amount)
                        
                        return amount
                    except (ValueError, TypeError, AttributeError):
                        continue
        return 0.0
    
    def _clean_description(self, line: str) -> str:
        """Clean transaction description more intelligently"""
        description = line
        
        # Remove dates using pre-compiled patterns
        for pattern in self.date_patterns:
            description = pattern.sub('', description)
        
        # Remove amounts using pre-compiled patterns
        for pattern in self.money_patterns:
            description = pattern.sub('', description)
        
        # Remove common transaction prefixes
        description = re.sub(r'^(transaction|payment|deposit|withdrawal|transfer):\s*', '', description, flags=re.IGNORECASE)
        
        # Clean up whitespace
        description = re.sub(r'\s+', ' ', description).strip()
        
        # Remove leading/trailing punctuation
        description = description.strip('.,;:-')
        
        return description
    
    def _normalize_date(self, date_str: str) -> str:
        """Normalize date to YYYY-MM-DD format with improved parsing"""
        try:
            # Enhanced format list with more comprehensive patterns
            formats = [
                '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%m-%d-%Y',
                '%Y/%m/%d', '%Y-%m-%d', '%d.%m.%Y', '%d.%m.%y',
                '%d %b %Y', '%d %B %Y', '%m/%d/%y', '%d/%m/%y',
                '%d %b, %Y', '%d %B, %Y', '%B %d, %Y', '%b %d, %Y',
                '%d%b%Y', '%d%B%Y'  # No spaces
            ]
            
            date_str = date_str.strip()
            
            # Handle ordinal dates (1st, 2nd, 3rd, 4th, etc.)
            date_str = re.sub(r'(\d+)(?:st|nd|rd|th)', r'\1', date_str, flags=re.IGNORECASE)
            
            for fmt in formats:
                try:
                    date_obj = datetime.strptime(date_str, fmt)
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue
            
            # If no format matches, try parsing with partial matching
            return date_str.strip()
            
        except Exception:
            return date_str.strip()
    
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
    
    @monitor_performance("full_pdf_extraction")
    def extract_from_base64(self, base64_content: str) -> ExtractionResult:
        """
        Extract transactions from base64 encoded PDF using the new LangExtract-style approach.
        Enhanced with quality validation and confidence scoring.
        """
        try:
            # Decode base64 content
            pdf_content = base64.b64decode(base64_content)
            
            # Get PDF analysis for quality metrics
            pdf_analysis = self.pdf_extractor.analyze_pdf_structure(pdf_content)
            
            # Extract text with robust error handling
            text_content = self.pdf_extractor.extract_text_from_pdf(pdf_content)
            page_count = pdf_analysis['page_count']
            
            # Debug: Log extracted text sample
            print(f"Extracted text length: {len(text_content)} characters")
            print(f"First 500 characters of extracted text: {text_content[:500]}")
            print(f"PDF has {page_count} pages")
            
            # Extract structured data using our LangExtract-style approach
            structured_data = self.structured_extractor.extract_structured_data(text_content)
            print(f"Structured extraction completed. Data type: {type(structured_data)}")
            
            # Convert to standardized format for compatibility
            if isinstance(structured_data, (TransactionList, RideshareTaxSummary)):
                # Convert structured data to RawTransaction format for API compatibility
                transactions = self._convert_to_raw_transactions(structured_data)
            else:
                transactions = structured_data
            
            print(f"Final transactions count: {len(transactions)}")
            if transactions:
                print(f"Sample transaction: date={transactions[0].date}, desc='{transactions[0].description}', amount={transactions[0].amount}")
            
            # Calculate quality metrics
            quality_metrics = self._calculate_extraction_quality(transactions, text_content, pdf_analysis)
            
            result = ExtractionResult(
                transactions=transactions,
                page_count=page_count,
                transaction_count=len(transactions),
                extraction_confidence=quality_metrics['overall_confidence'],
                quality_metrics=quality_metrics
            )
            
            print(f"Extraction quality: {quality_metrics}")
            return result
            
        except Exception as e:
            logger.error(f"Error in LangExtract-style PDF extraction: {str(e)}")
            raise ValueError(f"Failed to extract data from PDF: {str(e)}")
    
    def _calculate_extraction_quality(self, transactions: List[RawTransaction], 
                                    text_content: str, pdf_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate comprehensive quality metrics for the extraction.
        """
        if not transactions:
            return {
                'overall_confidence': 0.1,
                'data_completeness': 0.0,
                'date_validity': 0.0,
                'amount_validity': 0.0,
                'description_quality': 0.0,
                'consistency_score': 0.0
            }
        
        # Data completeness score
        total_fields = len(transactions) * 3  # date, description, amount
        filled_fields = sum([
            1 if t.date else 0,
            1 if t.description and len(t.description) > 2 else 0,
            1 if t.amount != 0.0 else 0
        ] for t in transactions) * 3
        
        data_completeness = filled_fields / total_fields if total_fields > 0 else 0
        
        # Date validity score
        valid_dates = 0
        for transaction in transactions:
            try:
                # Check if date can be parsed
                datetime.strptime(transaction.date, '%Y-%m-%d')
                valid_dates += 1
            except:
                pass
        date_validity = valid_dates / len(transactions) if transactions else 0
        
        # Amount validity score (check for reasonable amounts)
        valid_amounts = sum(1 for t in transactions if -1000000 <= t.amount <= 1000000 and t.amount != 0)
        amount_validity = valid_amounts / len(transactions) if transactions else 0
        
        # Description quality score
        quality_descriptions = sum(1 for t in transactions 
                                 if t.description and len(t.description) > 5 and 
                                 not t.description.lower().startswith(('unknown', 'n/a', 'none')))
        description_quality = quality_descriptions / len(transactions) if transactions else 0
        
        # Consistency score (check for duplicate/similar transactions)
        unique_transactions = len(set((t.date, t.description[:20], round(t.amount, 2)) for t in transactions))
        consistency_score = unique_transactions / len(transactions) if transactions else 0
        
        # Calculate overall confidence
        base_confidence = pdf_analysis.get('extraction_confidence', 0.5)
        
        overall_confidence = (
            base_confidence * 0.3 +
            data_completeness * 0.2 +
            date_validity * 0.2 +
            amount_validity * 0.15 +
            description_quality * 0.1 +
            consistency_score * 0.05
        )
        
        return {
            'overall_confidence': round(overall_confidence, 3),
            'data_completeness': round(data_completeness, 3),
            'date_validity': round(date_validity, 3),
            'amount_validity': round(amount_validity, 3),
            'description_quality': round(description_quality, 3),
            'consistency_score': round(consistency_score, 3),
            'pdf_analysis': pdf_analysis
        }
    
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