const AWS = require('aws-sdk');
const DynamoDBService = require('../services/dynamodb');
const TransactionProcessor = require('../utils/transactionProcessor');

const s3 = new AWS.S3();
const dbService = new DynamoDBService();
const processor = new TransactionProcessor();

exports.handler = async (event) => {
  console.log('CSV Processing event:', JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      if (record.eventSource === 'aws:s3' && record.eventName.startsWith('ObjectCreated')) {
        await processCSVFile(record);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'CSV processing completed' }),
    };
  } catch (error) {
    console.error('Error processing CSV:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function processCSVFile(record) {
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  
  console.log(`Processing CSV file: s3://${bucket}/${key}`);

  try {
    // Download file from S3
    const response = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    const csvContent = response.Body.toString('utf-8');
    
    // Determine bank type from filename or folder
    let bankType = 'unknown';
    if (key.toLowerCase().includes('amex') || key.toLowerCase().includes('american_express')) {
      bankType = 'amex';
    } else if (key.toLowerCase().includes('truist') || key.toLowerCase().includes('bb&t') || key.toLowerCase().includes('suntrust')) {
      bankType = 'truist';
    }
    
    console.log(`Detected bank type: ${bankType}`);
    
    // Parse CSV based on bank type
    const transactions = parseCSV(csvContent, bankType);
    console.log(`Parsed ${transactions.length} transactions`);
    
    // Process and save transactions
    let savedCount = 0;
    for (const transaction of transactions) {
      try {
        const processedTransaction = await processor.processTransaction(transaction);
        await dbService.saveTransaction(processedTransaction);
        savedCount++;
      } catch (error) {
        console.error(`Error saving transaction:`, error);
      }
    }
    
    console.log(`Successfully saved ${savedCount} transactions from ${key}`);
    
    // Optionally move processed file to a different folder
    const processedKey = key.replace('uploads/', 'processed/');
    await s3.copyObject({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: processedKey
    }).promise();
    
    await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
    
  } catch (error) {
    console.error(`Error processing CSV file ${key}:`, error);
    throw error;
  }
}

function parseCSV(csvContent, bankType) {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length <= 1) {
    throw new Error('CSV file appears to be empty or has no data rows');
  }
  
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const dataLines = lines.slice(1);
  
  console.log(`CSV headers: ${headers.join(', ')}`);
  
  switch (bankType) {
    case 'amex':
      return parseAmexCSV(headers, dataLines);
    case 'truist':
      return parseTruistCSV(headers, dataLines);
    default:
      return parseGenericCSV(headers, dataLines);
  }
}

function parseAmexCSV(headers, dataLines) {
  // Common AMEX CSV format:
  // Date, Description, Card Member, Account #, Amount, Extended Details, Appears On Your Statement As, Address, City/State, Zip Code, Country, Reference, Category
  
  const transactions = [];
  
  for (const line of dataLines) {
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length < 3) continue;
    
    try {
      const transaction = {
        id: `amex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: parseDate(values[0]),
        name: values[1] || 'Unknown Transaction',
        merchant_name: values[6] || values[1] || 'Unknown Merchant',
        amount: -Math.abs(parseFloat(values[4]) || 0), // AMEX shows positive as charges
        account_id: 'amex_manual',
        category: [values[12] || 'General'],
        subcategory: ['Manual Upload'],
        iso_currency_code: 'USD',
        location: {
          address: values[7],
          city: values[8],
          zip: values[9],
          country: values[10]
        },
        source: 'csv_amex',
        raw_data: {
          csv_line: values,
          extended_details: values[5],
          reference: values[11]
        }
      };
      
      if (transaction.date && transaction.amount !== 0) {
        transactions.push(transaction);
      }
    } catch (error) {
      console.error('Error parsing AMEX line:', line, error);
    }
  }
  
  return transactions;
}

function parseTruistCSV(headers, dataLines) {
  // Common Truist CSV format:
  // Account Type, Account Number, Date, Description, Debit, Credit, Running Balance
  
  const transactions = [];
  
  for (const line of dataLines) {
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length < 4) continue;
    
    try {
      const debit = parseFloat(values[4]) || 0;
      const credit = parseFloat(values[5]) || 0;
      const amount = credit > 0 ? credit : -debit;
      
      const transaction = {
        id: `truist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: parseDate(values[2]),
        name: values[3] || 'Unknown Transaction',
        merchant_name: values[3] || 'Unknown Merchant',
        amount: amount,
        account_id: 'truist_manual',
        category: ['General'],
        subcategory: ['Manual Upload'],
        iso_currency_code: 'USD',
        source: 'csv_truist',
        raw_data: {
          csv_line: values,
          account_type: values[0],
          account_number: values[1],
          running_balance: values[6]
        }
      };
      
      if (transaction.date && transaction.amount !== 0) {
        transactions.push(transaction);
      }
    } catch (error) {
      console.error('Error parsing Truist line:', line, error);
    }
  }
  
  return transactions;
}

function parseGenericCSV(headers, dataLines) {
  // Try to auto-detect common CSV formats
  const transactions = [];
  
  // Look for common column names
  const dateCol = findColumnIndex(headers, ['date', 'transaction date', 'posted date']);
  const descCol = findColumnIndex(headers, ['description', 'merchant', 'payee', 'transaction']);
  const amountCol = findColumnIndex(headers, ['amount', 'transaction amount']);
  const debitCol = findColumnIndex(headers, ['debit', 'withdrawal', 'charge']);
  const creditCol = findColumnIndex(headers, ['credit', 'deposit', 'payment']);
  
  if (dateCol === -1 || descCol === -1) {
    throw new Error('Could not identify date and description columns in CSV');
  }
  
  for (const line of dataLines) {
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length <= Math.max(dateCol, descCol)) continue;
    
    try {
      let amount = 0;
      
      if (amountCol !== -1) {
        amount = parseFloat(values[amountCol]) || 0;
      } else {
        const debit = debitCol !== -1 ? (parseFloat(values[debitCol]) || 0) : 0;
        const credit = creditCol !== -1 ? (parseFloat(values[creditCol]) || 0) : 0;
        amount = credit > 0 ? credit : -debit;
      }
      
      const transaction = {
        id: `generic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: parseDate(values[dateCol]),
        name: values[descCol] || 'Unknown Transaction',
        merchant_name: values[descCol] || 'Unknown Merchant',
        amount: amount,
        account_id: 'manual_upload',
        category: ['General'],
        subcategory: ['Manual Upload'],
        iso_currency_code: 'USD',
        source: 'csv_generic',
        raw_data: {
          csv_line: values,
          headers: headers
        }
      };
      
      if (transaction.date && transaction.amount !== 0) {
        transactions.push(transaction);
      }
    } catch (error) {
      console.error('Error parsing generic line:', line, error);
    }
  }
  
  return transactions;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result.map(val => val.replace(/^"|"$/g, ''));
}

function parseDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Try various date formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
      /(\d{1,2})-(\d{1,2})-(\d{4})/,   // MM-DD-YYYY
    ];
    
    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        const [, p1, p2, p3] = match;
        let year, month, day;
        
        if (p3.length === 4) { // Year is last
          year = p3;
          month = p1;
          day = p2;
        } else { // Year is first
          year = p1;
          month = p2;
          day = p3;
        }
        
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // Fallback to JavaScript Date parsing
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
}

function findColumnIndex(headers, searchTerms) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();
    for (const term of searchTerms) {
      if (header.includes(term.toLowerCase())) {
        return i;
      }
    }
  }
  return -1;
}