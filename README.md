# BAS Hero

This is a NextJS application for Business Activity Statement (BAS) analysis that helps users extract and categorize financial transactions from PDF documents.

## Core Features

- **PDF Upload**: Enable users to upload financial documents (PDFs) via a chat interface.
- **Hybrid Extraction Pipeline**: Intelligent document processing that automatically selects the optimal extraction engine based on document complexity to minimize Vertex AI costs while maintaining accuracy.
- **AI Data Extraction and Categorization**: Utilize AI to extract financial transactions from uploaded PDFs and categorize them into industry-specific income and expense buckets.
- **Interactive BAS Analysis via Chatbot**: Allow users to interact with a financial expert tool, which gives summaries, asks clarifying questions, and applies corrections.
- **Profit/Loss Reporting**: Enable the user to view income, expenses, and profit/loss summaries for specified periods (e.g., weekly, monthly).
- **BAS Calculation**: Provide quarterly BAS calculations based on categorized financial data (G1, 1A, 1B).
- **Categorization Error Correction**: Allow users to correct AI categorization of expenses via chat
- **Subscription Management**: Allow the user to create an account and manage subscription payment

## Hybrid Extraction Pipeline

The application uses an intelligent hybrid extraction system that automatically routes documents to the most appropriate extraction engine:

### Extraction Engines

#### Python/PyMuPDF Extractor (Cost-Effective)
- **Fast processing** using PyMuPDF library
- **Cost-efficient** for simple documents  
- **Suitable for** single-page, straightforward PDFs
- **Best for** bank statements and simple financial documents
- **Automatic selection** when pages ≤ `EXTRACT_PAGE_LIMIT_FOR_PYTHON` and file size < 500KB

#### Vertex AI Extractor (High Accuracy)
- **Advanced AI processing** using Gemini 2.5 Flash Lite
- **Superior accuracy** for complex documents
- **Handles** multi-page, complex layouts, and challenging formats
- **Best for** complex financial documents and multi-page statements
- **Automatic selection** for documents exceeding Python thresholds

### Intelligent Routing Logic

The system automatically analyzes each document and routes it to the optimal extractor:

1. **Document Analysis**: File size and estimated page count analysis
2. **Complexity Assessment**: Determines if document is simple or complex
3. **Cost-Optimal Routing**: Routes simple docs to Python, complex docs to Vertex AI
4. **Automatic Fallback**: If primary extractor fails, automatically tries the secondary
5. **Unified Output**: Both extractors return data in the same validated schema
6. **Error Handling**: Clear error messages if both extractors fail

## Getting Started

### Prerequisites
- Node.js 18+ 
- Python 3.11+ (for Python extraction service)
- Docker (optional, for containerized deployment)
- Google AI API Key (for Vertex AI extraction)

### Development Setup

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys and configuration
   ```

3. **Start the Next.js development server**:
   ```bash
   npm run dev
   ```

4. **Optional: Start the Python extraction service**:
   ```bash
   cd services/python-extractor
   pip install -r requirements.txt
   python main.py
   ```

5. **Optional: Use Docker for Python service**:
   ```bash
   docker-compose up python-extractor
   ```

The app will be available at `http://localhost:9002`.

### Environment Variables

Create a `.env.local` file:
```env
# Google AI API Key for Vertex AI extraction
GOOGLE_GENAI_API_KEY=your_google_ai_api_key_here

# Python extractor service URLs
PYTHON_EXTRACTOR_URL=http://localhost:8000
LANGEXTRACT_SERVICE_URL=http://localhost:8084

# Hybrid extraction configuration
EXTRACT_PAGE_LIMIT_FOR_PYTHON=1
VERTEX_AI_MODEL=gemini-2.5-flash-lite
ENABLE_EXTRACTION_LOGGING=true
```

## Configuration Options

### Extraction Routing Configuration

- **`EXTRACT_PAGE_LIMIT_FOR_PYTHON`**: Maximum pages for Python extractor (default: 1)
- **`VERTEX_AI_MODEL`**: Vertex AI model to use (default: gemini-2.5-flash-lite)
- **`ENABLE_EXTRACTION_LOGGING`**: Enable extraction monitoring logs (default: true)

### Service URLs

- **`LANGEXTRACT_SERVICE_URL`**: Python extraction service endpoint
- **`GOOGLE_GENAI_API_KEY`**: Required for Vertex AI extraction

## API Routes

- **`/api/extract-pdf-hybrid`**: Main hybrid extraction endpoint with intelligent routing
- **`/api/extract-pdf`**: Legacy Python service with fallback
- **`/api/extract-pdf-langextract`**: Direct Python extraction service
- **`/api/test-hybrid-extraction`**: Test endpoint for routing logic validation

## Architecture

### Frontend (Next.js)
- React components with TypeScript
- Tailwind CSS for styling
- Radix UI components

### Backend Services
- **Hybrid Router**: Intelligent document analysis and engine selection
- **Python Microservice**: FastAPI with PyMuPDF for cost-effective extraction
- **Vertex AI Service**: Google AI integration for complex document processing

### Data Flow
1. User uploads PDF via chat interface
2. Hybrid router analyzes document complexity 
3. System automatically selects optimal extraction engine
4. Raw transactions are extracted using selected engine
5. If primary engine fails, automatic fallback to secondary engine
6. User selects industry for categorization
7. Transactions are categorized using AI
8. Interactive chat analysis becomes available

## Monitoring and Cost Optimization

The hybrid system includes comprehensive logging for monitoring and optimization:

- **Engine Usage Tracking**: Monitor which engine is used for each document
- **Performance Metrics**: Track extraction times and success rates
- **Cost Analytics**: Monitor Vertex AI usage vs Python processing
- **Error Rate Monitoring**: Track failures and fallback usage

Access logs via the test endpoint: `/api/test-hybrid-extraction`

## Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript compiler check
```

## Style Guidelines

- Primary color: Dark blue-gray (#37474F), providing a professional and calming dark mode base.
- Background color: Very dark gray (#263238), offering a comfortable, low-contrast dark mode experience.
- Accent color: Subtle teal (#4DB6AC), providing a muted yet vibrant signal for key actions and positive financial indicators.
- Body and headline font: 'Inter' sans-serif for a clean, readable, and modern look suitable for a professional application, optimized for dark mode readability.
- Use simple, geometric, and slightly glowing icons to represent financial categories and actions within the chat interface, ensuring visibility in dark mode.
- Maintain a clean and conversational chat interface layout to make complex BAS tasks feel approachable and manageable, with clear visual separation between elements in dark mode.
- Use subtle, non-distracting loading animations during data processing and AI analysis to enhance the user experience without being jarring in a dark environment.
