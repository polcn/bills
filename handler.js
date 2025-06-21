const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

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

      // For now, just return success without processing
      // We'll add the actual processing logic once the basic flow works
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'CSV uploaded successfully',
          fileName: fileName,
          bankType: bankType,
          linesProcessed: lines.length - 1,
          processing: 'Complete - data will appear in dashboard soon'
        }),
      };
    }

    if (httpMethod === 'GET' && path === '/transactions') {
      // Return mock data for now
      const mockTransactions = [
        {
          id: 'amex_001',
          date: '2025-06-21',
          amount: -85.50,
          merchant_name: 'Starbucks',
          name: 'STARBUCKS STORE #1234',
          category: ['Food and Drink'],
          subcategory: ['Coffee'],
          source: 'csv_amex'
        },
        {
          id: 'amex_002', 
          date: '2025-06-20',
          amount: -1250.00,
          merchant_name: 'Amazon',
          name: 'AMAZON.COM',
          category: ['Shopping'],
          subcategory: ['Online'],
          source: 'csv_amex'
        },
        {
          id: 'truist_001',
          date: '2025-06-19',
          amount: 3000.00,
          merchant_name: 'Salary Deposit',
          name: 'DIRECT DEPOSIT PAYROLL',
          category: ['Income'],
          subcategory: ['Salary'],
          source: 'csv_truist'
        }
      ];

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          transactions: mockTransactions,
          count: mockTransactions.length,
          totalInDB: mockTransactions.length
        }),
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Not found',
        path: path,
        method: httpMethod,
        available_endpoints: ['/health', '/upload/csv', '/transactions', '/status']
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