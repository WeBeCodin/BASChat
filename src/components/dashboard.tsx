"use client";

import type { RawTransaction, Transaction } from "@/ai/schemas";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UploadCloud,
  LoaderCircle,
  FilePlus2,
  Car,
  Wrench,
  Heart,
  Truck,
  Stethoscope,
  Settings,
} from "lucide-react";
import FinancialSummary from "./financial-summary";
import TransactionsTable from "./transactions-table";
import TransactionSearch from "./transaction-search";
import ChatPanel from "./chat-panel";
import { ProfitLossReport } from "./profit-loss-report";
import { BasReport } from "./bas-report";

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

type DashboardView = "transactions" | "profit-loss" | "bas-report";

const industries = [
  { name: "Rideshare", icon: Car },
  { name: "Construction & Trades", icon: Wrench },
  { name: "NDIS Support Work", icon: Heart },
  { name: "Truck Driving", icon: Truck },
  { name: "Allied Health", icon: Stethoscope },
  { name: "Other", icon: Settings },
];

export default function Dashboard() {
  const [step, setStep] = useState<AppStep>("uploading");
  const [currentView, setCurrentView] = useState<DashboardView>("transactions");
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
  const [customIndustry, setCustomIndustry] = useState<string>("");
  const [isGeneratingLexicon, setIsGeneratingLexicon] = useState(false);
  const [lexiconProgress, setLexiconProgress] = useState<string>("");
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Helper functions for managing maybe transactions
  const approveMaybeTransaction = useCallback(
    (transactionIndex: number, newCategory: "Income" | "Expenses") => {
      if (!maybeTransactions) return;

      const transaction = maybeTransactions[transactionIndex];
      if (!transaction) return;

      // Update the transaction category
      const updatedTransaction = { ...transaction, category: newCategory };

      // Remove from maybe list
      const updatedMaybeTransactions = maybeTransactions.filter(
        (_, index) => index !== transactionIndex
      );

      // Add to categorized list
      const updatedCategorizedTransactions = [
        ...(categorizedTransactions || []),
        updatedTransaction,
      ];

      setMaybeTransactions(updatedMaybeTransactions);
      setCategorizedTransactions(updatedCategorizedTransactions);

      toast({
        title: "Transaction Approved",
        description: `Transaction moved to ${newCategory}`,
      });
    },
    [maybeTransactions, categorizedTransactions, toast]
  );

  const removeMaybeTransaction = useCallback(
    (transactionIndex: number) => {
      if (!maybeTransactions) return;

      const updatedMaybeTransactions = maybeTransactions.filter(
        (_, index) => index !== transactionIndex
      );
      setMaybeTransactions(updatedMaybeTransactions);

      toast({
        title: "Transaction Removed",
        description: "Transaction excluded from BAS calculations",
      });
    },
    [maybeTransactions, toast]
  );

  // Helper functions for managing categorized transactions
  const deleteTransaction = useCallback(
    (transactionIndex: number) => {
      if (!categorizedTransactions) return;

      const updatedTransactions = categorizedTransactions.filter(
        (_, index) => index !== transactionIndex
      );
      setCategorizedTransactions(updatedTransactions);

      toast({
        title: "Transaction Deleted",
        description: "The transaction has been removed from your analysis.",
      });
    },
    [categorizedTransactions, toast]
  );

  const flipTransactionCategory = useCallback(
    (transactionIndex: number) => {
      if (!categorizedTransactions) return;

      const updatedTransactions = categorizedTransactions.map(
        (transaction, index) => {
          if (index === transactionIndex) {
            return {
              ...transaction,
              category:
                transaction.category === "Income"
                  ? "Expenses"
                  : ("Income" as const),
            };
          }
          return transaction;
        }
      );

      setCategorizedTransactions(updatedTransactions);

      const transaction = categorizedTransactions[transactionIndex];
      const newCategory =
        transaction.category === "Income" ? "Expenses" : "Income";

      toast({
        title: "Category Changed",
        description: `Transaction moved to ${newCategory}`,
      });
    },
    [categorizedTransactions, toast]
  );

  // Function to analyze transactions and suggest search terms
  const generateIndustrySearchSuggestions = useCallback(
    (transactions: RawTransaction[], selectedIndustry: string): string[] => {
      if (!transactions || transactions.length === 0) return [];

      const suggestions = new Set<string>();

      // Industry-specific lexicons
      const industryTerms: { [key: string]: string[] } = {
        Rideshare: [
          "UBER",
          "fuel",
          "car",
          "vehicle",
          "maintenance",
          "insurance",
          "tolls",
          "parking",
          "rego",
          "registration",
        ],
        "Construction & Trades": [
          "tools",
          "materials",
          "hardware",
          "supplies",
          "equipment",
          "safety",
          "trade",
          "building",
          "electrical",
          "plumbing",
        ],
        "NDIS Support Work": [
          "client",
          "support",
          "care",
          "training",
          "equipment",
          "supplies",
          "travel",
          "accommodation",
          "meals",
        ],
        "Truck Driving": [
          "fuel",
          "diesel",
          "maintenance",
          "tyres",
          "insurance",
          "rego",
          "logbook",
          "tolls",
          "accommodation",
          "meals",
        ],
        "Allied Health": [
          "equipment",
          "supplies",
          "training",
          "conference",
          "professional",
          "insurance",
          "registration",
          "software",
          "travel",
        ],
      };

      // Get industry-specific terms
      const relevantTerms = industryTerms[selectedIndustry] || [];

      // Check which industry terms actually appear in the transactions
      transactions.forEach((transaction) => {
        const desc = transaction.description?.toLowerCase() || "";

        relevantTerms.forEach((term) => {
          if (desc.includes(term.toLowerCase())) {
            suggestions.add(term);
          }
        });

        // Add some common business expense patterns if they appear frequently
        if (
          desc.includes("subscription") ||
          desc.includes("monthly") ||
          desc.includes("annual")
        ) {
          suggestions.add("subscriptions");
        }
        if (
          desc.includes("internet") ||
          desc.includes("phone") ||
          desc.includes("mobile")
        ) {
          suggestions.add("telecommunications");
        }
        if (desc.includes("office") || desc.includes("stationery")) {
          suggestions.add("office supplies");
        }
      });

      // If we don't have enough suggestions, add the most common industry terms
      if (suggestions.size < 6) {
        relevantTerms.slice(0, 8 - suggestions.size).forEach((term) => {
          suggestions.add(term);
        });
      }

      return Array.from(suggestions).slice(0, 8); // Limit to 8 suggestions
    },
    []
  );

  // Helper functions for transaction search
  const addSearchedTransactionsAsIncome = useCallback(
    (transactions: RawTransaction[]) => {
      const existingTransactions = [
        ...(categorizedTransactions || []),
        ...(maybeTransactions || []),
      ];

      // Filter out duplicates by comparing date, description, and amount
      const newTransactions = transactions.filter(
        (newTxn) =>
          !existingTransactions.some(
            (existing) =>
              existing.date === newTxn.date &&
              existing.description === newTxn.description &&
              existing.amount === newTxn.amount
          )
      );

      if (newTransactions.length === 0) {
        toast({
          title: "No New Transactions",
          description: "All selected transactions are already categorized",
          variant: "destructive",
        });
        return;
      }

      const newIncomeTransactions = newTransactions.map((t) => ({
        ...t,
        category: "Income" as const,
        subCategory: "Manual Addition",
        confidence: 1.0,
      }));

      const updatedCategorizedTransactions = [
        ...(categorizedTransactions || []),
        ...newIncomeTransactions,
      ];
      setCategorizedTransactions(updatedCategorizedTransactions);

      const skippedCount = transactions.length - newTransactions.length;
      const message =
        skippedCount > 0
          ? `Added ${newTransactions.length} new transactions as income (${skippedCount} duplicates skipped)`
          : `Added ${newTransactions.length} transactions as income`;

      toast({
        title: "Added to Income",
        description: message,
      });
    },
    [categorizedTransactions, maybeTransactions, toast]
  );

  const addSearchedTransactionsAsExpenses = useCallback(
    (transactions: RawTransaction[]) => {
      const existingTransactions = [
        ...(categorizedTransactions || []),
        ...(maybeTransactions || []),
      ];

      // Filter out duplicates by comparing date, description, and amount
      const newTransactions = transactions.filter(
        (newTxn) =>
          !existingTransactions.some(
            (existing) =>
              existing.date === newTxn.date &&
              existing.description === newTxn.description &&
              existing.amount === newTxn.amount
          )
      );

      if (newTransactions.length === 0) {
        toast({
          title: "No New Transactions",
          description: "All selected transactions are already categorized",
          variant: "destructive",
        });
        return;
      }

      const newExpenseTransactions = newTransactions.map((t) => ({
        ...t,
        category: "Expenses" as const,
        subCategory: "Manual Addition",
        confidence: 1.0,
      }));

      const updatedCategorizedTransactions = [
        ...(categorizedTransactions || []),
        ...newExpenseTransactions,
      ];
      setCategorizedTransactions(updatedCategorizedTransactions);

      const skippedCount = transactions.length - newTransactions.length;
      const message =
        skippedCount > 0
          ? `Added ${newTransactions.length} new transactions as expenses (${skippedCount} duplicates skipped)`
          : `Added ${newTransactions.length} transactions as expenses`;

      toast({
        title: "Added to Expenses",
        description: message,
      });
    },
    [categorizedTransactions, maybeTransactions, toast]
  );

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
      throw new Error(
        errorData.error || errorData.details || "PDF extraction failed"
      );
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
      console.log(
        "Additional extracted transactions count:",
        result.transactionCount
      );

      if (result && result.transactions.length > 0) {
        // Merge new transactions with existing raw transactions
        const mergedRawTransactions = [
          ...(rawTransactions || []),
          ...result.transactions,
        ];
        setRawTransactions(mergedRawTransactions);

        // Update document insights to reflect combined data
        setDocumentInsights((prev) => ({
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
          
          const categorizationResponse = await fetch('/api/categorize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(aiInput),
          });

          if (!categorizationResponse.ok) {
            throw new Error(`HTTP error! status: ${categorizationResponse.status}`);
          }

          const categorizationResult = await categorizationResponse.json();

          // Merge new categorized transactions with existing ones (new ones at the top)
          const mergedCategorized = [
            ...(categorizationResult.transactions || []),
            ...(categorizedTransactions || []),
          ];
          const mergedMaybe = [
            ...(categorizationResult.maybeTransactions || []),
            ...(maybeTransactions || []),
          ];

          setCategorizedTransactions(mergedCategorized);
          setMaybeTransactions(mergedMaybe);

          // Add a message about the additional document
          const newMessage = {
            role: "bot" as const,
            content: `📄 **Additional Document Processed!**\n\nI've extracted ${
              result.transactionCount
            } new transactions and categorized them with your existing data.\n\n• **New categorized transactions:** ${
              categorizationResult.transactions?.length || 0
            }\n• **New transactions needing review:** ${
              categorizationResult.maybeTransactions?.length || 0
            }\n• **Total transactions now:** ${
              mergedRawTransactions.length
            }\n\nYou can upload more documents or continue with your analysis!`,
          };

          setConversation((prev) => [...prev, newMessage]);
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
      console.log(
        "AI Input being sent - first 3 transactions:",
        JSON.stringify(
          {
            ...aiInput,
            rawTransactions: aiInput.rawTransactions.slice(0, 3),
          },
          null,
          2
        )
      );

      const categorizationResponse = await fetch('/api/categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiInput),
      });

      if (!categorizationResponse.ok) {
        throw new Error(`HTTP error! status: ${categorizationResponse.status}`);
      }

      const result = await categorizationResponse.json();

      console.log("Categorization result:", result);
      console.log(
        "Categorized transactions count:",
        result?.transactions?.length
      );
      console.log(
        "Maybe transactions count:",
        result?.maybeTransactions?.length || 0
      );

      if (
        result &&
        (result.transactions.length > 0 ||
          (result.maybeTransactions && result.maybeTransactions.length > 0))
      ) {
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
        const searchSuggestions = generateIndustrySearchSuggestions(
          rawTransactions || [],
          selectedIndustry
        );

        if (searchSuggestions.length > 0) {
          message += `\n\n📍 **Quick Search Suggestions** (based on your transaction patterns):\n`;
          message += searchSuggestions
            .map((suggestion) => `• "${suggestion}"`)
            .join("\n");
          message += `\n\nUse the Transaction Search tool above to find specific merchants or transaction types from all extracted transactions.`;
        }

        message += "\n\nYou can now:\n";
        message +=
          "• Upload additional documents to add more transactions to your analysis\n";
        message += "• Continue reviewing and categorizing transactions\n";
        message += "• Ask me questions about your financial data\n\n";
        message +=
          "Let me know when you're ready to upload more documents or if you need help with your BAS analysis!";

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

  const handleCustomIndustrySelect = async () => {
    if (!customIndustry || customIndustry === "temp" || !rawTransactions) return;

    try {
      // First generate the lexicon for the custom industry
      await generateCustomIndustryLexicon(customIndustry.trim());
      
      // Then proceed with normal industry selection using the custom industry name
      setIndustry(customIndustry.trim());
      setStep("categorizing");

      console.log("Starting categorization for custom industry:", customIndustry.trim());
      console.log("Raw transactions count:", rawTransactions?.length);

      const transactionsToProcess = rawTransactions || [];
      console.log("Processing all transactions:", transactionsToProcess.length);

      const aiInput = {
        rawTransactions: transactionsToProcess,
        industry: customIndustry.trim(),
      };

      const categorizationResponse = await fetch('/api/categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiInput),
      });

      if (!categorizationResponse.ok) {
        throw new Error(`HTTP error! status: ${categorizationResponse.status}`);
      }

      const result = await categorizationResponse.json();

      console.log("Categorization result:", result);
      console.log("Categorized transactions count:", result?.transactions?.length);
      console.log("Maybe transactions count:", result?.maybeTransactions?.length || 0);

      if (result && (result.transactions.length > 0 || (result.maybeTransactions && result.maybeTransactions.length > 0))) {
        setCategorizedTransactions(result.transactions || []);
        setMaybeTransactions(result.maybeTransactions || []);
        setStep("ready");

        // Generate suggestions for the custom industry
        const suggestions = generateIndustrySearchSuggestions(rawTransactions, customIndustry.trim());
        
        let message = `I've analyzed your transactions based on your ${customIndustry.trim()} industry. I've categorized ${result.transactions?.length || 0} transactions with confidence and identified ${result.maybeTransactions?.length || 0} transactions that need your review - these appear in orange and require your approval.`;

        if (suggestions.length > 0) {
          message += `\n\n📍 **Quick Search Suggestions** (based on your transaction patterns):\n`;
          message += suggestions.map(term => `• "${term}"`).join("\n");
          message += `\n\nUse the Transaction Search tool above to find specific merchants or transaction types from all extracted transactions.`;
        }

        message += "\n\nYou can now:\n";
        message += "• Upload additional documents to add more transactions to your analysis\n";
        message += "• Continue reviewing and categorizing transactions\n";
        message += "• Ask me questions about your financial data\n\n";
        message += "Let me know when you're ready to upload more documents or if you need help with your BAS analysis!";

        setConversation([{
          role: "bot",
          content: message,
        }]);
      } else {
        throw new Error("Failed to categorize transactions.");
      }
    } catch (error) {
      console.error("Error with custom industry setup:", error);
      toast({
        variant: "destructive",
        title: "Custom Industry Setup Failed",
        description: "Could not set up the custom industry. Please try again.",
      });
      setStep("selecting_industry");
    }
  };

  const generateCustomIndustryLexicon = async (industryName: string) => {
    try {
      setIsGeneratingLexicon(true);
      setLexiconProgress("Analyzing industry requirements...");
      
      console.log(`Generating lexicon for custom industry: ${industryName}`);
      
      const response = await fetch('/api/generate-lexicon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ industry: industryName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate lexicon');
      }

      setLexiconProgress("Building industry-specific search terms...");
      
      const result = await response.json();
      
      setLexiconProgress("Finalizing industry configuration...");
      
      console.log(`Generated lexicon for ${industryName}:`, result);
      
      // Store the custom industry info (you could save this to localStorage or a database)
      localStorage.setItem(`custom_industry_${industryName}`, JSON.stringify(result));
      
      setLexiconProgress("Complete! Industry lexicon generated successfully.");
      
      // Small delay to show completion message
      setTimeout(() => {
        setIsGeneratingLexicon(false);
        setLexiconProgress("");
        
        toast({
          title: "Industry Lexicon Generated",
          description: `Successfully created custom guidance for ${industryName} business.`,
        });
      }, 1000);
      
      return result;
      
    } catch (error) {
      console.error("Error generating lexicon:", error);
      setIsGeneratingLexicon(false);
      setLexiconProgress("");
      
      toast({
        variant: "destructive",
        title: "Lexicon Generation Failed",
        description: error instanceof Error ? error.message : "Could not generate industry lexicon.",
      });
      
      throw error;
    }
  };

  const handleSendMessage = useCallback(
    async (message: string) => {
      console.log("handleSendMessage called with:", message);
      console.log("categorizedTransactions:", categorizedTransactions);
      console.log("documentInsights:", documentInsights);
      
      if (!message.trim() || !categorizedTransactions || !documentInsights) {
        console.log("Early return - missing data");
        return;
      }

      const newConversation: ConversationMessage[] = [
        ...conversation,
        { role: "user", content: message },
      ];
      setConversation(newConversation);
      setIsChatLoading(true);

      try {
        // Include both categorized transactions and raw transaction data for accurate searching
        const categorizedData = JSON.stringify(
          categorizedTransactions,
          null,
          2
        );
        const rawData = rawTransactions
          ? JSON.stringify(rawTransactions.slice(0, 10), null, 2)
          : ""; // Include sample of raw data

        const enhancedFinancialData = `
INDUSTRY: ${industry}

CATEGORIZED TRANSACTIONS (${categorizedTransactions.length} transactions):
${categorizedData}

RAW TRANSACTION DATA SAMPLE (Total: ${
          rawTransactions?.length || 0
        } transactions):
${rawData}

TRANSACTION SEARCH CAPABILITY:
The user can search through ALL ${
          rawTransactions?.length || 0
        } raw transactions using the Transaction Search tool above. 
When they ask about specific merchants or transaction types, direct them to use the search functionality.
        `;

        const chatInput = {
          documentInsights: {
            ...documentInsights,
            transactionCount:
              rawTransactions?.length || documentInsights.transactionCount,
          },
          financialData: enhancedFinancialData,
          userQuery: message,
          conversationHistory: conversation,
        };

        console.log("Sending to chatbot API:", chatInput);

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatInput),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        console.log("Chatbot API response:", result);
        
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
    [
      conversation,
      categorizedTransactions,
      rawTransactions,
      toast,
      documentInsights,
      industry,
    ]
  );

  // Handler for transaction-specific chat
  const handleChatAboutTransaction = useCallback(
    async (transaction: Transaction) => {
      if (!industry) return;

      const transactionMessage = `Please help me understand this transaction:

**Date:** ${transaction.date}
**Description:** ${transaction.description}
**Amount:** ${new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
      }).format(transaction.amount)}
**Category:** ${transaction.category}
**Sub-Category:** ${transaction.subCategory || "N/A"}

How can this transaction be optimized for my BAS and tax requirements as a ${industry} business?`;

      console.log("handleChatAboutTransaction calling handleSendMessage with:", transactionMessage);
      
      // Use handleSendMessage to properly send the message and get AI response
      await handleSendMessage(transactionMessage);
    },
    [handleSendMessage, industry]
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
              
              {isGeneratingLexicon ? (
                <div className="space-y-4">
                  <LoaderCircle className="h-8 w-8 animate-spin mx-auto" />
                  <p className="text-lg font-medium">Generating Industry Lexicon</p>
                  <p className="text-sm text-muted-foreground">{lexiconProgress}</p>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: "60%" }}></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {industries.slice(0, -1).map((industry) => (
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
                  
                  <div className="border-t pt-6">
                    <div className="space-y-4">
                      <Button
                        variant="outline"
                        className="h-20 flex-col gap-2 w-full max-w-xs mx-auto"
                        onClick={() => {
                          // Toggle custom industry input visibility
                          setCustomIndustry(customIndustry ? "" : "temp");
                        }}
                      >
                        <Settings className="h-6 w-6" />
                        <span>Other Industry</span>
                      </Button>
                      
                      {customIndustry !== "" && (
                        <div className="space-y-3 max-w-sm mx-auto">
                          <Input
                            type="text"
                            placeholder="Enter your industry (e.g., Photography, Tutoring, Consulting)"
                            value={customIndustry === "temp" ? "" : customIndustry}
                            onChange={(e) => setCustomIndustry(e.target.value)}
                            className="text-center"
                          />
                          <Button
                            onClick={() => handleCustomIndustrySelect()}
                            disabled={!customIndustry || customIndustry === "temp" || customIndustry.trim().length < 3}
                            className="w-full"
                          >
                            Generate Industry Lexicon
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      case "ready":
        return (
          <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as DashboardView)} className="h-full">
            <div className="flex justify-center mb-6">
              <TabsList className="grid w-[600px] grid-cols-3">
                <TabsTrigger value="transactions">Transactions & Chat</TabsTrigger>
                <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
                <TabsTrigger value="bas-report">BAS Report</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="transactions" className="h-full mt-0">
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
                            Upload additional financial documents to include more
                            transactions in your analysis
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
                            onClick={() =>
                              document
                                .getElementById("additional-file-input")
                                ?.click()
                            }
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
                    onDeleteTransaction={deleteTransaction}
                    onFlipTransactionCategory={flipTransactionCategory}
                    onChatAboutTransaction={handleChatAboutTransaction}
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
            </TabsContent>
            
            <TabsContent value="profit-loss" className="h-full mt-0">
              {categorizedTransactions && (
                <ProfitLossReport transactions={categorizedTransactions} />
              )}
            </TabsContent>
            
            <TabsContent value="bas-report" className="h-full mt-0">
              {categorizedTransactions && (
                <BasReport transactions={categorizedTransactions} />
              )}
            </TabsContent>
          </Tabs>
        );
      default:
        return null;
    }
  };

  return renderStepContent();
}
