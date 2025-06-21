import axios from 'axios';
import { Auth } from '@aws-amplify/auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.bill-finance.com';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    this.client.interceptors.request.use(
      async (config) => {
        try {
          const session = await Auth.currentSession();
          const token = session.getIdToken().getJwtToken();
          config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
          console.log('No auth token available');
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          Auth.signOut();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async createLinkToken(userId) {
    const response = await this.client.post('/link/token/create', { userId });
    return response.data;
  }

  async exchangePublicToken(publicToken) {
    const response = await this.client.post('/link/token/exchange', { publicToken });
    return response.data;
  }

  async getTransactions(params = {}) {
    const response = await this.client.get('/transactions', { params });
    return response.data;
  }

  async syncTransactions() {
    const response = await this.client.post('/transactions/sync');
    return response.data;
  }

  async getAccounts() {
    const response = await this.client.get('/accounts');
    return response.data;
  }

  async uploadReceipt(file) {
    const formData = new FormData();
    formData.append('receipt', file);
    
    const response = await this.client.post('/receipts/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
}

export default new ApiService();