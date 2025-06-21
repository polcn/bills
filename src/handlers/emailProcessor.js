const AWS = require('aws-sdk');
const DynamoDBService = require('../services/dynamodb');

const dbService = new DynamoDBService();

exports.handler = async (event) => {
  console.log('Email processing event:', JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      if (record.eventSource === 'aws:ses') {
        await processEmailRecord(record);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email processing completed' }),
    };
  } catch (error) {
    console.error('Error processing email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function processEmailRecord(record) {
  const sesPayload = record.ses;
  const messageId = sesPayload.mail.messageId;
  const source = sesPayload.mail.source;
  const subject = sesPayload.mail.commonHeaders.subject;
  
  console.log(`Processing email from ${source} with subject: ${subject}`);

  if (isAmazonOrderEmail(source, subject)) {
    await processAmazonEmail(sesPayload);
  } else if (isReceiptEmail(source, subject)) {
    await processGenericReceiptEmail(sesPayload);
  } else {
    console.log('Email does not match any known receipt patterns');
  }
}

function isAmazonOrderEmail(source, subject) {
  return (
    source.includes('amazon.com') ||
    source.includes('shipment-tracking@amazon.com') ||
    subject.toLowerCase().includes('your order') ||
    subject.toLowerCase().includes('order confirmation')
  );
}

function isReceiptEmail(source, subject) {
  const receiptKeywords = [
    'receipt', 'order', 'purchase', 'transaction', 'invoice',
    'confirmation', 'payment', 'billing'
  ];
  
  const subjectLower = subject.toLowerCase();
  return receiptKeywords.some(keyword => subjectLower.includes(keyword));
}

async function processAmazonEmail(sesPayload) {
  const messageId = sesPayload.mail.messageId;
  const subject = sesPayload.mail.commonHeaders.subject;
  const body = sesPayload.mail.body || '';
  
  console.log('Processing Amazon email');

  const orderData = parseAmazonEmailContent(body, subject);
  
  if (orderData) {
    const transaction = {
      id: `amazon_${messageId}`,
      date: orderData.date || new Date().toISOString().split('T')[0],
      amount: orderData.total,
      account_id: 'amazon_orders',
      category: ['Shopping'],
      subcategory: ['Online', 'Amazon'],
      merchant_name: 'Amazon',
      name: `Amazon Order - ${orderData.orderNumber || 'Unknown'}`,
      iso_currency_code: 'USD',
      location: { country: 'US' },
      source: 'email_amazon',
      raw_data: {
        messageId,
        subject,
        body,
        parsedData: orderData,
      },
    };

    await dbService.saveTransaction(transaction);
    console.log(`Saved Amazon transaction: ${transaction.id}`);
  }
}

async function processGenericReceiptEmail(sesPayload) {
  const messageId = sesPayload.mail.messageId;
  const source = sesPayload.mail.source;
  const subject = sesPayload.mail.commonHeaders.subject;
  const body = sesPayload.mail.body || '';
  
  console.log('Processing generic receipt email');

  const receiptData = parseGenericReceiptContent(body, subject, source);
  
  if (receiptData && receiptData.amount) {
    const transaction = {
      id: `email_${messageId}`,
      date: receiptData.date || new Date().toISOString().split('T')[0],
      amount: receiptData.amount,
      account_id: 'email_receipts',
      category: ['Shopping'],
      subcategory: ['Email Receipt'],
      merchant_name: receiptData.merchant || extractMerchantFromEmail(source),
      name: receiptData.description || subject,
      iso_currency_code: 'USD',
      location: { country: 'US' },
      source: 'email_receipt',
      raw_data: {
        messageId,
        source,
        subject,
        body,
        parsedData: receiptData,
      },
    };

    await dbService.saveTransaction(transaction);
    console.log(`Saved email receipt transaction: ${transaction.id}`);
  }
}

function parseAmazonEmailContent(body, subject) {
  const orderNumberMatch = body.match(/Order #(\d+-\d+-\d+)/i) || 
                          subject.match(/Order #(\d+-\d+-\d+)/i);
  const totalMatch = body.match(/Order Total:?\s*\$?([\d,]+\.?\d*)/i) ||
                    body.match(/Total:?\s*\$?([\d,]+\.?\d*)/i);
  const dateMatch = body.match(/Order Date:?\s*([A-Za-z]+ \d{1,2}, \d{4})/i);

  if (!totalMatch) return null;

  return {
    orderNumber: orderNumberMatch ? orderNumberMatch[1] : null,
    total: parseFloat(totalMatch[1].replace(/,/g, '')),
    date: dateMatch ? new Date(dateMatch[1]).toISOString().split('T')[0] : null,
  };
}

function parseGenericReceiptContent(body, subject, source) {
  const amountPatterns = [
    /Total:?\s*\$?([\d,]+\.?\d*)/i,
    /Amount:?\s*\$?([\d,]+\.?\d*)/i,
    /Charged:?\s*\$?([\d,]+\.?\d*)/i,
    /\$(\d+\.\d{2})/g,
  ];

  let amount = null;
  for (const pattern of amountPatterns) {
    const match = body.match(pattern);
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  const dateMatch = body.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})|([A-Za-z]+ \d{1,2}, \d{4})/i);
  const merchantMatch = body.match(/from\s+([A-Za-z\s]+)/i) || 
                       body.match(/at\s+([A-Za-z\s]+)/i);

  return {
    amount,
    date: dateMatch ? new Date(dateMatch[0]).toISOString().split('T')[0] : null,
    merchant: merchantMatch ? merchantMatch[1].trim() : null,
    description: subject,
  };
}

function extractMerchantFromEmail(email) {
  const domain = email.split('@')[1];
  if (!domain) return 'Unknown';
  
  const parts = domain.split('.');
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}