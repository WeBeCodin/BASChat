"use client";

import type { RawTransaction, Transaction } from "@/ai/schemas";
import { basAnalysisChatbot } from "@/ai/flows/bas-analysis-chatbot";
import { categorizeTransactions } from "@/ai/flows/categorize-transactions";
import React, { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UploadCloud,
  LoaderCircle,
  FilePlus2,
  Car,
  Wrench,
  Heart,
  Truck,
  Stethoscope,
} from "lucide-react";
import FinancialSummary from "./financial-summary";
import TransactionsTable from "./transactions-table";
import TransactionSearch from "./transaction-search";
import ChatPanel from "./chat-panel";

type ConversationMessage = {
  role: "user" | "bot";
  content: string;
};

type FinancialSummaryData = {
  income: number;
  expenses: number;
  profit: number;
};

type BasCalculationsData = {
  g1: number;
  "1a": number;
  "1b": number;
};

type DocumentInsights = {
  pageCount: number;
  transactionCount: number;
};

type AppStep =
  | "uploading"
  | "extracting"
  | "selecting_industry"
  | "categorizing"
  | "adding_document"
  | "ready";

const industries = [
  { name: "Rideshare", icon: Car },
  { name: "Construction & Trades", icon: Wrench },
  { name: "NDIS Support Work", icon: Heart },
  { name: "Truck Driving", icon: Truck },
  { name: "Allied Health", icon: Stethoscope },
];

