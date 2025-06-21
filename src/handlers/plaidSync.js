const PlaidService = require('../services/plaid');
const DynamoDBService = require('../services/dynamodb');

const plaidService = new PlaidService();
const dbService = new DynamoDBService();

exports.handler = async (event) => {
  console.log('Starting Plaid transaction sync...');
  
  try {
    const accessToken = process.env.PLAID_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('PLAID_ACCESS_TOKEN environment variable is required');
    }

    const cursor = await dbService.getPlaidCursor(accessToken);
    console.log('Retrieved cursor:', cursor);

    const syncData = await plaidService.syncTransactions(accessToken, cursor);
    console.log(`Retrieved ${syncData.added.length} new transactions, ${syncData.modified.length} modified transactions`);

    const allTransactions = [...syncData.added, ...syncData.modified];
    const savedTransactions = [];

    for (const transaction of allTransactions) {
      try {
        const savedTransaction = await dbService.saveTransaction(transaction);
        savedTransactions.push(savedTransaction);
        console.log(`Saved transaction: ${transaction.transaction_id}`);
      } catch (error) {
        console.error(`Error saving transaction ${transaction.transaction_id}:`, error);
      }
    }

    if (syncData.next_cursor) {
      await dbService.savePlaidCursor(accessToken, syncData.next_cursor);
      console.log('Saved new cursor:', syncData.next_cursor);
    }

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Plaid sync completed successfully',
        newTransactions: syncData.added.length,
        modifiedTransactions: syncData.modified.length,
        savedTransactions: savedTransactions.length,
        nextCursor: syncData.next_cursor,
      }),
    };

    console.log('Plaid sync completed successfully');
    return response;

  } catch (error) {
    console.error('Error in Plaid sync:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};