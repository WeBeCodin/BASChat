import React from "react";
import { ChevronDown, AlertCircle, CheckCircle2, Edit3, DollarSign, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Transaction } from "@/ai/schemas";
import { ValidationResult } from "@/services/validation-service";

export interface TransactionGroup {
  id: string;
  category: string;
  subCategory?: string;
  transactions: Transaction[];
  totalAmount: number;
  avgConfidence: number;
  validationIssues: number;
  status: 'approved' | 'pending' | 'needs_review';
}

interface TransactionGroupCardProps {
  group: TransactionGroup;
  validationResults?: Map<string, ValidationResult[]>;
  onApproveAll: (groupId: string) => void;
  onRejectAll: (groupId: string) => void;
  onReviewGroup: (group: TransactionGroup) => void;
  onViewDetails: (group: TransactionGroup) => void;
}

export function TransactionGroupCard({
  group,
  validationResults,
  onApproveAll,
  onRejectAll,
  onReviewGroup,
  onViewDetails,
}: TransactionGroupCardProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600 bg-green-50 border-green-200";
    if (confidence >= 0.7) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <CheckCircle2 className="w-4 h-4" />;
    if (confidence >= 0.7) return <AlertCircle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Pending</Badge>;
      case 'needs_review':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Needs Review</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const hasValidationIssues = group.validationIssues > 0;
  const isIncome = group.category === 'Income';
  const AmountIcon = isIncome ? TrendingUp : TrendingDown;
  const amountColor = isIncome ? 'text-green-600' : 'text-blue-600';

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${hasValidationIssues ? 'border-orange-200 bg-orange-50/30' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              {group.category}
              {group.subCategory && (
                <span className="text-sm font-normal text-muted-foreground">
                  • {group.subCategory}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {group.transactions.length} transaction{group.transactions.length !== 1 ? 's' : ''}
              </div>
              <div className={`flex items-center gap-1 font-semibold ${amountColor}`}>
                <AmountIcon className="w-4 h-4" />
                {formatCurrency(group.totalAmount)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusBadge(group.status)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onApproveAll(group.id)}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRejectAll(group.id)}>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Reject All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onReviewGroup(group)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Review Group
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewDetails(group)}>
                  <DollarSign className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Confidence and Validation Status */}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getConfidenceColor(group.avgConfidence)}`}>
              {getConfidenceIcon(group.avgConfidence)}
              <span className="text-sm font-medium">
                {Math.round(group.avgConfidence * 100)}% confidence
              </span>
            </div>
            
            {hasValidationIssues && (
              <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                <AlertCircle className="w-3 h-3 mr-1" />
                {group.validationIssues} issue{group.validationIssues !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Quick Preview of Recent Transactions */}
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">Recent Transactions:</h4>
            {group.transactions.slice(0, 2).map((transaction, index) => (
              <div key={index} className="text-sm p-2 bg-muted/50 rounded">
                <div className="flex justify-between items-start">
                  <span className="font-medium truncate max-w-[200px]">
                    {transaction.description}
                  </span>
                  <span className={`font-semibold ${amountColor}`}>
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {transaction.date}
                  {transaction.confidence && (
                    <span className="ml-2">
                      • {Math.round(transaction.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {group.transactions.length > 2 && (
              <div className="text-xs text-muted-foreground text-center py-1">
                +{group.transactions.length - 2} more transaction{group.transactions.length - 2 !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewDetails(group)}
              className="flex-1"
            >
              View All ({group.transactions.length})
            </Button>
            
            {group.status === 'pending' || group.status === 'needs_review' ? (
              <Button
                size="sm"
                onClick={() => onReviewGroup(group)}
                className="flex-1"
              >
                <Edit3 className="w-4 h-4 mr-1" />
                Review
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onApproveAll(group.id)}
                className="flex-1"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approved
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}