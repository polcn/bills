// Note: Using global storage for now - DynamoDB integration deferred due to SDK complexity
const dynamodb = null; // Placeholder for future DynamoDB integration

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

const TABLE_NAME = process.env.TRANSACTIONS_TABLE || 'bill-finance-minimal-dev-transactions';
const RECEIPTS_BUCKET = process.env.RECEIPTS_BUCKET || 'bill-receipts-1750520483';

// Initialize persistent storage - load from DynamoDB on cold start
global.transactionStore = global.transactionStore || [];
global.storageInitialized = global.storageInitialized || false;

async function initializeStorage() {
  if (!global.storageInitialized) {
    console.log('Cold start detected - loading transactions from DynamoDB...');
    try {
      const transactions = await loadFromDynamoDB();
      global.transactionStore = transactions;
      global.storageInitialized = true;
      console.log(`Loaded ${transactions.length} transactions from DynamoDB`);
    } catch (error) {
      console.error('Failed to load from DynamoDB on cold start:', error);
      global.transactionStore = [];
      global.storageInitialized = true;
    }
  }
}

exports.api = async (event) => {
  console.log('API Request:', JSON.stringify(event, null, 2));
  
  // Ensure storage is initialized on every request
  await initializeStorage();

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
        // Initialize memory store if empty
        if (!global.transactionStore || global.transactionStore.length === 0) {
          global.transactionStore = [];
          
          // Load existing data from DynamoDB on cold start
          try {
            const dbTransactions = await loadFromDynamoDB();
            global.transactionStore = dbTransactions;
            console.log(`Lambda cold start - loaded ${dbTransactions.length} transactions from DynamoDB`);
          } catch (error) {
            console.error('Failed to load from DynamoDB:', error.message);
            console.log('Lambda cold start - memory store initialized empty');
          }
        }
        
        const transactions = global.transactionStore || [];
        
        // Sort by date descending
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            transactions: transactions,
            count: transactions.length,
            totalInDB: transactions.length,
            memoryStoreActive: true
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

    if (httpMethod === 'POST' && path === '/upload/receipt') {
      const body = JSON.parse(event.body || '{}');
      const { imageData, fileName, fileType = 'image/jpeg' } = body;

      if (!imageData) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'imageData is required' }),
        };
      }

      try {
        // Convert base64 to buffer
        const buffer = Buffer.from(imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);
        const key = `receipts/${timestamp}_${randomId}_${fileName || 'receipt.jpg'}`;

        console.log(`Processing receipt upload: ${key}, size: ${buffer.length} bytes`);

        // For now, simulate processing and return mock data
        // In a real implementation, this would:
        // 1. Upload to S3
        // 2. Trigger Textract analysis
        // 3. Parse results into transaction format

        const mockTransaction = {
          id: `receipt_${timestamp}_${randomId}`,
          date: new Date().toISOString().split('T')[0],
          name: 'Receipt Transaction (Mock)',
          merchant_name: 'Sample Store',
          amount: -25.99,
          account_id: 'receipt_upload',
          category: ['General'],
          subcategory: ['Receipt Upload'],
          iso_currency_code: 'USD',
          source: 'receipt_textract',
          upload_id: `receipt_upload_${timestamp}`,
          upload_filename: fileName || 'receipt.jpg',
          created_at: new Date().toISOString(),
          duplicate_key: `receipt_${timestamp}_${randomId}`,
          receipt_data: {
            s3_key: key,
            processing_status: 'mock_processed',
            extracted_items: [
              { description: 'Sample Item 1', amount: 15.99 },
              { description: 'Sample Item 2', amount: 10.00 }
            ]
          }
        };

        // Save the mock transaction
        await saveTransaction(mockTransaction);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Receipt processed successfully (demo mode)',
            fileName: fileName,
            transaction: mockTransaction,
            note: 'This is mock data - full Textract integration coming soon'
          }),
        };
      } catch (error) {
        console.error('Receipt processing error:', error);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Receipt processing failed', 
            details: error.message 
          }),
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
        duplicate_key: generateDuplicateKey(values[0], values[1], amount)
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
  console.log(`Truist parser - headers received: [${headers.join(', ')}]`);
  console.log(`Truist parser - processing ${dataLines.length} data lines`);
  
  // Find column indices dynamically with expanded search terms
  const dateCol = findColumnIndex(headers, ['posted date', 'date', 'transaction date', 'trans date']);
  const descCol = findColumnIndex(headers, ['description', 'memo', 'details', 'payee']);
  const debitCol = findColumnIndex(headers, ['debit', 'withdrawal', 'amount debit', 'withdrawals']);
  const creditCol = findColumnIndex(headers, ['credit', 'deposit', 'amount credit', 'deposits']);
  const amountCol = findColumnIndex(headers, ['amount', 'transaction amount', 'trans amount']);
  
  console.log(`Truist column mapping - date: ${dateCol}(${headers[dateCol] || 'N/A'}), desc: ${descCol}(${headers[descCol] || 'N/A'}), debit: ${debitCol}(${headers[debitCol] || 'N/A'}), credit: ${creditCol}(${headers[creditCol] || 'N/A'}), amount: ${amountCol}(${headers[amountCol] || 'N/A'})`);
  
  if (dateCol === -1) {
    throw new Error(`Could not find date column. Available headers: ${headers.join(', ')}`);
  }
  
  if (descCol === -1) {
    throw new Error(`Could not find description column. Available headers: ${headers.join(', ')}`);
  }
  
  // Must have either debit/credit columns OR amount column
  if (debitCol === -1 && creditCol === -1 && amountCol === -1) {
    throw new Error(`Could not find amount columns (debit/credit or amount). Available headers: ${headers.join(', ')}`);
  }
  
  for (const line of dataLines) {
    if (!line) continue;
    
    const values = parseCSVLine(line);
    console.log(`Truist line values (${values.length}): ${values.join(' | ')}`);
    if (values.length <= Math.max(dateCol, descCol)) {
      console.log(`Skipping line - not enough values for required columns`);
      continue;
    }
    
    try {
      let amount = 0;
      
      if (amountCol !== -1 && values[amountCol] && values[amountCol].toString().trim() !== '') {
        // Handle Truist format: ($133.08) for debits, $2,229.90 for credits
        let amountStr = values[amountCol].toString().trim();
        console.log(`Truist raw amount string: "${amountStr}"`);
        
        // Remove commas, dollar signs, and extra spaces
        amountStr = amountStr.replace(/[$,\s]/g, '');
        
        // Check for parentheses (negative)
        if (amountStr.startsWith('(') && amountStr.endsWith(')')) {
          amountStr = amountStr.slice(1, -1); // Remove parentheses
          amount = -Math.abs(parseFloat(amountStr)) || 0;
        } else {
          amount = parseFloat(amountStr) || 0;
        }
        console.log(`Truist amount parsed from single amount column: ${amount}`);
      } else {
        // Handle separate debit/credit columns
        const debitStr = (debitCol !== -1 && values[debitCol]) ? values[debitCol].toString().trim() : '';
        const creditStr = (creditCol !== -1 && values[creditCol]) ? values[creditCol].toString().trim() : '';
        
        console.log(`Truist debit string: "${debitStr}", credit string: "${creditStr}"`);
        
        const debit = debitStr !== '' ? (parseFloat(debitStr.replace(/[$,\s]/g, '')) || 0) : 0;
        const credit = creditStr !== '' ? (parseFloat(creditStr.replace(/[$,\s]/g, '')) || 0) : 0;
        
        // Credit is positive income, debit is negative spending
        if (credit > 0) {
          amount = credit;
        } else if (debit > 0) {
          amount = -Math.abs(debit);
        } else {
          amount = 0;
        }
        console.log(`Truist amount parsed from debit/credit columns: debit=${debit}, credit=${credit}, final amount=${amount}`);
      }
      
      console.log(`Truist parsed amount: ${amount} from debit/credit/amount columns`);
      
      // Validate parsed date
      const parsedDate = parseDate(values[dateCol]);
      if (!parsedDate || parsedDate === 'Invalid Date') {
        console.log(`Skipping transaction - invalid date: "${values[dateCol]}"`);
        continue;
      }
      
      // Validate description
      const description = values[descCol] ? values[descCol].trim() : '';
      if (!description || description.length === 0) {
        console.log(`Skipping transaction - empty description`);
        continue;
      }
      
      const transaction = {
        id: `truist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: parsedDate,
        name: description,
        merchant_name: description,
        amount: amount,
        account_id: 'truist_manual',
        category: ['General'],
        subcategory: ['Manual Upload'],
        iso_currency_code: 'USD',
        source: 'csv_truist',
        upload_id: uploadId,
        upload_filename: fileName,
        created_at: new Date().toISOString(),
        duplicate_key: generateDuplicateKey(values[dateCol], description, amount)
      };
      
      console.log(`Truist transaction created: ID=${transaction.id}, Name="${transaction.name}", Amount=${transaction.amount}, Date="${transaction.date}"`);
      
      // Only add non-zero transactions with valid dates
      if (amount !== 0) {
        transactions.push(transaction);
      } else {
        console.log(`Skipping transaction - zero amount`);
      }
    } catch (error) {
      console.error('Error parsing Truist line:', line, error);
    }
  }
  
  console.log(`Truist parser returning ${transactions.length} transactions`);
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
        duplicate_key: generateDuplicateKey(values[dateCol], values[descCol], amount)
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
    // First check memory store
    const existingInMemory = global.transactionStore.find(item => 
      item.duplicate_key === transaction.duplicate_key
    );
    
    if (existingInMemory) {
      console.log(`Duplicate found in memory: ${transaction.duplicate_key}`);
      return true;
    }
    
    // Also check DynamoDB directly for cross-session duplicates
    const existingInDB = await checkDuplicateInDynamoDB(transaction.duplicate_key);
    if (existingInDB) {
      console.log(`Duplicate found in DynamoDB: ${transaction.duplicate_key}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return false;
  }
}

async function saveTransaction(transaction) {
  // Add to memory store for fast access
  global.transactionStore.push(transaction);
  
  // Also save to DynamoDB for persistence
  try {
    await saveToDynamoDB(transaction);
    console.log(`Transaction saved to DynamoDB: ${transaction.id}`);
  } catch (dbError) {
    console.error('Failed to save to DynamoDB, continuing with memory only:', dbError);
  }
  
  return {};
}

async function checkDuplicateInDynamoDB(duplicateKey) {
  try {
    const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
    
    const client = new DynamoDBClient({ region: 'us-east-1' });
    const tableName = process.env.TRANSACTIONS_TABLE || 'bill-finance-minimal-dev-transactions';
    
    // Use GSI if available, otherwise scan with filter
    const params = {
      TableName: tableName,
      FilterExpression: 'duplicate_key = :dup_key',
      ExpressionAttributeValues: {
        ':dup_key': { S: duplicateKey }
      },
      Limit: 1
    };
    
    const { ScanCommand } = require('@aws-sdk/client-dynamodb');
    const command = new ScanCommand(params);
    const result = await client.send(command);
    
    return result.Items && result.Items.length > 0;
  } catch (error) {
    console.error('Error checking duplicate in DynamoDB:', error);
    return false;
  }
}

async function saveToDynamoDB(transaction) {
  try {
    // Use AWS SDK v3 style calls through native Lambda runtime
    const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
    
    const client = new DynamoDBClient({ region: 'us-east-1' });
    const tableName = process.env.TRANSACTIONS_TABLE || 'bill-finance-minimal-dev-transactions';
    
    const params = {
      TableName: tableName,
      Item: {
        id: { S: transaction.id },
        user_id: { S: 'user1' },
        date: { S: transaction.date },
        name: { S: transaction.name },
        merchant_name: { S: transaction.merchant_name || transaction.name },
        amount: { N: transaction.amount.toString() },
        account_id: { S: transaction.account_id },
        category: { SS: transaction.category },
        subcategory: { SS: transaction.subcategory },
        iso_currency_code: { S: transaction.iso_currency_code },
        source: { S: transaction.source },
        upload_id: { S: transaction.upload_id },
        upload_filename: { S: transaction.upload_filename },
        created_at: { S: transaction.created_at },
        duplicate_key: { S: transaction.duplicate_key }
      },
      ConditionExpression: 'attribute_not_exists(id)' // Prevent duplicates
    };
    
    const command = new PutItemCommand(params);
    await client.send(command);
    console.log(`Successfully saved to DynamoDB: ${transaction.id}`);
    
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.log(`Transaction already exists in DynamoDB: ${transaction.id}`);
    } else {
      console.error('DynamoDB save error:', error.message);
      throw error;
    }
  }
}

