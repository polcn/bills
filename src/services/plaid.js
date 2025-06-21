const { PlaidApi, Configuration, PlaidEnvironments } = require('plaid');

class PlaidService {
  constructor() {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    });
    
    this.client = new PlaidApi(configuration);
  }

  async createLinkToken(userId) {
    const request = {
      user: {
        client_user_id: userId,
      },
      client_name: "Bill's Financial Management",
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      webhook: `https://api.bill-finance.com/webhook/plaid`,
    };

    try {
      const response = await this.client.linkTokenCreate(request);
      return response.data;
    } catch (error) {
      console.error('Error creating link token:', error);
      throw error;
    }
  }

  async exchangePublicToken(publicToken) {
    try {
      const response = await this.client.itemPublicTokenExchange({
        public_token: publicToken,
      });
      return response.data;
    } catch (error) {
      console.error('Error exchanging public token:', error);
      throw error;
    }
  }

  async syncTransactions(accessToken, cursor = null) {
    try {
      const request = {
        access_token: accessToken,
        cursor: cursor,
        count: 500,
      };

      const response = await this.client.transactionsSync(request);
      return response.data;
    } catch (error) {
      console.error('Error syncing transactions:', error);
      throw error;
    }
  }

  async getAccounts(accessToken) {
    try {
      const response = await this.client.accountsGet({
        access_token: accessToken,
      });
      return response.data;
    } catch (error) {
      console.error('Error getting accounts:', error);
      throw error;
    }
  }

  async enrichTransactions(accessToken, accountIds, startDate, endDate) {
    try {
      const response = await this.client.transactionsEnrich({
        access_token: accessToken,
        account_ids: accountIds,
        start_date: startDate,
        end_date: endDate,
      });
      return response.data;
    } catch (error) {
      console.error('Error enriching transactions:', error);
      throw error;
    }
  }
}

module.exports = PlaidService;