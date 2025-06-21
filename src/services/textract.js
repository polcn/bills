const AWS = require('aws-sdk');

class TextractService {
  constructor() {
    this.textract = new AWS.Textract();
  }

  async analyzeExpense(s3Bucket, s3Key) {
    const params = {
      Document: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key,
        },
      },
    };

    try {
      console.log(`Analyzing expense document: s3://${s3Bucket}/${s3Key}`);
      const result = await this.textract.analyzeExpense(params).promise();
      return this.processTextractResponse(result);
    } catch (error) {
      console.error('Error analyzing expense with Textract:', error);
      throw error;
    }
  }

  processTextractResponse(textractResponse) {
    const documents = textractResponse.ExpenseDocuments || [];
    const processedReceipts = [];

    for (const document of documents) {
      const receipt = {
        summary: {},
        lineItems: [],
        vendorInfo: {},
        raw: document,
      };

      if (document.SummaryFields) {
        for (const field of document.SummaryFields) {
          const fieldType = field.Type?.Text?.toLowerCase();
          const fieldValue = field.ValueDetection?.Text;

          if (fieldType && fieldValue) {
            switch (fieldType) {
              case 'total':
              case 'amount_paid':
                receipt.summary.total = this.parseAmount(fieldValue);
                break;
              case 'subtotal':
                receipt.summary.subtotal = this.parseAmount(fieldValue);
                break;
              case 'tax':
                receipt.summary.tax = this.parseAmount(fieldValue);
                break;
              case 'vendor_name':
              case 'merchant_name':
                receipt.vendorInfo.name = fieldValue;
                break;
              case 'vendor_address':
                receipt.vendorInfo.address = fieldValue;
                break;
              case 'vendor_phone':
                receipt.vendorInfo.phone = fieldValue;
                break;
              case 'invoice_receipt_date':
              case 'date':
                receipt.summary.date = this.parseDate(fieldValue);
                break;
              case 'invoice_receipt_id':
              case 'receipt_id':
                receipt.summary.receiptId = fieldValue;
                break;
            }
          }
        }
      }

      if (document.LineItemGroups) {
        for (const group of document.LineItemGroups) {
          if (group.LineItems) {
            for (const lineItem of group.LineItems) {
              const item = {
                description: '',
                quantity: 1,
                unitPrice: 0,
                totalPrice: 0,
              };

              if (lineItem.LineItemExpenseFields) {
                for (const field of lineItem.LineItemExpenseFields) {
                  const fieldType = field.Type?.Text?.toLowerCase();
                  const fieldValue = field.ValueDetection?.Text;

                  if (fieldType && fieldValue) {
                    switch (fieldType) {
                      case 'item':
                      case 'product_code':
                        item.description = fieldValue;
                        break;
                      case 'quantity':
                        item.quantity = parseInt(fieldValue) || 1;
                        break;
                      case 'unit_price':
                        item.unitPrice = this.parseAmount(fieldValue);
                        break;
                      case 'price':
                      case 'amount':
                        item.totalPrice = this.parseAmount(fieldValue);
                        break;
                    }
                  }
                }
              }

              if (item.description || item.totalPrice > 0) {
                receipt.lineItems.push(item);
              }
            }
          }
        }
      }

      processedReceipts.push(receipt);
    }

    return processedReceipts;
  }

  parseAmount(amountString) {
    if (!amountString) return 0;
    
    const cleanAmount = amountString.replace(/[$,\s]/g, '');
    const amount = parseFloat(cleanAmount);
    
    return isNaN(amount) ? 0 : amount;
  }

  parseDate(dateString) {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        const formats = [
          /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
          /(\d{1,2})-(\d{1,2})-(\d{4})/,
          /(\d{4})-(\d{1,2})-(\d{1,2})/,
        ];

        for (const format of formats) {
          const match = dateString.match(format);
          if (match) {
            const [, part1, part2, part3] = match;
            if (part3.length === 4) {
              const testDate = new Date(`${part1}/${part2}/${part3}`);
              if (!isNaN(testDate.getTime())) {
                return testDate.toISOString().split('T')[0];
              }
            }
          }
        }
        return null;
      }
      
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
      return null;
    }
  }

  categorizeReceipt(vendorName, lineItems) {
    if (!vendorName && (!lineItems || lineItems.length === 0)) {
      return { category: ['General'], subcategory: ['Uncategorized'] };
    }

    const vendor = (vendorName || '').toLowerCase();
    
    const categories = {
      grocery: {
        keywords: ['grocery', 'market', 'food', 'supermarket', 'walmart', 'target', 'costco', 'kroger', 'safeway'],
        category: ['Food and Drink'],
        subcategory: ['Groceries'],
      },
      restaurant: {
        keywords: ['restaurant', 'cafe', 'coffee', 'bar', 'diner', 'pizza', 'burger', 'starbucks', 'mcdonalds'],
        category: ['Food and Drink'],
        subcategory: ['Restaurants'],
      },
      gas: {
        keywords: ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'bp', 'mobil'],
        category: ['Transportation'],
        subcategory: ['Gas'],
      },
      pharmacy: {
        keywords: ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'drug store'],
        category: ['Healthcare'],
        subcategory: ['Pharmacy'],
      },
      retail: {
        keywords: ['store', 'shop', 'retail', 'amazon', 'ebay', 'best buy'],
        category: ['Shopping'],
        subcategory: ['General Merchandise'],
      },
    };

    for (const [type, config] of Object.entries(categories)) {
      if (config.keywords.some(keyword => vendor.includes(keyword))) {
        return {
          category: config.category,
          subcategory: config.subcategory,
        };
      }
    }

    return { category: ['General'], subcategory: ['Uncategorized'] };
  }
}

module.exports = TextractService;