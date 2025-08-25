import { Transaction } from "@/ai/schemas";

export interface ValidationRule {
  id: string;
  name: string;
  industry?: string;
  severity: 'error' | 'warning' | 'info';
  validate: (transaction: Transaction) => ValidationResult | null;
}

export interface ValidationResult {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  action: 'approve' | 'reject' | 'edit' | 'bulk_approve' | 'bulk_reject' | 'categorize';
  entityType: 'transaction' | 'batch';
  entityId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DuplicateGroup {
  id: string;
  transactions: Transaction[];
  confidence: number;
  reason: string;
}

export class ValidationService {
  private rules: ValidationRule[] = [];
  private auditLog: AuditLogEntry[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules() {
    // GST Validation Rules
    this.rules.push({
      id: 'gst-calculation',
      name: 'GST Calculation Check',
      severity: 'error',
      validate: (transaction) => {
        if (transaction.amount > 100 && transaction.category === 'Expenses') {
          const expectedGst = Math.round((transaction.amount / 11) * 100) / 100;
          const description = transaction.description.toLowerCase();
          
          // Check if GST amount seems incorrect based on 1/11 rule
          if (description.includes('gst') || description.includes('tax')) {
            const gstMatch = description.match(/gst[:\s]*\$?(\d+\.?\d*)/);
            if (gstMatch) {
              const declaredGst = parseFloat(gstMatch[1]);
              const difference = Math.abs(declaredGst - expectedGst);
              
              if (difference > 1) {
                return {
                  ruleId: 'gst-calculation',
                  severity: 'error',
                  message: `GST amount may be incorrect. Expected: $${expectedGst.toFixed(2)}, Found: $${declaredGst.toFixed(2)}`,
                  suggestion: `Verify GST calculation using 1/11 rule: $${transaction.amount} ÷ 11 = $${expectedGst.toFixed(2)}`
                };
              }
            }
          }
        }
        return null;
      }
    });

    // Trucking Industry Rules
    this.rules.push({
      id: 'fuel-tax-credit',
      name: 'Fuel Tax Credit Validation',
      industry: 'trucking',
      severity: 'info',
      validate: (transaction) => {
        const description = transaction.description.toLowerCase();
        if ((description.includes('fuel') || description.includes('diesel') || description.includes('petrol')) 
            && transaction.category === 'Expenses') {
          
          // Extract litre information
          const litreMatch = description.match(/(\d+\.?\d*)\s*(l|litre|liter)/i);
          if (litreMatch) {
            const litres = parseFloat(litreMatch[1]);
            const ftcRate = 0.469; // Current FTC rate per litre for heavy vehicles
            const estimatedFtc = litres * ftcRate;
            
            return {
              ruleId: 'fuel-tax-credit',
              severity: 'info',
              message: `Potential Fuel Tax Credit: ${litres}L × $${ftcRate} = $${estimatedFtc.toFixed(2)}`,
              suggestion: 'Consider claiming Fuel Tax Credit if using fuel for business purposes',
              metadata: { litres, ftcRate, estimatedFtc }
            };
          }
        }
        return null;
      }
    });

    // NDIS Rules
    this.rules.push({
      id: 'ndis-gst-exempt',
      name: 'NDIS GST Exemption',
      industry: 'ndis',
      severity: 'warning',
      validate: (transaction) => {
        const description = transaction.description.toLowerCase();
        if ((description.includes('ndis') || description.includes('plan manager')) 
            && transaction.category === 'Income') {
          
          // NDIS services should be GST-free
          if (description.includes('gst') || description.includes('+gst')) {
            return {
              ruleId: 'ndis-gst-exempt',
              severity: 'warning',
              message: 'NDIS services are GST-free - GST should not be charged',
              suggestion: 'Remove GST from NDIS service transactions'
            };
          }
        }
        return null;
      }
    });

    // Construction Industry Rules
    this.rules.push({
      id: 'subcontractor-abn',
      name: 'Subcontractor ABN Required',
      industry: 'construction',
      severity: 'warning',
      validate: (transaction) => {
        const description = transaction.description.toLowerCase();
        if (transaction.amount > 50 && transaction.category === 'Expenses' &&
            (description.includes('labour') || description.includes('subcontractor') || description.includes('contractor'))) {
          
          // Check if ABN is mentioned
          if (!description.includes('abn') && !description.includes('australian business number')) {
            return {
              ruleId: 'subcontractor-abn',
              severity: 'warning',
              message: 'Subcontractor payments may require ABN for TPAR reporting',
              suggestion: 'Ensure you have the contractor\'s ABN for payments over $50'
            };
          }
        }
        return null;
      }
    });

    // High Value Transaction Rule
    this.rules.push({
      id: 'high-value-transaction',
      name: 'High Value Transaction Review',
      severity: 'warning',
      validate: (transaction) => {
        if (Math.abs(transaction.amount) > 10000) {
          return {
            ruleId: 'high-value-transaction',
            severity: 'warning',
            message: 'High value transaction requires additional review',
            suggestion: 'Consider implementing two-person approval process for transactions over $10,000'
          };
        }
        return null;
      }
    });

    // Duplicate Detection Rule
    this.rules.push({
      id: 'potential-duplicate',
      name: 'Potential Duplicate Transaction',
      severity: 'warning',
      validate: (transaction) => {
        // This will be implemented in the batch validation method
        return null;
      }
    });
  }

  validateTransaction(transaction: Transaction, industry?: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    for (const rule of this.rules) {
      // Skip industry-specific rules if they don't match
      if (rule.industry && industry && rule.industry !== industry) {
        continue;
      }
      
      const result = rule.validate(transaction);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  validateBatch(transactions: Transaction[], industry?: string): Map<string, ValidationResult[]> {
    const results = new Map<string, ValidationResult[]>();
    
    // First, validate each transaction individually
    transactions.forEach((transaction, index) => {
      const transactionId = `${transaction.date}-${transaction.description}-${transaction.amount}`;
      const validationResults = this.validateTransaction(transaction, industry);
      
      if (validationResults.length > 0) {
        results.set(transactionId, validationResults);
      }
    });
    
    // Then, check for duplicates across the batch
    const duplicates = this.findDuplicates(transactions);
    duplicates.forEach(group => {
      group.transactions.forEach(transaction => {
        const transactionId = `${transaction.date}-${transaction.description}-${transaction.amount}`;
        const existing = results.get(transactionId) || [];
        existing.push({
          ruleId: 'potential-duplicate',
          severity: 'warning',
          message: `Potential duplicate transaction (${group.confidence}% match)`,
          suggestion: group.reason,
          metadata: { duplicateGroupId: group.id, otherTransactions: group.transactions.length - 1 }
        });
        results.set(transactionId, existing);
      });
    });
    
    return results;
  }

  findDuplicates(transactions: Transaction[]): DuplicateGroup[] {
    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < transactions.length; i++) {
      if (processed.has(i)) continue;
      
      const duplicates = [transactions[i]];
      const baseTransaction = transactions[i];
      
      for (let j = i + 1; j < transactions.length; j++) {
        if (processed.has(j)) continue;
        
        const otherTransaction = transactions[j];
        const similarity = this.calculateSimilarity(baseTransaction, otherTransaction);
        
        if (similarity > 0.8) {
          duplicates.push(otherTransaction);
          processed.add(j);
        }
      }
      
      if (duplicates.length > 1) {
        duplicateGroups.push({
          id: `dup-${Date.now()}-${i}`,
          transactions: duplicates,
          confidence: Math.round(this.calculateGroupConfidence(duplicates) * 100),
          reason: this.getDuplicateReason(duplicates)
        });
      }
      
      processed.add(i);
    }
    
    return duplicateGroups;
  }

  private calculateSimilarity(t1: Transaction, t2: Transaction): number {
    let score = 0;
    let factors = 0;
    
    // Exact amount match
    if (t1.amount === t2.amount) {
      score += 0.4;
    } else if (Math.abs(t1.amount - t2.amount) / Math.max(Math.abs(t1.amount), Math.abs(t2.amount)) < 0.05) {
      score += 0.2;
    }
    factors += 0.4;
    
    // Date proximity
    const date1 = new Date(t1.date);
    const date2 = new Date(t2.date);
    const daysDiff = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      score += 0.3;
    } else if (daysDiff <= 2) {
      score += 0.15;
    }
    factors += 0.3;
    
    // Description similarity
    const desc1 = t1.description.toLowerCase().trim();
    const desc2 = t2.description.toLowerCase().trim();
    
    if (desc1 === desc2) {
      score += 0.3;
    } else {
      const words1 = new Set(desc1.split(/\s+/));
      const words2 = new Set(desc2.split(/\s+/));
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      const similarity = intersection.size / union.size;
      score += similarity * 0.3;
    }
    factors += 0.3;
    
    return score / factors;
  }

  private calculateGroupConfidence(transactions: Transaction[]): number {
    if (transactions.length < 2) return 0;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        totalSimilarity += this.calculateSimilarity(transactions[i], transactions[j]);
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private getDuplicateReason(transactions: Transaction[]): string {
    const reasons = [];
    
    // Check if all amounts are identical
    const amounts = [...new Set(transactions.map(t => t.amount))];
    if (amounts.length === 1) {
      reasons.push("identical amounts");
    }
    
    // Check if descriptions are similar
    const firstDesc = transactions[0].description.toLowerCase();
    const allSimilarDesc = transactions.every(t => 
      this.calculateSimilarity(transactions[0], t) > 0.7
    );
    if (allSimilarDesc) {
      reasons.push("similar descriptions");
    }
    
    // Check date proximity
    const dates = transactions.map(t => new Date(t.date));
    const maxDate = Math.max(...dates.map(d => d.getTime()));
    const minDate = Math.min(...dates.map(d => d.getTime()));
    const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 1) {
      reasons.push("same/consecutive dates");
    }
    
    return reasons.length > 0 ? reasons.join(", ") : "pattern similarity";
  }

  logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    
    this.auditLog.push(auditEntry);
    
    // In a real application, this would be persisted to a database
    console.log('[AUDIT]', auditEntry);
  }

  getAuditLog(entityId?: string, action?: string): AuditLogEntry[] {
    let filtered = this.auditLog;
    
    if (entityId) {
      filtered = filtered.filter(entry => entry.entityId === entityId);
    }
    
    if (action) {
      filtered = filtered.filter(entry => entry.action === action);
    }
    
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getValidationRules(industry?: string): ValidationRule[] {
    if (!industry) {
      return this.rules;
    }
    
    return this.rules.filter(rule => !rule.industry || rule.industry === industry);
  }
}

// Singleton instance
export const validationService = new ValidationService();