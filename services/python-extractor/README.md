# LangExtract-Style PDF Financial Data Extraction Pipeline

## Overview

This system implements a LangExtract-powered financial data extraction pipeline that processes PDF documents containing bank statements, rideshare summaries, and general financial transactions. The system provides structured, validated data extraction with no user-facing technical choices.

## Architecture

### Core Components

1. **SimplePDFExtractor**: Robust PDF text extraction using PyMuPDF with error handling and repair logic
2. **StructuredExtractor**: LangExtract-style document processing with in-context learning and few-shot examples
3. **LangExtractStyleExtractor**: Main orchestrator that combines PDF extraction with structured processing

### Document Type Detection

The system automatically detects document types using keyword analysis:

- **Bank Statements**: Keywords like "bank", "statement", "account", "balance", "debit", "credit"
- **Rideshare Summaries**: Keywords like "uber", "lyft", "trip", "ride", "driver", "fare", "earnings"
- **General Financial**: Fallback for other financial documents

### Pydantic Schemas

#### Bank Statement Schemas
```python
class BankTransaction(BaseModel):
    date: str
    description: str
    debit: Optional[float]
    credit: Optional[float]
    balance: Optional[float]
    reference: Optional[str]
    category: Optional[str]

class TransactionList(BaseModel):
    transactions: List[BankTransaction]
    account_number: Optional[str]
    statement_period_start: Optional[str]
    statement_period_end: Optional[str]
    opening_balance: Optional[float]
    closing_balance: Optional[float]
```

#### Rideshare Schemas
```python
class RideshareTrip(BaseModel):
    date: str
    time: Optional[str]
    pickup_location: Optional[str]
    dropoff_location: Optional[str]
    distance: Optional[float]
    duration: Optional[str]
    fare: float
    tips: Optional[float]
    tolls: Optional[float]
    total_earnings: float

class RideshareTaxSummary(BaseModel):
    trips: List[RideshareTrip]
    summary_period_start: Optional[str]
    summary_period_end: Optional[str]
    total_trips: int
    total_distance: Optional[float]
    total_earnings: float
    total_tips: Optional[float]
    total_tolls: Optional[float]
    vehicle_expenses: Optional[float]
    deductible_expenses: Optional[float]
```

## API Endpoints

### Production Endpoints

- `POST /extract`: Extract transactions from uploaded PDF file
- `POST /extract-base64`: Extract transactions from base64-encoded PDF content
- `GET /health`: Health check
- `GET /`: Service status

### Admin/Debug Endpoints

- `POST /extract-structured`: Get raw structured data (RideshareTaxSummary or TransactionList)
- `POST /visualize`: Generate extraction visualization and quality metrics
- `GET /admin/status`: Detailed service status and configuration

## Error Handling & Repair Logic

### PDF Extraction Robustness

1. **Multiple Extraction Methods**: 
   - Standard text extraction
   - Alternative text extraction
   - Block-based text extraction

2. **Retry Logic**: Up to 3 attempts with different approaches
3. **Content Repair**: 
   - Encoding fallbacks (utf-8, latin-1, cp1252, ascii)
   - PDF content cleaning (remove null bytes, fix headers)
4. **Graceful Degradation**: Continue processing other pages if one fails

### Validation

- Pydantic schema validation for all extracted data
- Data quality metrics calculation
- Consistency checks for financial calculations

## In-Context Learning & Few-Shot Examples

### Pattern Recognition

The system uses predefined patterns for different document types:

#### Bank Statement Patterns
- Date patterns: `DD/MM/YYYY`, `YYYY-MM-DD`, `DD Mon YYYY`
- Money patterns: `$1,234.56`, `1,234.56$`, handling negative amounts
- Transaction patterns: debit/credit detection based on keywords

#### Rideshare Patterns
- Trip patterns: fare, tip, distance extraction
- Location parsing: pickup/dropoff detection
- Earnings calculation: fare + tips - tolls

