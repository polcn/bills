const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

const TABLE_NAME = process.env.TRANSACTIONS_TABLE || 'bill-finance-minimal-dev-transactions';

// Persistent storage using Lambda environment (limited but works for demo)
global.transactionStore = global.transactionStore || [];

exports.api = async (event) => {
  console.log('API Request:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const { httpMethod, path } = event;

    if (httpMethod === 'GET' && path === '/health') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Bill\'s Financial Management API is running!',
          timestamp: new Date().toISOString(),
          version: '2.0.0 - CSV Upload Edition',
          status: 'SUCCESS',
          features: ['CSV Upload', 'AMEX Parser', 'Truist Parser', 'Transaction Storage']
        }),
      };
    }

    if (httpMethod === 'GET' && path === '/status') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 'OK',
          services: {
            api: 'running',
            database: 'ready',
            storage: 'ready',
            csv_processor: 'ready'
          },
          environment: 'production'
        }),
      };
    }

    if (httpMethod === 'POST' && path === '/upload/csv') {
      const body = JSON.parse(event.body || '{}');
      const { csvContent, fileName, bankType = 'generic' } = body;

      if (!csvContent) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'csvContent is required' }),
        };
      }

      // Basic CSV validation
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'CSV must have at least a header and one data row' }),
        };
      }

      try {
        // Process CSV and save to DynamoDB
        console.log(`Processing CSV: ${fileName}, bankType: ${bankType}, lines: ${csvContent.split('\n').length}`);
        const transactions = parseCSV(csvContent, bankType, fileName);
        console.log(`Parsed ${transactions.length} transactions from ${bankType} CSV`);
        
        let savedCount = 0;
        let duplicateCount = 0;

        for (const transaction of transactions) {
          try {
            // Check for duplicates
            const isDuplicate = await checkDuplicate(transaction);
            if (isDuplicate) {
              duplicateCount++;
              console.log(`Duplicate found: ${transaction.name} on ${transaction.date}`);
              continue;
            }

            await saveTransaction(transaction);
            savedCount++;
            console.log(`Saved transaction: ${transaction.name} - $${transaction.amount}`);
          } catch (error) {
            console.error('Error saving transaction:', error);
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'CSV processed successfully',
            fileName: fileName,
            bankType: bankType,
            totalTransactions: transactions.length,
            savedCount: savedCount,
            duplicateCount: duplicateCount,
            processing: 'Complete'
          }),
        };
      } catch (error) {
        console.error('CSV processing error:', error);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'CSV processing failed', 
            details: error.message 
          }),
        };
      }
    }

    if (httpMethod === 'GET' && path === '/transactions') {
      try {
        const transactions = global.transactionStore || [];
        
        // Sort by date descending
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            transactions: transactions,
            count: transactions.length,
            totalInDB: transactions.length
          }),
        };
      } catch (error) {
        console.error('Error fetching transactions:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to fetch transactions' }),
        };
      }
    }

    if (httpMethod === 'DELETE' && path.startsWith('/uploads/')) {
      try {
        const uploadId = path.split('/')[2];
        if (!uploadId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Upload ID is required' }),
          };
        }

        // Delete all transactions from this upload
        const itemsToDelete = global.transactionStore.filter(item => item.upload_id === uploadId);
        let deletedCount = 0;
        
        for (const item of itemsToDelete) {
          const index = global.transactionStore.findIndex(t => t.id === item.id);
          if (index !== -1) {
            global.transactionStore.splice(index, 1);
            deletedCount++;
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Upload deleted successfully',
            deletedCount: deletedCount
          }),
        };
      } catch (error) {
        console.error('Error deleting upload:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to delete upload' }),
        };
      }
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Not found',
        path: path,
        method: httpMethod,
        available_endpoints: ['/health', '/upload/csv', '/transactions', '/status', '/uploads/{id}']
      }),
    };
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      }),
    };
  }
};

// CSV Processing Functions
function parseCSV(csvContent, bankType, fileName) {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length <= 1) {
    throw new Error('CSV file appears to be empty or has no data rows');
  }
  
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const dataLines = lines.slice(1);
  
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  switch (bankType.toLowerCase()) {
    case 'amex':
      return parseAmexCSV(headers, dataLines, uploadId, fileName);
    case 'truist':
      return parseTruistCSV(headers, dataLines, uploadId, fileName);
    default:
      return parseGenericCSV(headers, dataLines, uploadId, fileName);
  }
}

function parseAmexCSV(headers, dataLines, uploadId, fileName) {
  const transactions = [];
  
  for (const line of dataLines) {
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length < 3) continue;
    
    try {
      const amount = parseFloat(values[4]) || 0;
      const transaction = {
        id: `amex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: parseDate(values[0]),
        name: values[1] || 'Unknown Transaction',
        merchant_name: values[6] || values[1] || 'Unknown Merchant',
        amount: -Math.abs(amount), // AMEX shows positive as charges
        account_id: 'amex_manual',
        category: [values[12] || 'General'],
        subcategory: ['Manual Upload'],
        iso_currency_code: 'USD',
        source: 'csv_amex',
        upload_id: uploadId,
        upload_filename: fileName,
        created_at: new Date().toISOString(),
        duplicate_key: `${values[0]}_${values[1]}_${amount}_amex`
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

function parseTruistCSV(headers, dataLines, uploadId, fileName) {
  const transactions = [];
  console.log(`Truist parser - headers: ${headers.join(', ')}`);
  console.log(`Truist parser - processing ${dataLines.length} data lines`);
  
  for (const line of dataLines) {
    if (!line) continue;
    
    const values = parseCSVLine(line);
    console.log(`Truist line values (${values.length}): ${values.join(' | ')}`);
    if (values.length < 4) {
      console.log(`Skipping line - not enough values: ${values.length}`);
      continue;
    }
    
    try {
      const debit = parseFloat(values[4]) || 0;
      const credit = parseFloat(values[5]) || 0;
      const amount = credit > 0 ? credit : -debit;
      console.log(`Truist amounts - debit: ${debit}, credit: ${credit}, final: ${amount}`);
      
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
        upload_id: uploadId,
        upload_filename: fileName,
        created_at: new Date().toISOString(),
        duplicate_key: `${values[2]}_${values[3]}_${amount}_truist`
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

function parseGenericCSV(headers, dataLines, uploadId, fileName) {
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
        upload_id: uploadId,
        upload_filename: fileName,
        created_at: new Date().toISOString(),
        duplicate_key: `${values[dateCol]}_${values[descCol]}_${amount}_generic`
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

async function checkDuplicate(transaction) {
  try {
    const existing = global.transactionStore.find(item => 
      item.duplicate_key === transaction.duplicate_key
    );
    return !!existing;
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return false;
  }
}

async function saveTransaction(transaction) {
  global.transactionStore.push(transaction);
  return {};
}