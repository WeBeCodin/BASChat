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
  const [documentInsights, setDocumentInsights] =
    useState<DocumentInsights | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleIndustrySelect = async (industry: string) => {
    if (!rawTransactions) return;

    setStep("categorizing");

    try {
      console.log("Starting categorization for industry:", industry);
      console.log("Raw transactions count:", rawTransactions?.length);

      // Test with just the first 5 transactions to see if the AI works
      const testTransactions = rawTransactions?.slice(0, 5) || [];
      console.log("Testing with first 5 transactions:", testTransactions);

      // Log the exact input being sent to AI
      const aiInput = {
        rawTransactions: testTransactions,
        industry,
      };
      console.log("AI Input being sent:", JSON.stringify(aiInput, null, 2));

      const result = await categorizeTransactions(aiInput);

      console.log("Categorization result:", result);
      console.log(
        "Categorized transactions count:",
        result?.transactions?.length
      );

      if (result && result.transactions.length > 0) {
        setCategorizedTransactions(result.transactions);
        setStep("ready");
        setConversation([
          {
            role: "bot",
            content:
              "I've analyzed and categorized your transactions based on your industry. Here is a summary. How can I help you with your BAS analysis?",
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
        const financialData = JSON.stringify(categorizedTransactions, null, 2);
        const result = await basAnalysisChatbot({
          documentInsights,
          financialData,
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
    [conversation, categorizedTransactions, toast, documentInsights]
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
        return (
          <Card className="w-full max-w-2xl mx-auto flex-1 flex items-center justify-center border-2 border-dashed">
            <CardContent className="text-center p-8">
              <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-primary" />
              <CardTitle className="mt-4">
                {step === "extracting"
                  ? "Extracting Transactions..."
                  : "Categorizing Transactions..."}
              </CardTitle>
              <CardDescription className="mt-2">
                {step === "extracting"
                  ? "Our hybrid AI system is analyzing your document and selecting the optimal extraction engine. This may take a moment."
                  : "Applying industry logic to categorize your transactions."}
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
              <TransactionsTable transactions={categorizedTransactions} />
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
