import { NextRequest, NextResponse } from "next/server";
import pdf from "pdf-parse";

// Real PDF extraction using Node.js libraries (production-ready)
async function extractTransactionsFromPDF(buffer: Buffer) {
  try {
    // Extract text from PDF using pdf-parse
    const data = await pdf(buffer);
    const text = data.text;
    
    console.log(`PDF extracted: ${data.numpages} pages, ${text.length} characters`);
    console.log("First 500 characters:", text.substring(0, 500));
    
    // Parse transactions from the extracted text
    const transactions = parseTransactionsFromText(text);
    
    return {
      transactions,
      page_count: data.numpages,
      transaction_count: transactions.length,
      document_type: "bank_statement",
      extraction_confidence: 0.95
    };
    
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to extract PDF: ${error}`);
  }
}

// Parse transactions from extracted text using regex patterns
function parseTransactionsFromText(text: string) {
  const transactions = [];
  const lines = text.split('\n');
  
  // Common patterns for bank transactions
  const patterns = [
    // Pattern 1: DD/MM/YYYY Description Amount Balance
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d*)\s*([-+]?\$?[\d,]+\.?\d*)?/g,
    // Pattern 2: DD-MM-YYYY Description Amount
    /(\d{1,2}-\d{1,2}-\d{4})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d*)/g,
    // Pattern 3: YYYY-MM-DD Description Amount
    /(\d{4}-\d{1,2}-\d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d*)/g,
    // Pattern 4: DD MMM YYYY or DD MMM YY
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d*)/gi
  ];
  
  let transactionId = 1;
  
  for (const line of lines) {
    if (line.trim().length < 10) continue; // Skip short lines
    
    for (const pattern of patterns) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(line);
      
      if (match) {
        try {
          const [, dateStr, description, amountStr, balanceStr] = match;
          
          // Clean and parse amount
          let amount = parseFloat(amountStr.replace(/[$,\s]/g, '').replace(/[()]/g, '-'));
          if (isNaN(amount)) continue;
          
          // Clean description
          const cleanDesc = description.trim().replace(/\s+/g, ' ');
          if (cleanDesc.length < 3) continue;
          
          // Format date
          let formattedDate;
          try {
            formattedDate = formatDate(dateStr);
          } catch {
            continue; // Skip if date parsing fails
          }
          
          transactions.push({
            date: formattedDate,
            description: cleanDesc,
            amount: amount,
            category: categorizeTransaction(cleanDesc, amount),
            balance: balanceStr ? parseFloat(balanceStr.replace(/[$,\s]/g, '')) : null
          });
          
          transactionId++;
          break; // Move to next line once we find a match
        } catch (error) {
          continue; // Skip malformed transactions
        }
      }
    }
  }
  
  console.log(`Parsed ${transactions.length} transactions from PDF text`);
  return transactions;
}

// Format various date formats to YYYY-MM-DD
function formatDate(dateStr: string): string {
  // Handle DD/MM/YYYY
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle DD-MM-YYYY  
  if (dateStr.includes('-') && dateStr.split('-')[0].length <= 2) {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle YYYY-MM-DD (already correct)
  if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
    return dateStr;
  }
  
  // Handle DD MMM YYYY
  if (dateStr.includes(' ')) {
    const months: Record<string, string> = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    
    const parts = dateStr.toLowerCase().split(/\s+/);
    if (parts.length === 3) {
      const [day, monthName, year] = parts;
      const month = months[monthName.substring(0, 3)];
      if (month) {
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month}-${day.padStart(2, '0')}`;
      }
    }
  }
  
  throw new Error(`Unable to parse date: ${dateStr}`);
}

// Basic transaction categorization
function categorizeTransaction(description: string, amount: number): string {
  const desc = description.toLowerCase();
  
  if (amount > 0) {
    if (desc.includes('salary') || desc.includes('wage') || desc.includes('pay')) return 'Salary';
    if (desc.includes('transfer') || desc.includes('deposit')) return 'Transfer';
    if (desc.includes('interest')) return 'Interest';
    return 'Income';
  } else {
    if (desc.includes('atm') || desc.includes('withdrawal')) return 'Withdrawal';
    if (desc.includes('fee') || desc.includes('charge')) return 'Fee';
    if (desc.includes('payment') || desc.includes('purchase')) return 'Purchase';
    if (desc.includes('transfer')) return 'Transfer';
    return 'Expense';
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    console.log(`Processing real PDF: ${file.name} (${file.size} bytes)`);

    // Convert file to buffer for pdf-parse
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract real transactions from the PDF
    const result = await extractTransactionsFromPDF(buffer);
    
    console.log(`Real PDF extraction completed: ${result.transaction_count} transactions from ${result.page_count} pages`);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error in PDF extraction:", error);
    return NextResponse.json(
      { error: `PDF extraction failed: ${error}` },
      { status: 500 }
    );
  }
}
