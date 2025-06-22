import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  CreditCardIcon,
  BanknotesIcon,
  ClockIcon,
  CameraIcon
} from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import CSVUpload from './CSVUpload';
import ReceiptUpload from './ReceiptUpload';

const API_BASE_URL = 'https://8bvnp8f956.execute-api.us-east-1.amazonaws.com/dev';

const NEON_COLORS = ['#00d4ff', '#00ff88', '#b84dff', '#ff4db8', '#ffdd00', '#ff6b35'];

export default function CyberDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalIncome: 0,
    transactionCount: 0,
    thisMonth: 0,
    lastMonth: 0,
  });
  const [activeTab, setActiveTab] = useState('upload');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/transactions?limit=100`);
      if (!response.ok) {
        throw new Error('Failed to load transactions');
      }
      const data = await response.json();
      setTransactions(data.transactions || []);
      calculateStats(data.transactions || []);
      
      // Group transactions by upload for delete functionality
      const uploadsMap = {};
      (data.transactions || []).forEach(txn => {
        if (txn.upload_id) {
          if (!uploadsMap[txn.upload_id]) {
            uploadsMap[txn.upload_id] = {
              id: txn.upload_id,
              filename: txn.upload_filename || 'Unknown',
              source: txn.source,
              count: 0,
              created_at: txn.created_at
            };
          }
          uploadsMap[txn.upload_id].count++;
        }
      });
      
      setUploads(Object.values(uploadsMap).sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      ));
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteUpload = async (uploadId) => {
    if (!confirm('Are you sure you want to delete this upload and all its transactions?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/uploads/${uploadId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete upload');
      }
      
      // Reload transactions to refresh the view
      await loadTransactions();
    } catch (error) {
      console.error('Error deleting upload:', error);
      alert('Failed to delete upload. Please try again.');
    }
  };

  const calculateStats = (txns) => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const totalSpent = txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalIncome = txns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    
    const thisMonthTxns = txns.filter(t => new Date(t.date) >= thisMonth);
    const lastMonthTxns = txns.filter(t => {
      const date = new Date(t.date);
      return date >= lastMonth && date <= lastMonthEnd;
    });

    const thisMonthSpent = thisMonthTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const lastMonthSpent = lastMonthTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

    setStats({
      totalSpent,
      totalIncome,
      transactionCount: txns.length,
      thisMonth: thisMonthSpent,
      lastMonth: lastMonthSpent,
    });
  };

  const getCategoryData = () => {
    const categoryTotals = {};
    transactions.forEach(txn => {
      if (txn.amount < 0) { // Only spending
        const category = txn.category?.[0] || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(txn.amount);
      }
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  };

  const getSpendingTrend = () => {
    const dailySpending = {};
    transactions.forEach(txn => {
      if (txn.amount < 0) {
        const date = txn.date;
        dailySpending[date] = (dailySpending[date] || 0) + Math.abs(txn.amount);
      }
    });

    return Object.entries(dailySpending)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .slice(-30)
      .map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: Math.round(amount * 100) / 100,
      }));
  };

  const getMonthlyChange = () => {
    if (stats.lastMonth === 0) return 0;
    return ((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100;
  };

  const handleUploadComplete = () => {
    loadTransactions();
    setActiveTab('dashboard');
  };

  const tabs = [
    { id: 'upload', label: 'Upload CSV', icon: ChartBarIcon },
    { id: 'receipt', label: 'Upload Receipt', icon: CameraIcon },
    { id: 'dashboard', label: 'Dashboard', icon: BanknotesIcon },
    { id: 'uploads', label: 'Manage Uploads', icon: CreditCardIcon },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-cyber-grid bg-grid opacity-5"></div>
      
      {/* Header */}
      <div className="relative z-10 border-b border-gray-700/50 backdrop-blur-sm bg-dark-800/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-neon-blue to-neon-purple rounded-lg flex items-center justify-center animate-glow">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-neon-blue to-neon-green bg-clip-text text-transparent">
                  Bill's Finance
                </h1>
                <p className="text-gray-400 text-sm">Cyber Financial Management</p>
              </div>
            </div>
            
            {/* Navigation */}
            <div className="flex space-x-1 bg-dark-800/50 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'upload' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent mb-2">
                Upload Your Transactions
              </h2>
              <p className="text-gray-400">Drop your CSV files and watch the magic happen</p>
            </div>
            <CSVUpload onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {activeTab === 'receipt' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent mb-2">
                Upload Receipts
              </h2>
              <p className="text-gray-400">Snap a photo or upload receipt images for automatic processing</p>
            </div>
            <ReceiptUpload onUpload={handleUploadComplete} />
          </div>
        )}

        {activeTab === 'uploads' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent mb-2">
                Manage Uploads
              </h2>
              <p className="text-gray-400">View and delete your uploaded CSV files</p>
            </div>

            <div className="grid gap-4">
              {uploads.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">No uploads yet. Upload a CSV file to get started!</p>
                </div>
              ) : (
                uploads.map((upload) => (
                  <div key={upload.id} className="bg-dark-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-neon-blue/50 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-white">{upload.filename}</h3>
                          <span className="text-xs px-2 py-1 bg-neon-blue/20 text-neon-blue rounded-full">
                            {upload.source?.replace('csv_', '').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-400">
                          <span>{upload.count} transactions</span>
                          <span>{new Date(upload.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteUpload(upload.id)}
                        className="px-4 py-2 bg-neon-pink/20 text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/30 transition-all duration-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Spent */}
              <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-neon-pink/50 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">Total Spent</p>
                    <p className="text-2xl font-bold text-neon-pink">
                      ${stats.totalSpent.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-neon-pink/20 rounded-lg flex items-center justify-center">
                    <ArrowTrendingDownIcon className="w-6 h-6 text-neon-pink" />
                  </div>
                </div>
              </div>

              {/* Total Income */}
              <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-neon-green/50 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">Total Income</p>
                    <p className="text-2xl font-bold text-neon-green">
                      ${stats.totalIncome.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-neon-green/20 rounded-lg flex items-center justify-center">
                    <ArrowTrendingUpIcon className="w-6 h-6 text-neon-green" />
                  </div>
                </div>
              </div>

              {/* This Month */}
              <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-neon-blue/50 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">This Month</p>
                    <p className="text-2xl font-bold text-neon-blue">
                      ${stats.thisMonth.toLocaleString()}
                    </p>
                    <p className={`text-xs ${getMonthlyChange() > 0 ? 'text-neon-pink' : 'text-neon-green'}`}>
                      {getMonthlyChange() > 0 ? '+' : ''}{getMonthlyChange().toFixed(1)}% vs last month
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-neon-blue/20 rounded-lg flex items-center justify-center">
                    <ClockIcon className="w-6 h-6 text-neon-blue" />
                  </div>
                </div>
              </div>

              {/* Transaction Count */}
              <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-neon-yellow/50 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">Transactions</p>
                    <p className="text-2xl font-bold text-neon-yellow">
                      {stats.transactionCount}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-neon-yellow/20 rounded-lg flex items-center justify-center">
                    <CreditCardIcon className="w-6 h-6 text-neon-yellow" />
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Spending Trend */}
              <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <ChartBarIcon className="w-5 h-5 text-neon-blue" />
                  <span>Spending Trend (Last 30 Days)</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getSpendingTrend()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        formatter={(value) => [`$${value}`, 'Amount']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#00d4ff" 
                        strokeWidth={3}
                        dot={{ fill: '#00d4ff', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#00d4ff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <ChartBarIcon className="w-5 h-5 text-neon-green" />
                  <span>Spending by Category</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getCategoryData()}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {getCategoryData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={NEON_COLORS[index % NEON_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        formatter={(value) => [`$${value}`, 'Amount']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Legend */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {getCategoryData().map((item, index) => (
                    <div key={item.name} className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: NEON_COLORS[index % NEON_COLORS.length] }}
                      ></div>
                      <span className="text-sm text-gray-300">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <h3 className="text-xl font-bold text-white mb-6">Recent Transactions</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transactions.slice(0, 10).map((transaction, index) => (
                  <div 
                    key={transaction.id}
                    className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-gray-600/30 hover:border-neon-blue/30 transition-all duration-300"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-white">
                          {transaction.merchant_name || transaction.name || 'Unknown'}
                        </h4>
                        <span className={`font-bold ${transaction.amount < 0 ? 'text-neon-pink' : 'text-neon-green'}`}>
                          {transaction.amount < 0 ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="text-sm text-gray-400">{transaction.date}</span>
                        {transaction.category && (
                          <span className="text-xs px-2 py-1 bg-neon-blue/20 text-neon-blue rounded-full">
                            {transaction.category[0]}
                          </span>
                        )}
                        <span className="text-xs px-2 py-1 bg-gray-600/30 text-gray-400 rounded-full">
                          {transaction.source?.replace('csv_', '').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}