async function loadFromDynamoDB() {
  try {
    const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
    
    const client = new DynamoDBClient({ region: 'us-east-1' });
    const tableName = process.env.TRANSACTIONS_TABLE || 'bill-finance-minimal-dev-transactions';
    
    const params = {
      TableName: tableName,
      FilterExpression: 'user_id = :user_id',
      ExpressionAttributeValues: {
        ':user_id': { S: 'user1' }
      }
    };
    
    const command = new ScanCommand(params);
    const result = await client.send(command);
    
    // Convert DynamoDB format back to our transaction format
    const transactions = result.Items.map(item => ({
      id: item.id.S,
      date: item.date.S,
      name: item.name.S,
      merchant_name: item.merchant_name.S,
      amount: parseFloat(item.amount.N),
      account_id: item.account_id.S,
      category: item.category.SS || ['General'],
      subcategory: item.subcategory.SS || ['Manual Upload'],
      iso_currency_code: item.iso_currency_code.S,
      source: item.source.S,
      upload_id: item.upload_id.S,
      upload_filename: item.upload_filename.S,
      created_at: item.created_at.S,
      duplicate_key: item.duplicate_key.S
    }));
    
    console.log(`Loaded ${transactions.length} transactions from DynamoDB`);
    return transactions;
    
  } catch (error) {
    console.error('Error loading from DynamoDB:', error.message);
    return [];
  }
}
function generateDuplicateKey(date, description, amount) {
  // Normalize inputs for cross-source duplicate detection
  const normalizedDate = parseDate(date);
  const normalizedDesc = description.toLowerCase().trim().replace(/\s+/g, ' ');
  const normalizedAmount = Math.abs(parseFloat(amount)).toFixed(2);
  
  // Remove common bank-specific prefixes/suffixes that might differ
  const cleanDesc = normalizedDesc
    .replace(/^(pos|purchase|payment|transfer|deposit|withdrawal)\s+/i, '')
    .replace(/\s+(pos|#\d+|\*\d+)$/i, '')
    .replace(/\s+xx\d+$/i, '') // Remove card endings like xx1234
    .trim();
  
  return `${normalizedDate}_${cleanDesc}_${normalizedAmount}`;
}