### Document Structure Learning

The system learns document structure through:
1. Keyword density analysis
2. Pattern matching with context windows
3. Field relationship validation

## Integration with Chatbot

The extracted structured data is automatically integrated with the chatbot system:

1. **Data Validation**: All extracted data is validated using Pydantic schemas
2. **Source Grounding**: Chatbot responses reference only validated, structured data
3. **Context Preservation**: Document metadata and extraction quality metrics are maintained
4. **Error Transparency**: Any extraction issues are logged but don't prevent processing

## Installation & Setup

### Local Development

1. **Install Python 3.11+**
2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the service**:
   ```bash
   python main.py
   ```

The service will start on `http://localhost:8000`.

### Docker

1. **Build the image**:
   ```bash
   docker build -t pdf-extractor .
   ```

2. **Run the container**:
   ```bash
   docker run -p 8000:8000 pdf-extractor
   ```

### Docker Compose

From the repository root:
```bash
docker-compose up python-extractor
```

## Testing

### Test Coverage

- Unit tests for all core components
- Integration tests for API endpoints
- Document type detection tests
- Error handling and robustness tests
- Pydantic schema validation tests

### Running Tests

```bash
cd services/python-extractor
python -m pytest test_main.py -v
```

### Test Categories

1. **API Tests**: All endpoints with various input types
2. **Extraction Tests**: PDF processing with real and synthetic documents
3. **Schema Tests**: Pydantic model validation
4. **Robustness Tests**: Error handling and edge cases

## Quality Metrics

The visualization endpoint provides quality metrics:

### Completeness Score
- Percentage of expected fields populated
- Calculated per document type

### Consistency Score
- Financial calculation accuracy (e.g., fare + tips = total_earnings)
- Cross-field validation

### Validation Results
- Schema compliance
- Data type correctness
- Required field presence

## Environment Variables

- `PORT`: Service port (default: 8000)
- `PYTHON_EXTRACTOR_URL`: URL for the Python service (used by Next.js app)

## Monitoring & Debugging

### Logging

The service provides comprehensive logging:
- Extraction success/failure rates
- Processing times
- Error details with context
- Quality metric calculations

### Debug Endpoints

Use `/visualize` endpoint for extraction debugging:
```python
# Returns detailed extraction analysis
{
    "extraction_summary": {...},
    "validation_results": {...},
    "data_quality_metrics": {...},
    "debug_info": {...}
}
```

## Performance Considerations

### Optimization Features

1. **Early Document Type Detection**: Reduces processing time
2. **Selective Processing**: Only extract relevant patterns for detected document type
3. **Caching**: PDF text extraction results cached during processing
4. **Efficient Pattern Matching**: Optimized regex patterns for common financial formats

### Scalability

- Stateless service design
- Horizontal scaling support
- Memory-efficient PDF processing
- Asynchronous operation support

## Maintenance

### Regular Tasks

1. **Pattern Updates**: Review and update extraction patterns based on new document formats
2. **Schema Evolution**: Update Pydantic schemas as requirements change
3. **Quality Monitoring**: Track extraction accuracy and adjust thresholds
4. **Performance Optimization**: Monitor processing times and optimize bottlenecks

### Adding New Document Types

To add support for new document types:

1. Add keywords to `detect_document_type()`
2. Create new Pydantic schemas
3. Add extraction patterns in `StructuredExtractor`
4. Add parsing methods following existing patterns
5. Update tests and documentation

### Troubleshooting

Common issues and solutions:

- **Low extraction accuracy**: Check document quality, update patterns
- **Memory issues**: Implement PDF chunking for large documents
- **Performance degradation**: Profile code, optimize regex patterns
- **Schema validation errors**: Update schemas or add fallback handling

## Security Considerations

- File size limits (50MB default)
- Content type validation
- Base64 encoding validation
- No persistent storage of uploaded documents
- Sanitized error messages (no sensitive data exposure)