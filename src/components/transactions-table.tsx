'use client';

import type { Transaction } from '@/ai/schemas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart2, Plus, Minus, HelpCircle, Trash2, RefreshCw, Bot } from 'lucide-react';

type TransactionsTableProps = {
  transactions: Transaction[] | null;
  maybeTransactions?: Transaction[] | null;
  onApproveMaybeTransaction?: (index: number, category: "Income" | "Expenses") => void;
  onRemoveMaybeTransaction?: (index: number) => void;
  onDeleteTransaction?: (index: number) => void;
  onFlipTransactionCategory?: (index: number) => void;
  onChatAboutTransaction?: (transaction: Transaction) => void;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
};

export default function TransactionsTable({ 
  transactions, 
  maybeTransactions, 
  onApproveMaybeTransaction, 
  onRemoveMaybeTransaction,
  onDeleteTransaction,
  onFlipTransactionCategory,
  onChatAboutTransaction
}: TransactionsTableProps) {
  
  const getBadgeStyle = (category: string) => {
    switch (category) {
      case 'Income':
        return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20';
      case 'Maybe':
        return 'bg-orange-500/20 text-orange-500 border-orange-500/20';
      default:
        return 'bg-red-500/10 text-red-500 border-red-500/10';
    }
  };

  const getAmountStyle = (category: string) => {
    return category === 'Income' ? 'text-emerald-500' : '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 />
          Transactions
          {maybeTransactions && maybeTransactions.length > 0 && (
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
              {maybeTransactions.length} need review
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Categorized transactions */}
              {transactions && transactions.length > 0 ? (
                transactions.map((t, index) => (
                  <TableRow key={`categorized-${index}`}>
                    <TableCell>{t.date}</TableCell>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell>
                      <Badge
                        variant={t.category === 'Income' ? 'default' : 'secondary'}
                        className={getBadgeStyle(t.category)}
                      >
                        {t.subCategory || t.category}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${getAmountStyle(t.category)}`}
                    >
                      {formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onChatAboutTransaction?.(t)}
                          className="h-6 w-6 p-0 bg-green-500/10 hover:bg-green-500/20 border-green-500/20"
                          title="Ask AI about this transaction"
                        >
                          <Bot className="w-3 h-3 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onFlipTransactionCategory?.(index)}
                          className="h-6 w-6 p-0 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20"
                          title={`Change to ${t.category === 'Income' ? 'Expense' : 'Income'}`}
                        >
                          <RefreshCw className="w-3 h-3 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDeleteTransaction?.(index)}
                          className="h-6 w-6 p-0 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : null}
              
              {/* Maybe transactions that need review */}
              {maybeTransactions && maybeTransactions.length > 0 ? (
                maybeTransactions.map((t, index) => (
                  <TableRow key={`maybe-${index}`} className="bg-orange-50/50">
                    <TableCell>{t.date}</TableCell>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getBadgeStyle('Maybe')}
                      >
                        <HelpCircle className="w-3 h-3 mr-1" />
                        {t.subCategory || 'Needs Review'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-right font-semibold"
                    >
                      {formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onChatAboutTransaction?.(t)}
                          className="h-6 w-6 p-0 bg-green-500/10 hover:bg-green-500/20 border-green-500/20"
                          title="Ask AI about this transaction"
                        >
                          <Bot className="w-3 h-3 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onApproveMaybeTransaction?.(index, "Income")}
                          className="h-6 w-6 p-0 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20"
                          title="Approve as Income"
                        >
                          <Plus className="w-3 h-3 text-emerald-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onApproveMaybeTransaction?.(index, "Expenses")}
                          className="h-6 w-6 p-0 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                          title="Approve as Expense"
                        >
                          <Plus className="w-3 h-3 text-red-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRemoveMaybeTransaction?.(index)}
                          className="h-6 w-6 p-0 bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/20"
                          title="Remove transaction"
                        >
                          <Minus className="w-3 h-3 text-gray-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : null}
              
              {/* No transactions message */}
              {(!transactions || transactions.length === 0) && (!maybeTransactions || maybeTransactions.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
