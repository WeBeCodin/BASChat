"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, DollarSignIcon, InfoIcon, AlertTriangleIcon } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import type { Transaction } from '@/ai/schemas';

interface BasReportProps {
  transactions: Transaction[];
}

interface GstCalculation {
  g1TotalSales: number;
  g1aGstOnSales: number;
  g11TotalPurchases: number;
  g11bGstOnPurchases: number;
  netGstPayable: number;
}

interface BasSummary {
  income: {
    businessIncome: number;
    tipsAndBonuses: number;
    total: number;
  };
  expenses: {
    deductible: number;
    nonDeductible: number;
    needsApportionment: number;
    total: number;
  };
  gst: GstCalculation;
}

export function BasReport({ transactions }: BasReportProps) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // Default to last 3 months
    return format(date, 'yyyy-MM-dd');
  });
  
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!startDate || !endDate) return transactions;
    
    return transactions.filter(transaction => {
      try {
        const transactionDate = parseISO(transaction.date);
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        
        return isWithinInterval(transactionDate, { start, end });
      } catch (error) {
        console.warn('Invalid date format:', transaction.date);
        return false;
      }
    });
  }, [transactions, startDate, endDate]);

  // Calculate BAS summary
  const basSummary = useMemo((): BasSummary => {
    console.log('BAS Report - Transactions received:', transactions.length);
    console.log('BAS Report - Sample transactions:', transactions.slice(0, 3));
    console.log('BAS Report - Filtered transactions:', filteredTransactions.length);
    
    let businessIncome = 0;
    let tipsAndBonuses = 0;
    let deductibleExpenses = 0;
    let nonDeductibleExpenses = 0;
    let needsApportionmentExpenses = 0;

    filteredTransactions.forEach(transaction => {
      const amount = Math.abs(transaction.amount);
      console.log(`Processing transaction: ${transaction.description}, amount: ${amount}, category: ${transaction.category}, subCategory: ${transaction.subCategory}`);
      
      if (transaction.category === 'Income') {
        if (transaction.subCategory?.toLowerCase().includes('tip') || 
            transaction.subCategory?.toLowerCase().includes('bonus')) {
          tipsAndBonuses += amount;
        } else {
          businessIncome += amount;
        }
      } else if (transaction.category === 'Expenses') {
        deductibleExpenses += amount;
      } else if (transaction.category === 'Personal') {
        nonDeductibleExpenses += amount;
      } else if (transaction.category === 'Maybe') {
        needsApportionmentExpenses += amount;
      }
    });

    // GST Calculations (following Australian BAS requirements)
    const totalIncomeForGst = businessIncome; // Tips/bonuses typically not subject to GST
    const totalPurchasesForGst = deductibleExpenses;
    
    const g1TotalSales = totalIncomeForGst;
    const g1aGstOnSales = g1TotalSales / 11; // GST = 1/11th of GST-inclusive amount
    const g11TotalPurchases = totalPurchasesForGst;
    const g11bGstOnPurchases = g11TotalPurchases / 11;
    const netGstPayable = g1aGstOnSales - g11bGstOnPurchases;

    console.log('BAS Calculation Results:', {
      businessIncome,
      tipsAndBonuses,
      deductibleExpenses,
      nonDeductibleExpenses,
      needsApportionmentExpenses,
      g1TotalSales,
      g1aGstOnSales,
      g11TotalPurchases,
      g11bGstOnPurchases,
      netGstPayable
    });

    return {
      income: {
        businessIncome,
        tipsAndBonuses,
        total: businessIncome + tipsAndBonuses
      },
      expenses: {
        deductible: deductibleExpenses,
        nonDeductible: nonDeductibleExpenses,
        needsApportionment: needsApportionmentExpenses,
        total: deductibleExpenses + nonDeductibleExpenses + needsApportionmentExpenses
      },
      gst: {
        g1TotalSales,
        g1aGstOnSales,
        g11TotalPurchases,
        g11bGstOnPurchases,
        netGstPayable
      }
    };
  }, [filteredTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  // Group transactions for detailed breakdown
  const expensesByCategory = useMemo(() => {
    const categoryMap = new Map<string, { amount: number; count: number; items: Transaction[] }>();
    
    filteredTransactions.forEach(transaction => {
      if (transaction.category === 'Expenses' || transaction.category === 'Maybe' || transaction.category === 'Personal') {
        const category = transaction.subCategory || 'Uncategorized';
        const existing = categoryMap.get(category) || { amount: 0, count: 0, items: [] };
        categoryMap.set(category, {
          amount: existing.amount + Math.abs(transaction.amount),
          count: existing.count + 1,
          items: [...existing.items, transaction]
        });
      }
    });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      {/* Empty State Message */}
      {transactions.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <DollarSignIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">BAS Report Ready to Generate</h3>
            <p className="text-muted-foreground mb-4">
              Your BAS report will automatically appear here once you upload and categorize your financial documents.
            </p>
            <p className="text-sm text-muted-foreground">
              📄 Upload PDF documents → 🤖 AI categorizes transactions → 📊 Reports generated automatically
            </p>
          </CardContent>
        </Card>
      )}

      {/* Show report only when there are transactions */}
      {transactions.length > 0 && (
        <>
          {/* Header with Date Range Selection */}
          <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSignIcon className="h-5 w-5" />
                Business Activity Statement (BAS) Report
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Australian BAS-compliant reporting with GST calculations
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-col space-y-1">
                <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-40"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <Label htmlFor="end-date" className="text-xs">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-40"
                />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Critical BAS Warnings */}
      {(basSummary.expenses.needsApportionment > 0 || basSummary.expenses.nonDeductible > 0) && (
        <Alert>
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Action Required:</strong> {basSummary.expenses.needsApportionment > 0 && `${formatCurrency(basSummary.expenses.needsApportionment)} in expenses need apportionment for business use percentage. `}
            {basSummary.expenses.nonDeductible > 0 && `${formatCurrency(basSummary.expenses.nonDeductible)} in non-deductible expenses identified (e.g., fines, personal purchases).`}
          </AlertDescription>
        </Alert>
      )}

      {/* BAS Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">G1 - Total Sales</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(basSummary.gst.g1TotalSales)}
                </p>
                <p className="text-xs text-muted-foreground">GST-applicable income</p>
              </div>
              <TrendingUpIcon className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">1A - GST on Sales</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(basSummary.gst.g1aGstOnSales)}
                </p>
                <p className="text-xs text-muted-foreground">GST collected</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                1A
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">1B - GST on Purchases</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(basSummary.gst.g11bGstOnPurchases)}
                </p>
                <p className="text-xs text-muted-foreground">GST paid</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-orange-600 flex items-center justify-center text-white text-sm font-bold">
                1B
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net GST</p>
                <p className={`text-2xl font-bold ${basSummary.gst.netGstPayable >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(basSummary.gst.netGstPayable))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {basSummary.gst.netGstPayable >= 0 ? 'Payable' : 'Refund'}
                </p>
              </div>
              <DollarSignIcon className={`h-8 w-8 ${basSummary.gst.netGstPayable >= 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income and Expense Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Income Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Business Income (GST-applicable)</p>
                  <p className="text-sm text-muted-foreground">Used in G1 calculation</p>
                </div>
                <p className="font-bold text-green-600">{formatCurrency(basSummary.income.businessIncome)}</p>
              </div>
              
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Tips & Bonuses</p>
                  <p className="text-sm text-muted-foreground">Usually non-GST</p>
                </div>
                <p className="font-bold text-blue-600">{formatCurrency(basSummary.income.tipsAndBonuses)}</p>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center font-bold">
                <span>Total Income</span>
                <span className="text-green-600">{formatCurrency(basSummary.income.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Expense Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Deductible Business Expenses</p>
                  <p className="text-sm text-muted-foreground">Used in GST calculation</p>
                </div>
                <p className="font-bold text-green-600">{formatCurrency(basSummary.expenses.deductible)}</p>
              </div>
              
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Needs Apportionment</p>
                  <p className="text-sm text-muted-foreground">Requires business % review</p>
                </div>
                <p className="font-bold text-yellow-600">{formatCurrency(basSummary.expenses.needsApportionment)}</p>
              </div>
              
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Non-Deductible</p>
                  <p className="text-sm text-muted-foreground">Fines, personal expenses</p>
                </div>
                <p className="font-bold text-red-600">{formatCurrency(basSummary.expenses.nonDeductible)}</p>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center font-bold">
                <span>Total Expenses</span>
                <span className="text-red-600">{formatCurrency(basSummary.expenses.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Expense Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {expensesByCategory.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{item.category}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.count} transaction{item.count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">{formatCurrency(item.amount)}</p>
                  <Badge variant={
                    item.items[0]?.category === 'Personal' ? 'destructive' :
                    item.items[0]?.category === 'Maybe' ? 'secondary' : 'default'
                  }>
                    {item.items[0]?.category === 'Personal' ? 'Non-deductible' :
                     item.items[0]?.category === 'Maybe' ? 'Needs Review' : 'Deductible'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* BAS Disclaimer */}
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> This BAS report is for informational purposes only. Please consult with a registered tax agent or accountant before lodging your BAS. Ensure you have proper tax invoices for all GST claims and have calculated correct business use percentages for apportioned expenses.
        </AlertDescription>
      </Alert>
        </>
      )}
    </div>
  );
}
