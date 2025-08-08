'use client';

import type { ExtractFinancialDataOutput } from '@/ai/flows/extract-financial-data';
import { basAnalysisChatbot } from '@/ai/flows/bas-analysis-chatbot';
import { extractFinancialData } from '@/ai/flows/extract-financial-data';
import React, { useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, LoaderCircle } from 'lucide-react';
import FinancialSummary from './financial-summary';
import TransactionsTable from './transactions-table';
import ChatPanel from './chat-panel';

type Transaction = ExtractFinancialDataOutput['transactions'][0];
type ConversationMessage = {
  role: 'user' | 'bot';
  content: string;
};

type FinancialSummaryData = {
  income: number;
  expenses: number;
  profit: number;
};

type BasCalculationsData = {
  g1: number;
  '1a': number;
  '1b': number;
};

export default function Dashboard() {
  const [step, setStep] = useState<'uploading' | 'analyzing' | 'ready'>('uploading');
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStep('analyzing');
    setTransactions(null);
    setConversation([]);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const pdfDataUri = reader.result as string;
        try {
          const result = await extractFinancialData({ pdfDataUri });
          if (result && result.transactions) {
            setTransactions(result.transactions);
            setStep('ready');
            setConversation([
              {
                role: 'bot',
                content:
                  "I've analyzed your document. Here is a summary of your financial data. How can I help you with your BAS analysis?",
              },
            ]);
            toast({
              title: 'Analysis Complete',
              description: 'Financial data extracted successfully.',
            });
          } else {
            throw new Error('No transactions found.');
          }
        } catch (error) {
          console.error('Error extracting financial data:', error);
          toast({
            variant: 'destructive',
            title: 'Analysis Failed',
            description: 'Could not extract financial data from the PDF.',
          });
          setStep('uploading');
        }
      };
      reader.onerror = (error) => {
        throw error;
      };
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        variant: 'destructive',
        title: 'File Error',
        description: 'There was an issue processing your file.',
      });
      setStep('uploading');
    }
  };
  
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || !transactions) return;

    const newConversation: ConversationMessage[] = [...conversation, { role: 'user', content: message }];
    setConversation(newConversation);
    setIsChatLoading(true);

    try {
      const financialData = JSON.stringify(transactions, null, 2);
      const result = await basAnalysisChatbot({
        financialData,
        userQuery: message,
        conversationHistory: conversation,
      });
      setConversation([...newConversation, { role: 'bot', content: result.response }]);
    } catch (error) {
      console.error('Chatbot error:', error);
      setConversation([
        ...newConversation,
        { role: 'bot', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
      toast({
        variant: 'destructive',
        title: 'Chat Error',
        description: 'Could not get a response from the assistant.',
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [conversation, transactions, toast]);

  const { financialSummary, basCalculations } = useMemo(() => {
    if (!transactions) return { financialSummary: null, basCalculations: null };

    const income = transactions.filter(t => t.category === 'Income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions.filter(t => t.category === 'Expenses').reduce((acc, t) => acc + t.amount, 0);
    const profit = income - expenses;
    
    const summary: FinancialSummaryData = { income, expenses, profit };
    
    const g1 = income;
    const gstOnSales = g1 / 11;
    const gstOnPurchases = expenses / 11;
    
    const bas: BasCalculationsData = { g1, '1a': gstOnSales, '1b': gstOnPurchases };

    return { financialSummary: summary, basCalculations: bas };
  }, [transactions]);
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  if (step === 'uploading' || step === 'analyzing') {
    return (
      <Card className="w-full max-w-2xl mx-auto flex-1 flex items-center justify-center border-2 border-dashed">
        <CardContent className="text-center p-8">
          {step === 'uploading' ? (
            <>
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
              <CardTitle className="mt-4">Upload Your Financial Documents</CardTitle>
              <CardDescription className="mt-2">
                Drag and drop your PDF files here or click to upload.
              </CardDescription>
              <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf"
              />
              <Button onClick={handleUploadClick} className="mt-6">
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload PDF
              </Button>
            </>
          ) : (
            <>
              <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-primary" />
              <CardTitle className="mt-4">Analyzing Document...</CardTitle>
              <CardDescription className="mt-2">
                Our AI is extracting and categorizing your financial data. This may take a moment.
              </CardDescription>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3 h-full">
      <div className="xl:col-span-2 space-y-4 md:space-y-8">
        <FinancialSummary summary={financialSummary} bas={basCalculations} />
        <TransactionsTable transactions={transactions} />
      </div>
      <div className="h-full max-h-[calc(100vh-12rem)] min-h-[500px]">
        <ChatPanel
          messages={conversation}
          onSendMessage={handleSendMessage}
          isLoading={isChatLoading}
        />
      </div>
    </div>
  );
}
