"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, DollarSignIcon } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import type { Transaction } from '@/ai/schemas';

interface ProfitLossReportProps {
  transactions: Transaction[];
}

interface CategorySummary {
  name: string;
  amount: number;
  count: number;
}

interface ProfitLossData {
  income: CategorySummary[];
  expenses: CategorySummary[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
}

export function ProfitLossReport({ transactions }: ProfitLossReportProps) {
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

  // Calculate P&L data
  const profitLossData = useMemo((): ProfitLossData => {
    const incomeMap = new Map<string, { amount: number; count: number }>();
    const expenseMap = new Map<string, { amount: number; count: number }>();
    
    filteredTransactions.forEach(transaction => {
      const amount = Math.abs(transaction.amount);
      const subcategory = transaction.subCategory || 'Uncategorized';
      
      if (transaction.category === 'Income') {
        const existing = incomeMap.get(subcategory) || { amount: 0, count: 0 };
        incomeMap.set(subcategory, {
          amount: existing.amount + amount,
          count: existing.count + 1
        });
      } else if (transaction.category === 'Expenses') {
        const existing = expenseMap.get(subcategory) || { amount: 0, count: 0 };
        expenseMap.set(subcategory, {
          amount: existing.amount + amount,
          count: existing.count + 1
        });
      }
    });

    const income = Array.from(incomeMap.entries()).map(([name, data]) => ({
      name,
      amount: data.amount,
      count: data.count
    })).sort((a, b) => b.amount - a.amount);

    const expenses = Array.from(expenseMap.entries()).map(([name, data]) => ({
      name,
      amount: data.amount,
      count: data.count
    })).sort((a, b) => b.amount - a.amount);

    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
      income,
      expenses,
      totalIncome,
      totalExpenses,
      netProfit,
      profitMargin
    };
  }, [filteredTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selection */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSignIcon className="h-5 w-5" />
                Profit & Loss Report
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Comprehensive income and expense analysis for BAS reporting
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(profitLossData.totalIncome)}
                </p>
              </div>
              <TrendingUpIcon className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(profitLossData.totalExpenses)}
                </p>
              </div>
              <TrendingDownIcon className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                <p className={`text-2xl font-bold ${profitLossData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(profitLossData.netProfit)}
                </p>
              </div>
              <DollarSignIcon className={`h-8 w-8 ${profitLossData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Profit Margin</p>
                <p className={`text-2xl font-bold ${profitLossData.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(profitLossData.profitMargin)}
                </p>
              </div>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${profitLossData.profitMargin >= 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                %
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Income and Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Income Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profitLossData.income.length > 0 ? (
                profitLossData.income.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.count} transaction{item.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(item.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {profitLossData.totalIncome > 0 ? formatPercentage((item.amount / profitLossData.totalIncome) * 100) : '0%'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No income transactions found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expenses Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profitLossData.expenses.length > 0 ? (
                profitLossData.expenses.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.count} transaction{item.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{formatCurrency(item.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {profitLossData.totalExpenses > 0 ? formatPercentage((item.amount / profitLossData.totalExpenses) * 100) : '0%'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No expense transactions found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Period Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Reporting Period</p>
              <p className="font-medium">
                {format(parseISO(startDate), 'dd/MM/yyyy')} - {format(parseISO(endDate), 'dd/MM/yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="font-medium">{filteredTransactions.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Daily Profit</p>
              <p className={`font-medium ${profitLossData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(() => {
                  const days = Math.max(1, Math.ceil((parseISO(endDate).getTime() - parseISO(startDate).getTime()) / (1000 * 60 * 60 * 24)));
                  return formatCurrency(profitLossData.netProfit / days);
                })()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
