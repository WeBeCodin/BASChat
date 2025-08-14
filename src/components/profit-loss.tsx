"use client"

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CalendarIcon, Download, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Transaction } from '@/ai/schemas'

interface ProfitLossProps {
  transactions: Transaction[]
}

export function ProfitLoss({ transactions }: ProfitLossProps) {
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [reportPeriod, setReportPeriod] = useState<string>("current-quarter")

  // Set date ranges based on selected period
  const handlePeriodChange = (period: string) => {
    setReportPeriod(period)
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const currentQuarter = Math.floor(currentMonth / 3)

    switch (period) {
      case "current-month":
        setDateFrom(new Date(currentYear, currentMonth, 1))
        setDateTo(new Date(currentYear, currentMonth + 1, 0))
        break
      case "current-quarter":
        setDateFrom(new Date(currentYear, currentQuarter * 3, 1))
        setDateTo(new Date(currentYear, currentQuarter * 3 + 3, 0))
        break
      case "current-year":
        setDateFrom(new Date(currentYear, 0, 1))
        setDateTo(new Date(currentYear, 11, 31))
        break
      case "previous-year":
        setDateFrom(new Date(currentYear - 1, 0, 1))
        setDateTo(new Date(currentYear - 1, 11, 31))
        break
      case "ytd":
        setDateFrom(new Date(currentYear, 0, 1))
        setDateTo(now)
        break
      case "custom":
        // Keep existing dates for custom range
        break
    }
  }

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!dateFrom || !dateTo) return transactions

    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date)
      return transactionDate >= dateFrom && transactionDate <= dateTo
    })
  }, [transactions, dateFrom, dateTo])

  // Calculate income and expense totals by category
  const financialSummary = useMemo(() => {
    const income: { [key: string]: { total: number; count: number; subcategories: { [key: string]: number } } } = {}
    const expenses: { [key: string]: { total: number; count: number; subcategories: { [key: string]: number } } } = {}

    filteredTransactions.forEach(transaction => {
      const amount = Math.abs(transaction.amount)
      const category = transaction.category || 'Uncategorized'
      const subcategory = transaction.subcategory || 'General'

      if (transaction.amount > 0) {
        // Income
        if (!income[category]) {
          income[category] = { total: 0, count: 0, subcategories: {} }
        }
        income[category].total += amount
        income[category].count += 1
        income[category].subcategories[subcategory] = (income[category].subcategories[subcategory] || 0) + amount
      } else {
        // Expense
        if (!expenses[category]) {
          expenses[category] = { total: 0, count: 0, subcategories: {} }
        }
        expenses[category].total += amount
        expenses[category].count += 1
        expenses[category].subcategories[subcategory] = (expenses[category].subcategories[subcategory] || 0) + amount
      }
    })

    const totalIncome = Object.values(income).reduce((sum, cat) => sum + cat.total, 0)
    const totalExpenses = Object.values(expenses).reduce((sum, cat) => sum + cat.total, 0)
    const netProfit = totalIncome - totalExpenses

    return {
      income,
      expenses,
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        netProfit,
        profitMargin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0
      }
    }
  }, [filteredTransactions])

  const exportReport = () => {
    const reportData = {
      period: `${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'N/A'} - ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'N/A'}`,
      summary: financialSummary.totals,
      income: financialSummary.income,
      expenses: financialSummary.expenses,
      transactionCount: filteredTransactions.length
    }

    const dataStr = JSON.stringify(reportData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `P&L-Report-${format(new Date(), 'yyyy-MM-dd')}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount)
  }

  const getPercentageOfTotal = (amount: number, total: number) => {
    return total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Profit & Loss Report</h2>
          <p className="text-muted-foreground">
            Comprehensive financial performance analysis
          </p>
        </div>
        <Button onClick={exportReport} className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Date Range Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
          <CardDescription>Select the time period for your P&L analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="period">Quick Periods</Label>
              <Select value={reportPeriod} onValueChange={handlePeriodChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-month">Current Month</SelectItem>
                  <SelectItem value="current-quarter">Current Quarter</SelectItem>
                  <SelectItem value="current-year">Current Year</SelectItem>
                  <SelectItem value="previous-year">Previous Year</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1 min-w-[150px]">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredTransactions.length} transactions 
            {dateFrom && dateTo && (
              <> from {format(dateFrom, 'dd/MM/yyyy')} to {format(dateTo, 'dd/MM/yyyy')}</>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(financialSummary.totals.income)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(financialSummary.totals.expenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className={cn(
              "h-4 w-4",
              financialSummary.totals.netProfit >= 0 ? "text-green-600" : "text-red-600"
            )} />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              financialSummary.totals.netProfit >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(financialSummary.totals.netProfit)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <BarChart3 className={cn(
              "h-4 w-4",
              financialSummary.totals.profitMargin >= 0 ? "text-green-600" : "text-red-600"
            )} />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              financialSummary.totals.profitMargin >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {financialSummary.totals.profitMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Income Breakdown</CardTitle>
          <CardDescription>Revenue by category and subcategory</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(financialSummary.income).length === 0 ? (
            <p className="text-muted-foreground">No income transactions in selected period</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(financialSummary.income)
                .sort(([,a], [,b]) => b.total - a.total)
                .map(([category, data]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          ({data.count} transactions)
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          {formatCurrency(data.total)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getPercentageOfTotal(data.total, financialSummary.totals.income)}% of total
                        </div>
                      </div>
                    </div>
                    
                    {Object.keys(data.subcategories).length > 1 && (
                      <div className="ml-4 space-y-1">
                        {Object.entries(data.subcategories)
                          .sort(([,a], [,b]) => b - a)
                          .map(([subcategory, amount]) => (
                            <div key={subcategory} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">• {subcategory}</span>
                              <span>{formatCurrency(amount)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Expense Breakdown</CardTitle>
          <CardDescription>Costs by category and subcategory</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(financialSummary.expenses).length === 0 ? (
            <p className="text-muted-foreground">No expense transactions in selected period</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(financialSummary.expenses)
                .sort(([,a], [,b]) => b.total - a.total)
                .map(([category, data]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">{category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          ({data.count} transactions)
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-red-600">
                          {formatCurrency(data.total)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getPercentageOfTotal(data.total, financialSummary.totals.expenses)}% of total
                        </div>
                      </div>
                    </div>
                    
                    {Object.keys(data.subcategories).length > 1 && (
                      <div className="ml-4 space-y-1">
                        {Object.entries(data.subcategories)
                          .sort(([,a], [,b]) => b - a)
                          .map(([subcategory, amount]) => (
                            <div key={subcategory} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">• {subcategory}</span>
                              <span>{formatCurrency(amount)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
