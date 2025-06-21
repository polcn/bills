import React, { useState, useEffect } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ApiService from '../services/api';
import PlaidLink from './PlaidLink';
import TransactionList from './TransactionList';
import ReceiptUpload from './ReceiptUpload';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [summary, setSummary] = useState({
    totalSpent: 0,
    transactionCount: 0,
    avgTransactionAmount: 0,
  });

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [transactionsData, accountsData] = await Promise.all([
        ApiService.getTransactions(dateRange),
        ApiService.getAccounts().catch(() => ({ accounts: [] })),
      ]);

      setTransactions(transactionsData.transactions || []);
      setAccounts(accountsData.accounts || []);
      
      calculateSummary(transactionsData.transactions || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (txns) => {
    const totalSpent = txns.reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
    const transactionCount = txns.length;
    const avgTransactionAmount = transactionCount > 0 ? totalSpent / transactionCount : 0;

    setSummary({
      totalSpent,
      transactionCount,
      avgTransactionAmount,
    });
  };

  const getCategoryData = () => {
    const categoryTotals = {};
    transactions.forEach(txn => {
      const category = txn.category?.[0] || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(txn.amount);
    });

    return Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    }));
  };

  const getSpendingTrend = () => {
    const dailySpending = {};
    transactions.forEach(txn => {
      const date = txn.date;
      dailySpending[date] = (dailySpending[date] || 0) + Math.abs(txn.amount);
    });

    return Object.entries(dailySpending)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, amount]) => ({
        date: format(new Date(date), 'MMM dd'),
        amount: Math.round(amount * 100) / 100,
      }));
  };

  const handlePlaidSuccess = async () => {
    await loadData();
  };

  const handleManualSync = async () => {
    try {
      setLoading(true);
      await ApiService.syncTransactions();
      await loadData();
    } catch (error) {
      console.error('Error syncing transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-bill-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-bill-primary mb-4">Bill's Financial Dashboard</h1>
          
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <PlaidLink onSuccess={handlePlaidSuccess} />
            
            <button
              onClick={handleManualSync}
              className="px-4 py-2 bg-bill-accent text-white rounded-md hover:bg-blue-600"
            >
              Sync Transactions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-bill-primary mb-2">Total Spent</h3>
            <p className="text-3xl font-bold text-bill-error">${summary.totalSpent.toFixed(2)}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-bill-primary mb-2">Transactions</h3>
            <p className="text-3xl font-bold text-bill-accent">{summary.transactionCount}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-bill-primary mb-2">Avg. Amount</h3>
            <p className="text-3xl font-bold text-bill-secondary">${summary.avgTransactionAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-bill-primary mb-4">Spending Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getSpendingTrend()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-bill-primary mb-4">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getCategoryData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getCategoryData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-bill-primary mb-4">Upload Receipt</h3>
            <ReceiptUpload onUpload={loadData} />
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-bill-primary mb-4">Recent Transactions</h3>
            <TransactionList transactions={transactions.slice(0, 10)} />
          </div>
        </div>
      </div>
    </div>
  );
}