'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react';

type FinancialSummaryProps = {
  summary: {
    income: number;
    expenses: number;
    profit: number;
  } | null;
  bas: {
    g1: number;
    '1a': number;
    '1b': number;
  } | null;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
};

export default function FinancialSummary({ summary, bas }: FinancialSummaryProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.income ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.expenses ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.profit ?? 0)}</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText />
            Quarterly BAS Calculations
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-muted-foreground">G1: Total Sales</span>
            <span className="text-lg font-semibold">{formatCurrency(bas?.g1 ?? 0)}</span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-muted-foreground">1A: GST on sales</span>
            <span className="text-lg font-semibold">{formatCurrency(bas?.['1a'] ?? 0)}</span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-muted-foreground">1B: GST on purchases</span>
            <span className="text-lg font-semibold">{formatCurrency(bas?.['1b'] ?? 0)}</span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
