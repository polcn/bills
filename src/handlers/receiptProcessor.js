const { v4: uuidv4 } = require('uuid');
const TextractService = require('../services/textract');
const DynamoDBService = require('../services/dynamodb');

const textractService = new TextractService();
const dbService = new DynamoDBService();

exports.handler = async (event) => {
  console.log('Receipt processing event:', JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      if (record.eventSource === 'aws:s3' && record.eventName.startsWith('ObjectCreated')) {
        await processReceiptRecord(record);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Receipt processing completed' }),
    };
  } catch (error) {
    console.error('Error processing receipt:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function processReceiptRecord(record) {
  const s3Bucket = record.s3.bucket.name;
  const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  
  console.log(`Processing receipt: s3://${s3Bucket}/${s3Key}`);

  try {
    const receipts = await textractService.analyzeExpense(s3Bucket, s3Key);
    
    for (const receipt of receipts) {
      await processReceiptData(receipt, s3Bucket, s3Key);
    }
    
    console.log(`Successfully processed ${receipts.length} receipts from ${s3Key}`);
  } catch (error) {
    console.error(`Error processing receipt ${s3Key}:`, error);
    throw error;
  }
}

async function processReceiptData(receipt, s3Bucket, s3Key) {
  const receiptId = uuidv4();
  const vendorName = receipt.vendorInfo.name || 'Unknown Vendor';
  const total = receipt.summary.total || 0;
  const date = receipt.summary.date || new Date().toISOString().split('T')[0];
  
  if (total === 0) {
    console.log('Skipping receipt with zero total');
    return;
  }

  const categorization = textractService.categorizeReceipt(vendorName, receipt.lineItems);

  const transaction = {
    id: `receipt_${receiptId}`,
    date: date,
    amount: total,
    account_id: 'physical_receipts',
    category: categorization.category,
    subcategory: categorization.subcategory,
    merchant_name: vendorName,
    name: `${vendorName} - Receipt`,
    iso_currency_code: 'USD',
    location: {
      address: receipt.vendorInfo.address || null,
      country: 'US',
    },
    source: 'receipt_ocr',
    raw_data: {
      s3Bucket,
      s3Key,
      receiptId,
      textractData: receipt,
      summary: {
        total: receipt.summary.total,
        subtotal: receipt.summary.subtotal,
        tax: receipt.summary.tax,
        receiptId: receipt.summary.receiptId,
      },
      vendor: receipt.vendorInfo,
      lineItems: receipt.lineItems,
    },
  };

  await dbService.saveTransaction(transaction);
  console.log(`Saved receipt transaction: ${transaction.id} for ${vendorName} ($${total})`);

  if (receipt.lineItems && receipt.lineItems.length > 0) {
    await saveLineItems(receiptId, receipt.lineItems, transaction.id);
  }
}

async function saveLineItems(receiptId, lineItems, transactionId) {
  for (let i = 0; i < lineItems.length; i++) {
    const lineItem = lineItems[i];
    
    if (!lineItem.description && lineItem.totalPrice === 0) {
      continue;
    }

    const lineItemTransaction = {
      id: `line_item_${receiptId}_${i}`,
      date: new Date().toISOString().split('T')[0],
      amount: lineItem.totalPrice,
      account_id: 'receipt_line_items',
      category: ['Shopping'],
      subcategory: ['Line Item'],
      merchant_name: 'Line Item',
      name: lineItem.description || `Line Item ${i + 1}`,
      iso_currency_code: 'USD',
      source: 'receipt_line_item',
      raw_data: {
        parentTransactionId: transactionId,
        receiptId,
        lineItemIndex: i,
        description: lineItem.description,
        quantity: lineItem.quantity,
        unitPrice: lineItem.unitPrice,
        totalPrice: lineItem.totalPrice,
      },
    };

    try {
      await dbService.saveTransaction(lineItemTransaction);
      console.log(`Saved line item: ${lineItem.description} ($${lineItem.totalPrice})`);
    } catch (error) {
      console.error(`Error saving line item ${i}:`, error);
    }
  }
}