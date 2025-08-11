import { NextRequest, NextResponse } from 'next/server';
import type { RawTransaction } from '@/ai/schemas';

export async function POST(request: NextRequest) {
  try {
    const { searchTerm, transactions } = await request.json();
    
    if (!searchTerm || !transactions) {
      return NextResponse.json({ error: 'Missing search term or transactions' }, { status: 400 });
    }

    console.log(`Searching for "${searchTerm}" in ${transactions.length} transactions`);
    
    // Perform case-insensitive search in transaction descriptions
    const matchingTransactions = transactions.filter((transaction: RawTransaction) => 
      transaction.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    console.log(`Found ${matchingTransactions.length} transactions matching "${searchTerm}"`);
    
    return NextResponse.json({
      searchTerm,
      totalTransactions: transactions.length,
      matchingTransactions,
      matchCount: matchingTransactions.length
    });

  } catch (error) {
    console.error('Error in transaction search:', error);
    return NextResponse.json(
      { error: 'Failed to search transactions' },
      { status: 500 }
    );
  }
}
