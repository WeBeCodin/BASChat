# BAS Hero - PDF Extraction Integration Guide

This document provides comprehensive information about the dual extraction engine system implemented in BAS Hero.

## Overview

BAS Hero now supports two PDF extraction engines:

1. **AI-Based Extraction** - Fast extraction using Google AI (Gemini)
2. **Python PDF Extractor** - Robust extraction using PyMuPDF microservice

## Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Frontend      │    │   Next.js API        │    │   Python Service   │
│   (React/TS)    │    │   Routes             │    │   (FastAPI)         │
├─────────────────┤    ├──────────────────────┤    ├─────────────────────┤
│ • File Upload   │◄──►│ /api/extract-pdf     │◄──►│ POST /extract       │
│ • Engine Select │    │ (Proxy to Python)    │    │ POST /extract-base64│
│ • UI Components │    │                      │    │ GET /health         │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────────┐
│   AI Flows      │    │   Genkit Integration │
│   (Existing)    │    │   (Google AI)        │
├─────────────────┤    ├──────────────────────┤
│ • extract-      │    │ • AI Prompts         │
│   financial-    │    │ • Schema Validation  │
│   data          │    │ • Error Handling     │
│ • categorize-   │    │                      │
│   transactions  │    │                      │
└─────────────────┘    └──────────────────────┘
```

## Implementation Details

### Frontend Changes

#### New Components
- **Extraction Engine Selector**: Dropdown component with two options
- **Enhanced Upload UI**: Integrated engine selection with file upload

#### State Management
```typescript
type ExtractionEngine = 'ai' | 'python';
const [extractionEngine, setExtractionEngine] = useState<ExtractionEngine>('ai');
```

#### Engine Selection UI
```typescript
const extractionEngines = [
  { 
    value: 'ai' as ExtractionEngine, 
    label: 'AI-Based Extraction', 
    description: 'Fast extraction using Google AI',
    icon: Bot 
  },
  { 
    value: 'python' as ExtractionEngine, 
    label: 'Python PDF Extractor', 
    description: 'Robust extraction using PyMuPDF',
    icon: Cpu 
  },
];
```

### Backend Integration

#### Next.js API Route (`/api/extract-pdf/route.ts`)
- Proxies requests to Python microservice
- Handles file uploads and form data
- Transforms responses to match existing schema
- Provides error handling and validation

#### Python Microservice (`/services/python-extractor/`)
- **FastAPI** web framework
- **PyMuPDF** for PDF text extraction
- **Pydantic** for data validation
- **Docker** support for deployment

### Data Flow

1. **File Upload**: User selects extraction engine and uploads PDF
2. **Engine Routing**: Frontend routes request based on selected engine
3. **Processing**:
   - **AI Engine**: Converts to data URI → Genkit flow → Google AI
   - **Python Engine**: Form data → Next.js proxy → Python service
4. **Response**: Both engines return standardized transaction data
5. **Continuation**: Same workflow for industry selection and categorization

## API Specifications

### Python Service Endpoints

#### `POST /extract`
**Purpose**: Extract transactions from uploaded PDF file

**Request**:
```bash
curl -X POST "http://localhost:8000/extract" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@document.pdf"
```

**Response**:
```json
{
  "transactions": [
    {
      "date": "2024-01-15",
      "description": "Office supplies purchase",
      "amount": 156.78
    }
  ],
  "page_count": 3,
  "transaction_count": 25
}
```

#### `POST /extract-base64`
**Purpose**: Extract transactions from base64 encoded PDF

**Request**:
```json
{
  "file_content": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAv..."
}
```

#### `GET /health`
**Purpose**: Service health check

**Response**:
```json
{
  "status": "healthy",
  "service": "pdf-extractor"
}
```

### Next.js Proxy Route

#### `POST /api/extract-pdf`
**Purpose**: Proxy requests to Python service

**Request**: Same as Python service `/extract` endpoint

**Response**: Transformed to match existing schema:
```json
{
  "transactions": [...],
  "pageCount": 3,        // Note: camelCase
  "transactionCount": 25 // Note: camelCase
}
```

## Deployment Options

### Local Development

1. **Next.js App**:
   ```bash
   npm install
   npm run dev
   ```

2. **Python Service** (Optional):
   ```bash
   cd services/python-extractor
   pip install -r requirements.txt
   python main.py
   ```

### Docker Deployment

```bash
# Build and run Python service
docker-compose up python-extractor

