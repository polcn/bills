const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

class DynamoDBService {
  constructor() {
    this.dynamodb = new AWS.DynamoDB.DocumentClient();
    this.tableName = process.env.TRANSACTIONS_TABLE;
  }

  async saveTransaction(transaction) {
    const item = {
      id: transaction.transaction_id || uuidv4(),
      date: transaction.date,
      amount: transaction.amount,
      account_id: transaction.account_id,
      category: transaction.category,
      subcategory: transaction.subcategory,
      merchant_name: transaction.merchant_name,
      name: transaction.name,
      iso_currency_code: transaction.iso_currency_code,
      location: transaction.location,
      source: transaction.source || 'plaid',
      raw_data: transaction,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const params = {
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(id)',
    };

    try {
      await this.dynamodb.put(params).promise();
      return item;
    } catch (error) {
      if (error.code === 'ConditionalCheckFailedException') {
        console.log(`Transaction ${item.id} already exists, updating...`);
        return await this.updateTransaction(item);
      }
      throw error;
    }
  }

  async updateTransaction(transaction) {
    const params = {
      TableName: this.tableName,
      Key: {
        id: transaction.id,
        date: transaction.date,
      },
      UpdateExpression: 'SET #amount = :amount, #category = :category, #subcategory = :subcategory, #merchant_name = :merchant_name, #name = :name, #location = :location, #raw_data = :raw_data, #updated_at = :updated_at',
      ExpressionAttributeNames: {
        '#amount': 'amount',
        '#category': 'category',
        '#subcategory': 'subcategory',
        '#merchant_name': 'merchant_name',
        '#name': 'name',
        '#location': 'location',
        '#raw_data': 'raw_data',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':amount': transaction.amount,
        ':category': transaction.category,
        ':subcategory': transaction.subcategory,
        ':merchant_name': transaction.merchant_name,
        ':name': transaction.name,
        ':location': transaction.location,
        ':raw_data': transaction.raw_data,
        ':updated_at': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    };

    try {
      const result = await this.dynamodb.update(params).promise();
      return result.Attributes;
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }

  async getTransactions(startDate, endDate, limit = 100) {
    const params = {
      TableName: this.tableName,
      FilterExpression: '#date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':startDate': startDate,
        ':endDate': endDate,
      },
      Limit: limit,
    };

    try {
      const result = await this.dynamodb.scan(params).promise();
      return result.Items;
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }

  async savePlaidCursor(accessToken, cursor) {
    const params = {
      TableName: this.tableName,
      Item: {
        id: 'plaid_cursor',
        date: accessToken,
        cursor: cursor,
        updated_at: new Date().toISOString(),
      },
    };

    try {
      await this.dynamodb.put(params).promise();
    } catch (error) {
      console.error('Error saving Plaid cursor:', error);
      throw error;
    }
  }

  async getPlaidCursor(accessToken) {
    const params = {
      TableName: this.tableName,
      Key: {
        id: 'plaid_cursor',
        date: accessToken,
      },
    };

    try {
      const result = await this.dynamodb.get(params).promise();
      return result.Item ? result.Item.cursor : null;
    } catch (error) {
      console.error('Error getting Plaid cursor:', error);
      return null;
    }
  }
}

module.exports = DynamoDBService;