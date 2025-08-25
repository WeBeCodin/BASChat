"use client";

import React, { useState } from "react";
import type { RawTransaction, Transaction } from "@/ai/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, DollarSign, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TransactionSearchProps = {
  rawTransactions: RawTransaction[] | null;
  onAddToIncome: (transactions: RawTransaction[]) => void;
  onAddToExpenses: (transactions: RawTransaction[]) => void;
};

type SearchResult = {
  searchTerm: string;
  totalTransactions: number;
  matchingTransactions: RawTransaction[];
  matchCount: number;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
};

const TransactionSearch = React.forwardRef<HTMLInputElement, TransactionSearchProps>(({
  rawTransactions,
  onAddToIncome,
  onAddToExpenses,
}, ref) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(
    new Set()
  );
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Search term required",
        description: "Please enter a search term",
        variant: "destructive",
      });
      return;
    }

    if (!rawTransactions || rawTransactions.length === 0) {
      toast({
        title: "No transactions to search",
        description: "Please upload and extract a document first",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch("/api/search-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerm: searchTerm.trim(),
          transactions: rawTransactions,
        }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const results: SearchResult = await response.json();
      setSearchResults(results);
      setSelectedTransactions(new Set());

      toast({
        title: "Search completed",
        description: `Found ${results.matchCount} transactions matching "${searchTerm}"`,
      });
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: "Unable to search transactions",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleTransaction = (index: number) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTransactions(newSelected);
  };

  const selectAll = () => {
    if (!searchResults) return;
    const allIndices = searchResults.matchingTransactions.map(
      (_, index) => index
    );
    setSelectedTransactions(new Set(allIndices));
  };

  const clearSelection = () => {
    setSelectedTransactions(new Set());
  };

  const addSelectedAsIncome = () => {
    if (!searchResults || selectedTransactions.size === 0) return;

    const selectedTxns = Array.from(selectedTransactions).map(
      (index) => searchResults.matchingTransactions[index]
    );

    onAddToIncome(selectedTxns);
    toast({
      title: "Added to Income",
      description: `Added ${selectedTxns.length} transactions as income`,
    });
    setSelectedTransactions(new Set());
  };

  const addSelectedAsExpenses = () => {
    if (!searchResults || selectedTransactions.size === 0) return;

    const selectedTxns = Array.from(selectedTransactions).map(
      (index) => searchResults.matchingTransactions[index]
    );

    onAddToExpenses(selectedTxns);
    toast({
      title: "Added to Expenses",
      description: `Added ${selectedTxns.length} transactions as expenses`,
    });
    setSelectedTransactions(new Set());
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Transaction Search
        </CardTitle>
        <div className="flex gap-2">
          <Input
            ref={ref}
            placeholder="Search transactions (e.g., UBER, fuel, tolls...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </div>
        {rawTransactions && (
          <p className="text-sm text-muted-foreground">
            {rawTransactions.length} total transactions available to search
          </p>
        )}
      </CardHeader>

      {searchResults && (
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  {searchResults.matchCount} matches for "
                  {searchResults.searchTerm}"
                </Badge>
                {selectedTransactions.size > 0 && (
                  <Badge variant="secondary">
                    {selectedTransactions.size} selected
                  </Badge>
                )}
              </div>

              {searchResults.matchCount > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    Clear
                  </Button>
                  {selectedTransactions.size > 0 && (
                    <>
                      <Button
                        size="sm"
                        onClick={addSelectedAsIncome}
                        className="bg-emerald-500 hover:bg-emerald-600"
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Add as Income
                      </Button>
                      <Button
                        size="sm"
                        onClick={addSelectedAsExpenses}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        <TrendingDown className="h-4 w-4 mr-1" />
                        Add as Expenses
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {searchResults.matchCount > 0 ? (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.matchingTransactions.map(
                      (transaction, index) => (
                        <TableRow
                          key={index}
                          className={
                            selectedTransactions.has(index)
                              ? "bg-blue-500/10 border-blue-500/20"
                              : "hover:bg-muted/50"
                          }
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedTransactions.has(index)}
                              onChange={() => toggleTransaction(index)}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell>{transaction.date}</TableCell>
                          <TableCell className="font-medium">
                            {transaction.description}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              transaction.amount > 0 ? "text-emerald-500" : ""
                            }`}
                          >
                            {formatCurrency(transaction.amount)}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions found matching "{searchResults.searchTerm}"
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
});

TransactionSearch.displayName = "TransactionSearch";

export default TransactionSearch;
