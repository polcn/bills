const PlaidService = require('../services/plaid');
const DynamoDBService = require('../services/dynamodb');

const plaidService = new PlaidService();
const dbService = new DynamoDBService();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

exports.handler = async (event) => {
  console.log('API Request:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  const { httpMethod, path, pathParameters, body } = event;
  const parsedBody = body ? JSON.parse(body) : {};

  try {
    switch (true) {
      case httpMethod === 'POST' && path === '/link/token/create':
        return await handleCreateLinkToken(parsedBody);
      
      case httpMethod === 'POST' && path === '/link/token/exchange':
        return await handleExchangeToken(parsedBody);
      
      case httpMethod === 'GET' && path === '/transactions':
        return await handleGetTransactions(event.queryStringParameters);
      
      case httpMethod === 'POST' && path === '/transactions/sync':
        return await handleManualSync();
      
      case httpMethod === 'GET' && path === '/accounts':
        return await handleGetAccounts();
      
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Not found' }),
        };
    }
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

async function handleCreateLinkToken(body) {
  const { userId } = body;
  if (!userId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'userId is required' }),
    };
  }

  const linkToken = await plaidService.createLinkToken(userId);
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(linkToken),
  };
}

async function handleExchangeToken(body) {
  const { publicToken } = body;
  if (!publicToken) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'publicToken is required' }),
    };
  }

  const exchangeData = await plaidService.exchangePublicToken(publicToken);
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(exchangeData),
  };
}

async function handleGetTransactions(queryParams) {
  const startDate = queryParams?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = queryParams?.endDate || new Date().toISOString().split('T')[0];
  const limit = parseInt(queryParams?.limit || '100');

  const transactions = await dbService.getTransactions(startDate, endDate, limit);
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      transactions,
      count: transactions.length,
    }),
  };
}

async function handleManualSync() {
  const accessToken = process.env.PLAID_ACCESS_TOKEN;
  if (!accessToken) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'PLAID_ACCESS_TOKEN not configured' }),
    };
  }

  const cursor = await dbService.getPlaidCursor(accessToken);
  const syncData = await plaidService.syncTransactions(accessToken, cursor);
  
  const allTransactions = [...syncData.added, ...syncData.modified];
  for (const transaction of allTransactions) {
    await dbService.saveTransaction(transaction);
  }

  if (syncData.next_cursor) {
    await dbService.savePlaidCursor(accessToken, syncData.next_cursor);
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'Manual sync completed',
      newTransactions: syncData.added.length,
      modifiedTransactions: syncData.modified.length,
    }),
  };
}

async function handleGetAccounts() {
  const accessToken = process.env.PLAID_ACCESS_TOKEN;
  if (!accessToken) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'PLAID_ACCESS_TOKEN not configured' }),
    };
  }

  const accountsData = await plaidService.getAccounts(accessToken);
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(accountsData),
  };
}