# Or build manually
cd services/python-extractor
docker build -t pdf-extractor .
docker run -p 8000:8000 pdf-extractor
```

### Environment Configuration

**`.env.local`**:
```env
PYTHON_EXTRACTOR_URL=http://localhost:8000
```

**Production considerations**:
- Use proper service discovery
- Configure load balancing
- Set up monitoring and logging
- Implement authentication if needed

## Error Handling

### Python Service
- **Invalid file types**: HTTP 400 with descriptive message
- **Corrupted PDFs**: HTTP 500 with error details
- **Processing failures**: Graceful degradation with empty results

### Next.js Proxy
- **Service unavailable**: Falls back to error response
- **Network timeouts**: Proper error propagation
- **Invalid responses**: Input validation

### Frontend
- **Extraction failures**: Toast notifications with retry options
- **Network errors**: User-friendly error messages
- **Graceful fallbacks**: Maintains application state

## Testing Strategy

### Python Service
```bash
cd services/python-extractor
python -m pytest test_main.py
```

### Integration Testing
1. Upload test PDFs through UI
2. Verify both extraction engines work
3. Test error scenarios
4. Validate data flow end-to-end

### Manual Testing Checklist
- [ ] Engine selection UI works
- [ ] AI extraction still functions
- [ ] Python extraction (when service available)
- [ ] Error handling for unavailable service
- [ ] File upload validation
- [ ] Response data consistency

## Performance Considerations

### AI Engine
- **Pros**: Fast processing, no additional infrastructure
- **Cons**: API rate limits, less control over complex PDFs

### Python Engine
- **Pros**: Robust PDF handling, predictable performance
- **Cons**: Additional service overhead, deployment complexity

### Optimization Tips
1. **Caching**: Consider caching extraction results
2. **Async Processing**: For large files, implement background processing
3. **File Size Limits**: Set reasonable upload limits
4. **Resource Management**: Monitor memory usage in Python service

## Security Considerations

1. **File Validation**: Strict PDF type checking
2. **Size Limits**: Prevent large file attacks
3. **Input Sanitization**: Clean extracted text data
4. **Service Isolation**: Python service runs in isolated container
5. **Network Security**: Use HTTPS in production

## Monitoring and Observability

### Metrics to Track
- Extraction success/failure rates per engine
- Processing times by file size
- Service availability and response times
- Error rates and types

### Logging
- Request/response logging in Next.js
- Detailed extraction logs in Python service
- Error tracking and alerting

## Future Enhancements

1. **Advanced PDF Parsing**: OCR support for scanned documents
2. **Batch Processing**: Multiple file upload support
3. **Custom Extraction Rules**: User-defined parsing patterns
4. **Performance Analytics**: Detailed extraction metrics
5. **ML Improvements**: Custom trained models for transaction detection

## Troubleshooting

### Common Issues

**Python service not starting**:
- Check port 8000 availability
- Verify Python dependencies installed
- Check Docker configuration

**Extraction returns empty results**:
- Verify PDF is not password protected
- Check file is valid PDF format
- Review extraction logs for errors

**UI not showing Python option**:
- Verify import statements for new components
- Check TypeScript compilation
- Ensure environment variables set

### Debug Commands
```bash
# Test Python service health
curl http://localhost:8000/health

# Check Next.js API route
curl -X POST http://localhost:9002/api/extract-pdf \
  -F "file=@test.pdf"

# View service logs
docker-compose logs python-extractor
```