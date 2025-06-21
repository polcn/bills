class CategorizationService {
  constructor() {
    this.categoryRules = {
      'Food and Drink': {
        keywords: [
          'restaurant', 'cafe', 'coffee', 'bar', 'diner', 'pizza', 'burger', 'food',
          'starbucks', 'mcdonalds', 'subway', 'chipotle', 'dominos', 'kfc',
          'grocery', 'market', 'supermarket', 'walmart', 'target', 'costco',
          'kroger', 'safeway', 'whole foods', 'trader joe', 'publix'
        ],
        subcategories: {
          'Restaurants': [
            'restaurant', 'cafe', 'coffee', 'bar', 'diner', 'pizza', 'burger',
            'starbucks', 'mcdonalds', 'subway', 'chipotle', 'dominos', 'kfc'
          ],
          'Groceries': [
            'grocery', 'market', 'supermarket', 'walmart', 'target', 'costco',
            'kroger', 'safeway', 'whole foods', 'trader joe', 'publix'
          ]
        }
      },
      'Transportation': {
        keywords: [
          'gas', 'fuel', 'shell', 'chevron', 'exxon', 'bp', 'mobil', '76',
          'uber', 'lyft', 'taxi', 'parking', 'metro', 'bus', 'train',
          'airline', 'flight', 'car rental', 'hertz', 'enterprise', 'avis'
        ],
        subcategories: {
          'Gas': ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'bp', 'mobil', '76'],
          'Rideshare': ['uber', 'lyft', 'taxi'],
          'Public Transit': ['metro', 'bus', 'train', 'parking'],
          'Travel': ['airline', 'flight', 'car rental', 'hertz', 'enterprise', 'avis']
        }
      },
      'Shopping': {
        keywords: [
          'amazon', 'ebay', 'best buy', 'apple store', 'microsoft', 'google',
          'store', 'shop', 'retail', 'mall', 'department', 'clothing',
          'home depot', 'lowes', 'ikea', 'bed bath', 'tj maxx', 'marshalls'
        ],
        subcategories: {
          'Online': ['amazon', 'ebay', 'apple store', 'microsoft', 'google'],
          'Electronics': ['best buy', 'apple store', 'microsoft'],
          'Home Improvement': ['home depot', 'lowes', 'ikea'],
          'General Merchandise': ['store', 'shop', 'retail', 'mall', 'department', 'tj maxx', 'marshalls']
        }
      },
      'Healthcare': {
        keywords: [
          'pharmacy', 'cvs', 'walgreens', 'rite aid', 'drug store',
          'hospital', 'clinic', 'doctor', 'dentist', 'medical', 'health'
        ],
        subcategories: {
          'Pharmacy': ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'drug store'],
          'Medical': ['hospital', 'clinic', 'doctor', 'dentist', 'medical', 'health']
        }
      },
      'Bills & Utilities': {
        keywords: [
          'electric', 'gas bill', 'water', 'internet', 'phone', 'cable',
          'netflix', 'spotify', 'subscription', 'insurance', 'mortgage', 'rent'
        ],
        subcategories: {
          'Utilities': ['electric', 'gas bill', 'water'],
          'Internet & Phone': ['internet', 'phone', 'cable'],
          'Subscriptions': ['netflix', 'spotify', 'subscription'],
          'Insurance': ['insurance'],
          'Housing': ['mortgage', 'rent']
        }
      },
      'Entertainment': {
        keywords: [
          'movie', 'theater', 'concert', 'music', 'game', 'sports',
          'netflix', 'spotify', 'hulu', 'disney', 'entertainment'
        ],
        subcategories: {
          'Streaming': ['netflix', 'spotify', 'hulu', 'disney'],
          'Events': ['movie', 'theater', 'concert', 'music', 'sports'],
          'Gaming': ['game']
        }
      }
    };

    this.merchantMappings = {
      'AMZN': 'Amazon',
      'AMAZON': 'Amazon',
      'STARBUCKS': 'Starbucks',
      'MCDONALDS': 'McDonalds',
      'WAL-MART': 'Walmart',
      'TARGET': 'Target',
      'CVS': 'CVS Pharmacy',
      'WALGREENS': 'Walgreens',
      'SHELL': 'Shell',
      'CHEVRON': 'Chevron',
      'EXXON': 'ExxonMobil',
    };
  }

  categorizeTransaction(transaction) {
    const merchantName = this.normalizeMerchantName(
      transaction.merchant_name || transaction.name || ''
    );
    
    const description = `${merchantName} ${transaction.name || ''}`.toLowerCase();
    
    let bestMatch = { category: ['General'], subcategory: ['Uncategorized'], confidence: 0 };

    for (const [category, rules] of Object.entries(this.categoryRules)) {
      for (const keyword of rules.keywords) {
        if (description.includes(keyword.toLowerCase())) {
          const subcategory = this.findSubcategory(keyword, rules.subcategories);
          const confidence = this.calculateConfidence(keyword, description);
          
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              category: [category],
              subcategory: [subcategory],
              confidence: confidence
            };
          }
        }
      }
    }

    if (bestMatch.confidence === 0) {
      const amountBasedCategory = this.categorizeByAmount(transaction.amount);
      if (amountBasedCategory) {
        bestMatch = amountBasedCategory;
      }
    }

    return {
      category: bestMatch.category,
      subcategory: bestMatch.subcategory,
      confidence: bestMatch.confidence,
      originalCategory: transaction.category,
      suggestedChanges: this.suggestCategoryChanges(transaction, bestMatch)
    };
  }

  normalizeMerchantName(merchantName) {
    const normalized = merchantName.toUpperCase().trim();
    
    for (const [pattern, replacement] of Object.entries(this.merchantMappings)) {
      if (normalized.includes(pattern)) {
        return replacement;
      }
    }

    return merchantName.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  findSubcategory(keyword, subcategories) {
    for (const [subcategory, keywords] of Object.entries(subcategories)) {
      if (keywords.includes(keyword)) {
        return subcategory;
      }
    }
    return 'General';
  }

  calculateConfidence(keyword, description) {
    const keywordLength = keyword.length;
    const descriptionLength = description.length;
    
    let confidence = Math.min(keywordLength / descriptionLength * 10, 1);
    
    if (description.startsWith(keyword)) {
      confidence += 0.3;
    }
    
    if (description.includes(keyword + ' ')) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1);
  }

  categorizeByAmount(amount) {
    const absAmount = Math.abs(amount);
    
    if (absAmount > 1000) {
      return {
        category: ['Bills & Utilities'],
        subcategory: ['Large Payment'],
        confidence: 0.3
      };
    }
    
    if (absAmount > 500) {
      return {
        category: ['Shopping'],
        subcategory: ['Large Purchase'],
        confidence: 0.2
      };
    }
    
    if (absAmount < 5) {
      return {
        category: ['Food and Drink'],
        subcategory: ['Coffee & Snacks'],
        confidence: 0.2
      };
    }
    
    return null;
  }

  suggestCategoryChanges(transaction, newCategory) {
    const suggestions = [];
    
    if (!transaction.category || transaction.category[0] === 'General') {
      suggestions.push({
        type: 'new_categorization',
        message: `Suggested category: ${newCategory.category[0]} > ${newCategory.subcategory[0]}`,
        confidence: newCategory.confidence
      });
    } else if (transaction.category[0] !== newCategory.category[0]) {
      suggestions.push({
        type: 'category_change',
        message: `Consider changing from "${transaction.category[0]}" to "${newCategory.category[0]}"`,
        confidence: newCategory.confidence
      });
    }
    
    return suggestions;
  }

  processTransactionRules(transaction) {
    const rules = [];
    
    if (transaction.amount > 0) {
      rules.push({
        type: 'income',
        message: 'This appears to be income or a refund',
        action: 'categorize_as_income'
      });
    }
    
    if (Math.abs(transaction.amount) > 500) {
      rules.push({
        type: 'large_transaction',
        message: 'Large transaction - may need review',
        action: 'flag_for_review'
      });
    }
    
    if (transaction.source === 'receipt_ocr' && transaction.raw_data?.lineItems?.length > 10) {
      rules.push({
        type: 'detailed_receipt',
        message: 'Receipt has many line items - good for detailed tracking',
        action: 'enable_line_item_tracking'
      });
    }
    
    const duplicates = this.findPotentialDuplicates(transaction);
    if (duplicates.length > 0) {
      rules.push({
        type: 'potential_duplicate',
        message: `Potential duplicate of ${duplicates.length} other transaction(s)`,
        action: 'review_duplicates'
      });
    }
    
    return rules;
  }

  findPotentialDuplicates(transaction) {
    return [];
  }

  generateMonthlyReport(transactions) {
    const report = {
      totalSpent: 0,
      totalIncome: 0,
      transactionCount: transactions.length,
      categoryBreakdown: {},
      sourceBreakdown: {},
      flaggedTransactions: [],
      suggestions: []
    };

    transactions.forEach(transaction => {
      const amount = Math.abs(transaction.amount);
      
      if (transaction.amount < 0) {
        report.totalSpent += amount;
      } else {
        report.totalIncome += amount;
      }

      const category = transaction.category?.[0] || 'Uncategorized';
      report.categoryBreakdown[category] = (report.categoryBreakdown[category] || 0) + amount;

      const source = transaction.source || 'unknown';
      report.sourceBreakdown[source] = (report.sourceBreakdown[source] || 0) + 1;

      if (amount > 500) {
        report.flaggedTransactions.push({
          id: transaction.id,
          amount: transaction.amount,
          merchant: transaction.merchant_name,
          reason: 'Large transaction'
        });
      }
    });

    report.suggestions = this.generateSpendingSuggestions(report);
    
    return report;
  }

  generateSpendingSuggestions(report) {
    const suggestions = [];
    const categories = Object.entries(report.categoryBreakdown)
      .sort(([,a], [,b]) => b - a);

    if (categories.length > 0) {
      const topCategory = categories[0];
      suggestions.push({
        type: 'top_spending_category',
        message: `Your highest spending category is ${topCategory[0]} ($${topCategory[1].toFixed(2)})`,
        recommendation: 'Consider setting a budget limit for this category'
      });
    }

    const foodSpending = report.categoryBreakdown['Food and Drink'] || 0;
    if (foodSpending > report.totalSpent * 0.3) {
      suggestions.push({
        type: 'high_food_spending',
        message: 'Food spending is over 30% of total expenses',
        recommendation: 'Consider meal planning or cooking at home more often'
      });
    }

    return suggestions;
  }
}

module.exports = CategorizationService;