import React, { useState, useEffect } from 'react';
import CyberDashboard from './components/CyberDashboard';
import './App.css';

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate initial load
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto">
            <div className="w-full h-full border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-neon-blue to-neon-green bg-clip-text text-transparent">
              Bill's Finance
            </h1>
            <p className="text-gray-400 text-sm mt-2">Initializing Cyber Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <CyberDashboard />
    </div>
  );
}