const CategorizationService = require('../services/categorization');
const DynamoDBService = require('../services/dynamodb');

class TransactionProcessor {
  constructor() {
    this.categorization = new CategorizationService();
    this.dbService = new DynamoDBService();
  }

  async processTransaction(transaction) {
    console.log(`Processing transaction: ${transaction.id}`);
    
    try {
      const enrichedTransaction = await this.enrichTransaction(transaction);
      const processedTransaction = await this.applyBusinessRules(enrichedTransaction);
      
      return processedTransaction;
    } catch (error) {
      console.error(`Error processing transaction ${transaction.id}:`, error);
      throw error;
    }
  }

  async enrichTransaction(transaction) {
    const categorization = this.categorization.categorizeTransaction(transaction);
    
    const enriched = {
      ...transaction,
      category: categorization.category,
      subcategory: categorization.subcategory,
      categorization_confidence: categorization.confidence,
      processing_metadata: {
        processed_at: new Date().toISOString(),
        categorization_method: 'automatic',
        original_category: categorization.originalCategory,
        suggested_changes: categorization.suggestedChanges,
      }
    };

    const rules = this.categorization.processTransactionRules(enriched);
    if (rules.length > 0) {
      enriched.processing_metadata.rules_applied = rules;
    }

    return enriched;
  }

  async applyBusinessRules(transaction) {
    const rules = [
      this.validateTransactionAmount,
      this.detectDuplicateTransactions,
      this.flagLargeTransactions,
      this.categorizeIncomeTransactions,
      this.handleReceiptLineItems,
    ];

    let processedTransaction = { ...transaction };

    for (const rule of rules) {
      try {
        processedTransaction = await rule.call(this, processedTransaction);
      } catch (error) {
        console.error(`Error applying rule ${rule.name}:`, error);
        if (!processedTransaction.processing_metadata.errors) {
          processedTransaction.processing_metadata.errors = [];
        }
        processedTransaction.processing_metadata.errors.push({
          rule: rule.name,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return processedTransaction;
  }

  validateTransactionAmount(transaction) {
    if (typeof transaction.amount !== 'number' || isNaN(transaction.amount)) {
      throw new Error('Invalid transaction amount');
    }

    if (Math.abs(transaction.amount) > 10000) {
      if (!transaction.processing_metadata.flags) {
        transaction.processing_metadata.flags = [];
      }
      transaction.processing_metadata.flags.push({
        type: 'large_amount',
        message: 'Transaction amount exceeds $10,000',
        amount: transaction.amount,
      });
    }

    return transaction;
  }

  async detectDuplicateTransactions(transaction) {
    try {
      const similarTransactions = await this.findSimilarTransactions(transaction);
      
      if (similarTransactions.length > 0) {
        if (!transaction.processing_metadata.flags) {
          transaction.processing_metadata.flags = [];
        }
        
        transaction.processing_metadata.flags.push({
          type: 'potential_duplicate',
          message: `Found ${similarTransactions.length} similar transaction(s)`,
          similar_transactions: similarTransactions.map(t => ({
            id: t.id,
            date: t.date,
            amount: t.amount,
            merchant: t.merchant_name,
          })),
        });
      }
    } catch (error) {
      console.error('Error detecting duplicates:', error);
    }

    return transaction;
  }

  async findSimilarTransactions(transaction) {
    try {
      const startDate = new Date(transaction.date);
      startDate.setDate(startDate.getDate() - 3);
      const endDate = new Date(transaction.date);
      endDate.setDate(endDate.getDate() + 3);

      const recentTransactions = await this.dbService.getTransactions(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        50
      );

      return recentTransactions.filter(t => 
        t.id !== transaction.id &&
        Math.abs(t.amount - transaction.amount) < 0.01 &&
        (t.merchant_name === transaction.merchant_name || 
         this.calculateSimilarity(t.name || '', transaction.name || '') > 0.8)
      );
    } catch (error) {
      console.error('Error finding similar transactions:', error);
      return [];
    }
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  flagLargeTransactions(transaction) {
    const threshold = 500;
    
    if (Math.abs(transaction.amount) > threshold) {
      if (!transaction.processing_metadata.flags) {
        transaction.processing_metadata.flags = [];
      }
      
      transaction.processing_metadata.flags.push({
        type: 'large_transaction',
        message: `Transaction exceeds $${threshold} threshold`,
        amount: transaction.amount,
        requires_review: true,
      });
    }

    return transaction;
  }

  categorizeIncomeTransactions(transaction) {
    if (transaction.amount > 0) {
      transaction.category = ['Income'];
      transaction.subcategory = ['Deposit'];
      
      if (transaction.amount > 1000) {
        transaction.subcategory = ['Salary/Wages'];
      } else if (transaction.amount < 50) {
        transaction.subcategory = ['Interest/Refund'];
      }
      
      transaction.processing_metadata.income_classification = {
        type: 'automatic',
        confidence: 0.9,
      };
    }

    return transaction;
  }

  async handleReceiptLineItems(transaction) {
    if (transaction.source === 'receipt_ocr' && 
        transaction.raw_data?.lineItems && 
        transaction.raw_data.lineItems.length > 0) {
      
      const lineItems = transaction.raw_data.lineItems;
      const processedLineItems = [];

      for (let i = 0; i < lineItems.length; i++) {
        const lineItem = lineItems[i];
        
        if (lineItem.totalPrice > 0) {
          const lineItemTransaction = {
            id: `${transaction.id}_line_${i}`,
            parent_transaction_id: transaction.id,
            date: transaction.date,
            amount: -Math.abs(lineItem.totalPrice),
            merchant_name: transaction.merchant_name,
            name: lineItem.description || `Line Item ${i + 1}`,
            category: this.categorizeLineItem(lineItem, transaction),
            source: 'receipt_line_item',
            raw_data: {
              line_item_index: i,
              quantity: lineItem.quantity,
              unit_price: lineItem.unitPrice,
              description: lineItem.description,
              parent_receipt: transaction.raw_data.s3Key,
            },
          };

          processedLineItems.push(lineItemTransaction);
        }
      }

      if (processedLineItems.length > 0) {
        transaction.processing_metadata.line_items = {
          count: processedLineItems.length,
          total_amount: processedLineItems.reduce((sum, item) => sum + Math.abs(item.amount), 0),
        };
      }
    }

    return transaction;
  }

  categorizeLineItem(lineItem, parentTransaction) {
    const description = (lineItem.description || '').toLowerCase();
    
    if (description.includes('tax') || description.includes('fee')) {
      return ['Tax & Fees'];
    }
    
    if (description.includes('discount') || description.includes('coupon')) {
      return ['Discounts'];
    }
    
    return parentTransaction.category || ['Shopping'];
  }

  async processTransactionBatch(transactions) {
    const results = {
      processed: 0,
      errors: 0,
      flagged: 0,
      categorized: 0,
    };

    const batchSize = 10;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (transaction) => {
        try {
          const processed = await this.processTransaction(transaction);
          
          results.processed++;
          
          if (processed.processing_metadata.flags?.length > 0) {
            results.flagged++;
          }
          
          if (processed.categorization_confidence > 0.7) {
            results.categorized++;
          }
          
          return processed;
        } catch (error) {
          console.error(`Error processing transaction ${transaction.id}:`, error);
          results.errors++;
          return null;
        }
      });

      await Promise.all(batchPromises);
      
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transactions.length / batchSize)}`);
    }

    console.log('Batch processing complete:', results);
    return results;
  }
}

module.exports = TransactionProcessor;