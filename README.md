# BAS Hero

This is a NextJS application for Business Activity Statement (BAS) analysis that helps users extract and categorize financial transactions from PDF documents.

## Core Features

- **PDF Upload**: Enable users to upload financial documents (PDFs) via a chat interface.
- **Dual Extraction Engines**: Choose between AI-based extraction (Google AI) or robust Python-based extraction (PyMuPDF).
- **AI Data Extraction and Categorization**: Utilize AI to extract financial transactions from uploaded PDFs and categorize them into industry-specific income and expense buckets.
- **Interactive BAS Analysis via Chatbot**: Allow users to interact with a financial expert tool, which gives summaries, asks clarifying questions, and applies corrections.
- **Profit/Loss Reporting**: Enable the user to view income, expenses, and profit/loss summaries for specified periods (e.g., weekly, monthly).
- **BAS Calculation**: Provide quarterly BAS calculations based on categorized financial data (G1, 1A, 1B).
- **Categorization Error Correction**: Allow users to correct AI categorization of expenses via chat
- **Subscription Management**: Allow the user to create an account and manage subscription payment

## Extraction Engines

### AI-Based Extraction
- **Fast processing** using Google AI (Gemini)
- **Suitable for** standard PDF formats
- **Best for** quick analysis of well-formatted documents

### Python PDF Extractor
- **Robust processing** using PyMuPDF
- **Handles** complex, multi-page, and malformed PDFs
- **Best for** large documents and challenging PDF formats
- **Microservice architecture** for scalability

## Getting Started

### Prerequisites
- Node.js 18+ 
- Python 3.11+ (for Python extraction service)
- Docker (optional, for containerized deployment)

### Development Setup

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Start the Next.js development server**:
   ```bash
   npm run dev
   ```

3. **Optional: Start the Python extraction service**:
   ```bash
   cd services/python-extractor
   pip install -r requirements.txt
   python main.py
   ```

4. **Optional: Use Docker for Python service**:
   ```bash
   docker-compose up python-extractor
   ```

The app will be available at `http://localhost:9002`.

### Environment Variables

Create a `.env.local` file:
```env
PYTHON_EXTRACTOR_URL=http://localhost:8000
```

## API Routes

- **`/api/extract-pdf`**: Proxy route to Python extraction service
- Main application uses Genkit flows for AI-based processing

## Architecture

### Frontend (Next.js)
- React components with TypeScript
- Tailwind CSS for styling
- Radix UI components

### Backend Services
- **AI Service**: Genkit with Google AI integration
- **Python Microservice**: FastAPI with PyMuPDF for robust PDF processing

### Data Flow
1. User uploads PDF and selects extraction engine
2. Frontend routes to appropriate extraction service
3. Raw transactions are extracted and returned
4. User selects industry for categorization
5. Transactions are categorized using AI
6. Interactive chat analysis becomes available

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