export default function Dashboard() {
  const [step, setStep] = useState<AppStep>("uploading");
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawTransactions, setRawTransactions] = useState<
    RawTransaction[] | null
  >(null);
  const [categorizedTransactions, setCategorizedTransactions] = useState<
    Transaction[] | null
  >(null);
  const [maybeTransactions, setMaybeTransactions] = useState<
    Transaction[] | null
  >(null);
  const [documentInsights, setDocumentInsights] =
    useState<DocumentInsights | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [industry, setIndustry] = useState<string>("");
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Helper functions for managing maybe transactions
  const approveMaybeTransaction = useCallback((transactionIndex: number, newCategory: "Income" | "Expenses") => {
    if (!maybeTransactions) return;
    
    const transaction = maybeTransactions[transactionIndex];
    if (!transaction) return;
    
    // Update the transaction category
    const updatedTransaction = { ...transaction, category: newCategory };
    
    // Remove from maybe list
    const updatedMaybeTransactions = maybeTransactions.filter((_, index) => index !== transactionIndex);
    
    // Add to categorized list
    const updatedCategorizedTransactions = [...(categorizedTransactions || []), updatedTransaction];
    
    setMaybeTransactions(updatedMaybeTransactions);
    setCategorizedTransactions(updatedCategorizedTransactions);
    
    toast({
      title: "Transaction Approved",
      description: `Transaction moved to ${newCategory}`,
    });
  }, [maybeTransactions, categorizedTransactions, toast]);

  const removeMaybeTransaction = useCallback((transactionIndex: number) => {
    if (!maybeTransactions) return;
    
    const updatedMaybeTransactions = maybeTransactions.filter((_, index) => index !== transactionIndex);
    setMaybeTransactions(updatedMaybeTransactions);
    
    toast({
      title: "Transaction Removed",
      description: "Transaction excluded from BAS calculations",
    });
  }, [maybeTransactions, toast]);

  // Function to analyze transactions and suggest search terms
  const generateIndustrySearchSuggestions = useCallback((transactions: RawTransaction[]): string[] => {
    if (!transactions || transactions.length === 0) return [];
    
    const merchantCounts: { [key: string]: number } = {};
    const suggestions = new Set<string>();
    
    transactions.forEach(transaction => {
      const desc = transaction.description?.toLowerCase() || '';
      
      // Count occurrences of merchants/entities
      const words = desc.split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) {
          merchantCounts[word] = (merchantCounts[word] || 0) + 1;
        }
      });
      
      // Industry-specific patterns
      if (desc.includes('uber') || desc.includes('taxi') || desc.includes('transport')) {
        suggestions.add('UBER');
        suggestions.add('transport');
        suggestions.add('taxi');
      }
      if (desc.includes('paypal') || desc.includes('stripe') || desc.includes('square')) {
        suggestions.add('PayPal');
        suggestions.add('payment processing');
      }
      if (desc.includes('aws') || desc.includes('azure') || desc.includes('google cloud')) {
        suggestions.add('cloud services');
        suggestions.add('hosting');
      }
      if (desc.includes('office') || desc.includes('supplies') || desc.includes('staples')) {
        suggestions.add('office supplies');
        suggestions.add('stationery');
      }
      if (desc.includes('fuel') || desc.includes('petrol') || desc.includes('gas')) {
        suggestions.add('fuel');
        suggestions.add('vehicle expenses');
      }
      if (desc.includes('internet') || desc.includes('telstra') || desc.includes('optus')) {
        suggestions.add('telecommunications');
        suggestions.add('internet');
      }
      if (desc.includes('insurance') || desc.includes('cover')) {
        suggestions.add('insurance');
      }
      if (desc.includes('subscription') || desc.includes('monthly') || desc.includes('annual')) {
        suggestions.add('subscriptions');
      }
    });
    
    // Add frequent merchants (appearing 3+ times)
    Object.entries(merchantCounts)
      .filter(([word, count]) => count >= 3)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([word]) => {
        suggestions.add(word.toUpperCase());
      });
    
    return Array.from(suggestions).slice(0, 12); // Limit to 12 suggestions
  }, []);

  // Helper functions for transaction search
  const addSearchedTransactionsAsIncome = useCallback((transactions: RawTransaction[]) => {
    const existingTransactions = [...(categorizedTransactions || []), ...(maybeTransactions || [])];
    
    // Filter out duplicates by comparing date, description, and amount
    const newTransactions = transactions.filter(newTxn => 
      !existingTransactions.some(existing => 
        existing.date === newTxn.date && 
        existing.description === newTxn.description && 
        existing.amount === newTxn.amount
      )
    );
    
    if (newTransactions.length === 0) {
      toast({
        title: "No New Transactions",
        description: "All selected transactions are already categorized",
        variant: "destructive"
      });
      return;
    }
    
    const newIncomeTransactions = newTransactions.map(t => ({
      ...t,
      category: "Income" as const,
      subCategory: "Manual Addition",
      confidence: 1.0
    }));
    
    const updatedCategorizedTransactions = [...(categorizedTransactions || []), ...newIncomeTransactions];
    setCategorizedTransactions(updatedCategorizedTransactions);
    
    const skippedCount = transactions.length - newTransactions.length;
    const message = skippedCount > 0 
      ? `Added ${newTransactions.length} new transactions as income (${skippedCount} duplicates skipped)`
      : `Added ${newTransactions.length} transactions as income`;
    
    toast({
      title: "Added to Income",
      description: message,
    });
  }, [categorizedTransactions, maybeTransactions, toast]);

  const addSearchedTransactionsAsExpenses = useCallback((transactions: RawTransaction[]) => {
    const existingTransactions = [...(categorizedTransactions || []), ...(maybeTransactions || [])];
    
    // Filter out duplicates by comparing date, description, and amount
    const newTransactions = transactions.filter(newTxn => 
      !existingTransactions.some(existing => 
        existing.date === newTxn.date && 
        existing.description === newTxn.description && 
        existing.amount === newTxn.amount
      )
    );
    
    if (newTransactions.length === 0) {
      toast({
        title: "No New Transactions",
        description: "All selected transactions are already categorized",
        variant: "destructive"
      });
      return;
    }
    
    const newExpenseTransactions = newTransactions.map(t => ({
      ...t,
      category: "Expenses" as const,
      subCategory: "Manual Addition", 
      confidence: 1.0
    }));
    
    const updatedCategorizedTransactions = [...(categorizedTransactions || []), ...newExpenseTransactions];
    setCategorizedTransactions(updatedCategorizedTransactions);
    
    const skippedCount = transactions.length - newTransactions.length;
    const message = skippedCount > 0 
      ? `Added ${newTransactions.length} new transactions as expenses (${skippedCount} duplicates skipped)`
      : `Added ${newTransactions.length} transactions as expenses`;
    
    toast({
      title: "Added to Expenses", 
      description: message,
    });
  }, [categorizedTransactions, maybeTransactions, toast]);

  const extractWithHybridService = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    console.log("Using hybrid extraction pipeline...");

    const response = await fetch("/api/extract-pdf-hybrid", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Hybrid extraction error:", errorData);
      throw new Error(errorData.error || errorData.details || "PDF extraction failed");
    }

    const result = await response.json();
    console.log(
      "Hybrid PDF extraction result:",
      JSON.stringify(result, null, 2)
    );
    console.log("Extracted transactions count:", result.transactionCount);
    console.log("Extraction engine used:", result.extractionEngine);
    console.log("Extraction time:", result.extractionTime + "ms");
    console.log("Confidence:", result.confidence);
    console.log(
      "First 3 extracted transactions:",
      result.transactions?.slice(0, 3)
    );

    return result;
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStep("extracting");
    setRawTransactions(null);
    setCategorizedTransactions(null);
    setMaybeTransactions(null);
    setConversation([]);
    setDocumentInsights(null);

    try {
      // Use hybrid extraction pipeline that automatically chooses the best engine
      const result = await extractWithHybridService(file);

      console.log("Final extraction result received:", result);
      console.log("Setting rawTransactions to:", result.transactions);

      if (result && result.transactions.length > 0) {
        setRawTransactions(result.transactions);
        setDocumentInsights({
          pageCount: result.pageCount,
          transactionCount: result.transactionCount,
        });
        setStep("selecting_industry");
      } else {
        throw new Error("No transactions found in the document.");
      }
    } catch (error) {
      console.error("Error extracting financial data:", error);
      toast({
        variant: "destructive",
        title: "Extraction Failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not extract financial data from the PDF.",
      });
      setStep("uploading");
    }

    if (event.target) event.target.value = "";
  };

  const handleAdditionalFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStep("adding_document");

    try {
      // Use hybrid extraction pipeline that automatically chooses the best engine
      const result = await extractWithHybridService(file);

      console.log("Additional document extraction result:", result);
      console.log("Additional extracted transactions count:", result.transactionCount);

      if (result && result.transactions.length > 0) {
        // Merge new transactions with existing raw transactions
        const mergedRawTransactions = [...(rawTransactions || []), ...result.transactions];
        setRawTransactions(mergedRawTransactions);
        
        // Update document insights to reflect combined data
        setDocumentInsights(prev => ({
          pageCount: (prev?.pageCount || 0) + result.pageCount,
          transactionCount: mergedRawTransactions.length,
        }));

        // Automatically categorize the new transactions using the same industry
        if (industry) {
          const aiInput = {
            rawTransactions: result.transactions, // Only categorize the new transactions
            documentInsights: {
              pageCount: result.pageCount,
              transactionCount: result.transactionCount,
            },
            industry,
          };
          
          console.log("Categorizing additional transactions...");
          const categorizationResult = await categorizeTransactions(aiInput);
          
          // Merge new categorized transactions with existing ones
          const mergedCategorized = [
            ...(categorizedTransactions || []), 
            ...(categorizationResult.transactions || [])
          ];
          const mergedMaybe = [
            ...(maybeTransactions || []), 
            ...(categorizationResult.maybeTransactions || [])
          ];
          
          setCategorizedTransactions(mergedCategorized);
          setMaybeTransactions(mergedMaybe);
          
          // Add a message about the additional document
          const newMessage = {
            role: "bot" as const,
            content: `📄 **Additional Document Processed!**\n\nI've extracted ${result.transactionCount} new transactions and categorized them with your existing data.\n\n• **New categorized transactions:** ${categorizationResult.transactions?.length || 0}\n• **New transactions needing review:** ${categorizationResult.maybeTransactions?.length || 0}\n• **Total transactions now:** ${mergedRawTransactions.length}\n\nYou can upload more documents or continue with your analysis!`
          };
          
          setConversation(prev => [...prev, newMessage]);
        }
        
        setStep("ready");
        
        toast({
          title: "Additional Document Added",
          description: `Added ${result.transactionCount} new transactions to your analysis`,
        });
      } else {
        throw new Error("No transactions found in the additional document.");
      }
    } catch (error) {
      console.error("Error extracting additional document:", error);
      toast({
        variant: "destructive",
        title: "Additional Document Failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not extract financial data from the additional PDF.",
      });
      setStep("ready");
    }

    if (event.target) event.target.value = "";
  };

  const handleIndustrySelect = async (selectedIndustry: string) => {
    if (!rawTransactions) return;

    setIndustry(selectedIndustry); // Store the selected industry
    setStep("categorizing");

    try {
      console.log("Starting categorization for industry:", selectedIndustry);
      console.log("Raw transactions count:", rawTransactions?.length);

      // Use all transactions for categorization
      const transactionsToProcess = rawTransactions || [];
      console.log("Processing all transactions:", transactionsToProcess.length);

      // Log the exact input being sent to AI
      const aiInput = {
        rawTransactions: transactionsToProcess,
        industry: selectedIndustry,
      };
      console.log("AI Input being sent - first 3 transactions:", JSON.stringify({
        ...aiInput,
        rawTransactions: aiInput.rawTransactions.slice(0, 3)
      }, null, 2));

      const result = await categorizeTransactions(aiInput);

      console.log("Categorization result:", result);
      console.log(
        "Categorized transactions count:",
        result?.transactions?.length
      );
      console.log(
        "Maybe transactions count:",
        result?.maybeTransactions?.length || 0
      );

      if (result && (result.transactions.length > 0 || (result.maybeTransactions && result.maybeTransactions.length > 0))) {
        setCategorizedTransactions(result.transactions || []);
        setMaybeTransactions(result.maybeTransactions || []);
        setStep("ready");
        
        const categorizedCount = result.transactions?.length || 0;
        const maybeCount = result.maybeTransactions?.length || 0;
        
        let message = "I've analyzed your transactions based on your industry.";
        
        if (categorizedCount > 0 && maybeCount > 0) {
          message += ` I've categorized ${categorizedCount} transactions with confidence and identified ${maybeCount} transactions that need your review - these appear in orange and require your approval.`;
        } else if (categorizedCount > 0) {
          message += ` I've categorized ${categorizedCount} transactions with confidence.`;
        } else if (maybeCount > 0) {
          message += ` All ${maybeCount} transactions need your review - they appear in orange and require your approval to determine if they're business income or expenses.`;
        }
        
        // Generate search suggestions based on the raw transactions
        const searchSuggestions = generateIndustrySearchSuggestions(rawTransactions || []);
        
        if (searchSuggestions.length > 0) {
          message += `\n\n📍 **Quick Search Suggestions** (based on your transaction patterns):\n`;
          message += searchSuggestions.map(suggestion => `• "${suggestion}"`).join('\n');
          message += `\n\nUse the Transaction Search tool above to find specific merchants or transaction types from all extracted transactions.`;
        }
        
        message += "\n\nYou can now:\n";
        message += "• Upload additional documents to add more transactions to your analysis\n";
        message += "• Continue reviewing and categorizing transactions\n";
        message += "• Ask me questions about your financial data\n\n";
        message += "Let me know when you're ready to upload more documents or if you need help with your BAS analysis!";
          
        setConversation([
          {
            role: "bot",
            content: message,
          },
        ]);
      } else {
        throw new Error("Failed to categorize transactions.");
      }
    } catch (error) {
      console.error("Error categorizing transactions:", error);
      toast({
        variant: "destructive",
        title: "Categorization Failed",
        description: "Could not categorize the financial data.",
      });
      setStep("selecting_industry");
    }
  };

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !categorizedTransactions || !documentInsights)
        return;

      const newConversation: ConversationMessage[] = [
        ...conversation,
        { role: "user", content: message },
      ];
      setConversation(newConversation);
      setIsChatLoading(true);

      try {
        // Include both categorized transactions and raw transaction data for accurate searching
        const categorizedData = JSON.stringify(categorizedTransactions, null, 2);
        const rawData = rawTransactions ? JSON.stringify(rawTransactions.slice(0, 10), null, 2) : ""; // Include sample of raw data
        
        const enhancedFinancialData = `
CATEGORIZED TRANSACTIONS (${categorizedTransactions.length} transactions):
${categorizedData}

RAW TRANSACTION DATA SAMPLE (Total: ${rawTransactions?.length || 0} transactions):
${rawData}

TRANSACTION SEARCH CAPABILITY:
The user can search through ALL ${rawTransactions?.length || 0} raw transactions using the Transaction Search tool above. 
When they ask about specific merchants or transaction types, direct them to use the search functionality.
        `;
        
        const result = await basAnalysisChatbot({
          documentInsights: {
            ...documentInsights,
            transactionCount: rawTransactions?.length || documentInsights.transactionCount
          },
          financialData: enhancedFinancialData,
          userQuery: message,
          conversationHistory: conversation,
        });
        setConversation([
          ...newConversation,
          { role: "bot", content: result.response },
        ]);
      } catch (error) {
        console.error("Chatbot error:", error);
        setConversation([
          ...newConversation,
          {
            role: "bot",
            content: "Sorry, I encountered an error. Please try again.",
          },
        ]);
        toast({
          variant: "destructive",
          title: "Chat Error",
          description: "Could not get a response from the assistant.",
        });
      } finally {
        setIsChatLoading(false);
      }
    },
    [conversation, categorizedTransactions, rawTransactions, toast, documentInsights]
  );

  const { financialSummary, basCalculations } = useMemo(() => {
    if (!categorizedTransactions)
      return { financialSummary: null, basCalculations: null };

    const income = categorizedTransactions
      .filter((t) => t.category === "Income")
      .reduce((acc, t) => acc + t.amount, 0);
    const expenses = categorizedTransactions
      .filter((t) => t.category === "Expenses")
      .reduce((acc, t) => acc + t.amount, 0);
    const profit = income - expenses;

    const summary: FinancialSummaryData = { income, expenses, profit };

    const g1 = income;
    const gstOnSales = g1 / 11;
    const gstOnPurchases = expenses / 11;

    const bas: BasCalculationsData = {
      g1,
      "1a": gstOnSales,
      "1b": gstOnPurchases,
    };

    return { financialSummary: summary, basCalculations: bas };
  }, [categorizedTransactions]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const renderStepContent = () => {
    switch (step) {
      case "uploading":
        return (
          <Card className="w-full max-w-2xl mx-auto flex-1 flex items-center justify-center border-2 border-dashed">
            <CardContent className="text-center p-8">
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
              <CardTitle className="mt-4">
                Upload Your Financial Documents
              </CardTitle>
              <CardDescription className="mt-2 mb-6">
                Drag and drop your PDF files here or click to upload. Our
                intelligent hybrid extraction system automatically selects the
                optimal engine based on document complexity to minimize costs
                while maximizing accuracy.
              </CardDescription>

              <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileChange(e)}
                accept=".pdf"
              />
              <Button onClick={handleUploadClick} className="mt-6">
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload PDF
              </Button>
            </CardContent>
          </Card>
        );
      case "extracting":
      case "categorizing":
      case "adding_document":
        return (
          <Card className="w-full max-w-2xl mx-auto flex-1 flex items-center justify-center border-2 border-dashed">
            <CardContent className="text-center p-8">
              <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-primary" />
              <CardTitle className="mt-4">
                {step === "extracting"
                  ? "Extracting Transactions..."
                  : step === "categorizing"
                  ? "Categorizing Transactions..."
                  : "Processing Additional Document..."}
              </CardTitle>
              <CardDescription className="mt-2">
                {step === "extracting"
                  ? "Our hybrid AI system is analyzing your document and selecting the optimal extraction engine. This may take a moment."
                  : step === "categorizing"
                  ? "Applying industry logic to categorize your transactions."
                  : "Extracting transactions from your additional document and merging with existing data."}
              </CardDescription>
            </CardContent>
          </Card>
        );
      case "selecting_industry":
        return (
          <Card className="w-full max-w-2xl mx-auto flex-1 flex items-center justify-center">
            <CardContent className="text-center p-8">
              <CardTitle className="mt-4">Select Your Industry</CardTitle>
              <CardDescription className="mt-2 mb-6">
                This will help us accurately categorize your transactions for
                BAS analysis.
              </CardDescription>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {industries.map((industry) => (
                  <Button
                    key={industry.name}
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => handleIndustrySelect(industry.name)}
                  >
                    <industry.icon className="h-6 w-6" />
                    <span>{industry.name}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      case "ready":
        return (
          <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3 h-full">
            <div className="xl:col-span-2 space-y-4 md:space-y-8">
              <FinancialSummary
                summary={financialSummary}
                bas={basCalculations}
              />
              
              {/* Additional Document Upload Button */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Add More Documents</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload additional financial documents to include more transactions in your analysis
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        className="hidden"
                        onChange={handleAdditionalFileChange}
                        accept=".pdf"
                        id="additional-file-input"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => document.getElementById('additional-file-input')?.click()}
                        disabled={isProcessing}
                      >
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Upload Additional PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <TransactionSearch
                rawTransactions={rawTransactions}
                onAddToIncome={addSearchedTransactionsAsIncome}
                onAddToExpenses={addSearchedTransactionsAsExpenses}
              />
              <TransactionsTable 
                transactions={categorizedTransactions} 
                maybeTransactions={maybeTransactions}
                onApproveMaybeTransaction={approveMaybeTransaction}
                onRemoveMaybeTransaction={removeMaybeTransaction}
              />
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
      default:
        return null;
    }
  };

  return renderStepContent();
}
