# Python PDF Extractor Service

A robust PDF transaction extraction microservice built with FastAPI and PyMuPDF.

## Features

- **Robust PDF Processing**: Uses PyMuPDF for reliable text extraction from complex PDFs
- **REST API**: Simple endpoints for PDF upload and processing
- **Error Handling**: Graceful handling of malformed or corrupted PDF files
- **Pydantic Validation**: Strong typing and validation for all data structures
- **Docker Support**: Easy deployment with Docker containerization

## API Endpoints

### `POST /extract`
Upload a PDF file and extract financial transactions.

**Request**: Multipart form data with a `file` field containing the PDF.

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

### `POST /extract-base64`
Extract transactions from base64 encoded PDF content.

**Request**:
```json
{
  "file_content": "base64-encoded-pdf-content"
}
```

**Response**: Same as `/extract` endpoint.

### `GET /health`
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "service": "pdf-extractor"
}
```

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

## Integration with Next.js App

The Python service integrates with the main BAS Hero application through the `/api/extract-pdf` Next.js API route, which acts as a proxy to this service.

## Environment Variables

- `PORT`: Service port (default: 8000)
- `PYTHON_EXTRACTOR_URL`: URL for the Python service (used by Next.js app)

## Error Handling

The service includes comprehensive error handling for:
- Invalid file formats
- Corrupted PDF files
- Network timeouts
- Processing failures

All errors return appropriate HTTP status codes with descriptive error messages.

## Testing

Run tests with:
```bash
python -m pytest test_main.py
```