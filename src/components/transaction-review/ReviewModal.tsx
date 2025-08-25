import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2, Edit3, DollarSign, Calendar, X } from "lucide-react";
import { Transaction } from "@/ai/schemas";
import { ValidationResult } from "@/services/validation-service";
import { TransactionGroup } from "./TransactionGroupCard";

export interface TransactionUpdate {
  transactionId: string;
  changes: Partial<Transaction>;
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: TransactionGroup | null;
  validationResults?: Map<string, ValidationResult[]>;
  onApproveTransaction: (transactionId: string) => void;
  onRejectTransaction: (transactionId: string) => void;
  onUpdateTransaction: (update: TransactionUpdate) => void;
  onBulkApprove: (transactionIds: string[]) => void;
  onBulkReject: (transactionIds: string[]) => void;
}

const EXPENSE_CATEGORIES = [
  "Office Expenses",
  "Motor Vehicle",
  "Travel",
  "Equipment",
  "Professional Services",
  "Insurance",
  "Utilities",
  "Rent",
  "Marketing",
  "Staff Costs",
  "Bank Fees",
  "Communications",
  "Cost of Goods Sold",
  "Repairs & Maintenance",
  "Training & Development",
];

const INCOME_CATEGORIES = [
  "Business Income",
  "Sales Revenue",
  "Service Income",
  "Interest Income",
  "Other Income",
];

export function ReviewModal({
  isOpen,
  onClose,
  group,
  validationResults,
  onApproveTransaction,
  onRejectTransaction,
  onUpdateTransaction,
  onBulkApprove,
  onBulkReject,
}: ReviewModalProps) {
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const getTransactionId = (transaction: Transaction) => {
    return `${transaction.date}-${transaction.description}-${transaction.amount}`;
  };

  const getValidationIssues = (transaction: Transaction): ValidationResult[] => {
    const transactionId = getTransactionId(transaction);
    return validationResults?.get(transactionId) || [];
  };

  const getSeverityColor = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleSelectTransaction = (transactionId: string, selected: boolean) => {
    const newSelected = new Set(selectedTransactions);
    if (selected) {
      newSelected.add(transactionId);
    } else {
      newSelected.delete(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const allIds = group?.transactions.map(getTransactionId) || [];
      setSelectedTransactions(new Set(allIds));
    } else {
      setSelectedTransactions(new Set());
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(getTransactionId(transaction));
    setEditForm({
      category: transaction.category,
      subCategory: transaction.subCategory,
      description: transaction.description,
      amount: transaction.amount,
    });
  };

  const handleSaveEdit = () => {
    if (editingTransaction && Object.keys(editForm).length > 0) {
      onUpdateTransaction({
        transactionId: editingTransaction,
        changes: editForm,
      });
      setEditingTransaction(null);
      setEditForm({});
    }
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setEditForm({});
  };

  const selectedCount = selectedTransactions.size;
  const totalTransactions = group?.transactions.length || 0;
  const allSelected = selectedCount === totalTransactions && totalTransactions > 0;

  if (!group) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Review {group.category} Transactions
            <Badge variant="outline" className="ml-2">
              {group.transactions.length} transaction{group.transactions.length !== 1 ? 's' : ''}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Summary */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium text-muted-foreground">Total Amount</div>
                <div className="text-lg font-semibold text-primary">
                  {formatCurrency(group.totalAmount)}
                </div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Avg Confidence</div>
                <div className="text-lg font-semibold">
                  {Math.round(group.avgConfidence * 100)}%
                </div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Validation Issues</div>
                <div className="text-lg font-semibold text-orange-600">
                  {group.validationIssues}
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                id="select-all"
              />
              <Label htmlFor="select-all" className="text-sm font-medium">
                Select All ({selectedCount}/{totalTransactions})
              </Label>
            </div>
            
            {selectedCount > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onBulkApprove(Array.from(selectedTransactions));
                    setSelectedTransactions(new Set());
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve ({selectedCount})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onBulkReject(Array.from(selectedTransactions));
                    setSelectedTransactions(new Set());
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Reject ({selectedCount})
                </Button>
              </div>
            )}
          </div>

          {/* Transactions List */}
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {group.transactions.map((transaction, index) => {
                const transactionId = getTransactionId(transaction);
                const isSelected = selectedTransactions.has(transactionId);
                const isEditing = editingTransaction === transactionId;
                const validationIssues = getValidationIssues(transaction);
                const hasIssues = validationIssues.length > 0;

                return (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg transition-all ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border'
                    } ${hasIssues ? 'border-orange-200 bg-orange-50/30' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectTransaction(transactionId, checked === true)}
                        className="mt-1"
                      />
                      
                      <div className="flex-1 space-y-3">
                        {/* Transaction Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="font-medium">{transaction.description}</div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {transaction.date}
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                {formatCurrency(transaction.amount)}
                              </div>
                              {transaction.confidence && (
                                <div>
                                  {Math.round(transaction.confidence * 100)}% confidence
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {transaction.category}
                              {transaction.subCategory && ` • ${transaction.subCategory}`}
                            </Badge>
                            {!isEditing && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditTransaction(transaction)}
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Validation Issues */}
                        {hasIssues && (
                          <div className="space-y-2">
                            {validationIssues.map((issue, issueIndex) => (
                              <div
                                key={issueIndex}
                                className={`p-3 rounded border text-sm ${getSeverityColor(issue.severity)}`}
                              >
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                  <div className="space-y-1">
                                    <div className="font-medium">{issue.message}</div>
                                    {issue.suggestion && (
                                      <div className="text-xs opacity-80">
                                        Suggestion: {issue.suggestion}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Edit Form */}
                        {isEditing && (
                          <div className="space-y-3 p-3 bg-muted/50 rounded border">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="category">Category</Label>
                                <Select
                                  value={editForm.category || ''}
                                  onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Income">Income</SelectItem>
                                    <SelectItem value="Expenses">Expenses</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label htmlFor="subCategory">Sub Category</Label>
                                <Select
                                  value={editForm.subCategory || ''}
                                  onValueChange={(value) => setEditForm(prev => ({ ...prev, subCategory: value }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select sub category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(editForm.category === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="description">Description</Label>
                              <Input
                                id="description"
                                value={editForm.description || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                              />
                            </div>

                            <div>
                              <Label htmlFor="amount">Amount</Label>
                              <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                value={editForm.amount || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveEdit}>
                                Save Changes
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Individual Actions */}
                        {!isEditing && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onApproveTransaction(transactionId)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onRejectTransaction(transactionId)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {selectedCount > 0 && (
            <>
              <Button
                onClick={() => {
                  onBulkApprove(Array.from(selectedTransactions));
                  setSelectedTransactions(new Set());
                  onClose();
                }}
              >
                Approve Selected ({selectedCount})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}