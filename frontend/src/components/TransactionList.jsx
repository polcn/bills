import React from 'react';
import { format } from 'date-fns';

export default function TransactionList({ transactions = [] }) {
  const formatAmount = (amount) => {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${absAmount.toFixed(2)}`;
  };

  const getAmountColor = (amount) => {
    return amount < 0 ? 'text-bill-error' : 'text-bill-success';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Food and Drink': 'bg-orange-100 text-orange-800',
      'Transportation': 'bg-blue-100 text-blue-800',
      'Shopping': 'bg-purple-100 text-purple-800',
      'Healthcare': 'bg-green-100 text-green-800',
      'General': 'bg-gray-100 text-gray-800',
    };
    
    return colors[category?.[0]] || colors['General'];
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No transactions found for the selected period.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-bill-primary">
                {transaction.merchant_name || transaction.name || 'Unknown Merchant'}
              </h4>
              <span className={`font-semibold ${getAmountColor(transaction.amount)}`}>
                {formatAmount(transaction.amount)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600">
                {format(new Date(transaction.date), 'MMM dd, yyyy')}
              </span>
              
              {transaction.category && transaction.category[0] && (
                <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(transaction.category)}`}>
                  {transaction.category[0]}
                </span>
              )}
              
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                {transaction.source === 'plaid' ? 'Bank' : 
                 transaction.source === 'email_amazon' ? 'Email' :
                 transaction.source === 'receipt_ocr' ? 'Receipt' : 'Unknown'}
              </span>
            </div>
            
            {transaction.location?.address && (
              <p className="text-xs text-gray-500 mt-1">
                {transaction.location.address}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}