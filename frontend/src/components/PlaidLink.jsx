import React, { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import ApiService from '../services/api';

export default function PlaidLink({ onSuccess }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchLinkToken = async () => {
    try {
      setLoading(true);
      const userId = 'bill_user_1'; // In production, get from auth context
      const tokenData = await ApiService.createLinkToken(userId);
      setLinkToken(tokenData.link_token);
    } catch (error) {
      console.error('Error fetching link token:', error);
    } finally {
      setLoading(false);
    }
  };

  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    try {
      setLoading(true);
      const exchangeData = await ApiService.exchangePublicToken(publicToken);
      console.log('Plaid Link successful:', exchangeData);
      
      if (onSuccess) {
        onSuccess(exchangeData);
      }
    } catch (error) {
      console.error('Error exchanging public token:', error);
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  const onPlaidExit = useCallback((error, metadata) => {
    console.log('Plaid Link exit:', error, metadata);
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  });

  const handleClick = () => {
    if (linkToken) {
      open();
    } else {
      fetchLinkToken();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || (!ready && linkToken)}
      className="px-4 py-2 bg-bill-success text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        'Loading...'
      ) : linkToken ? (
        ready ? 'Connect Bank Account' : 'Preparing...'
      ) : (
        'Link Bank Account'
      )}
    </button>
  );
}