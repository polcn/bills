import React, { useState, useRef, useCallback } from 'react';
import { CloudArrowUpIcon, DocumentIcon, CheckCircleIcon, ExclamationTriangleIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const API_BASE_URL = 'https://8bvnp8f956.execute-api.us-east-1.amazonaws.com/dev';

export default function CSVUpload({ onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [bankType, setBankType] = useState('generic');
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please upload a CSV file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(false);

      // Read file content
      const csvContent = await readFileAsText(file);
      
      // Show preview
      const lines = csvContent.split('\n').slice(0, 5);
      setPreview({
        fileName: file.name,
        lines: lines,
        totalLines: csvContent.split('\n').length
      });

      // Auto-detect bank type from filename
      const detectedBankType = detectBankType(file.name);
      if (detectedBankType !== 'generic') {
        setBankType(detectedBankType);
      }

      // Upload to API
      const response = await fetch(`${API_BASE_URL}/upload/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvContent: csvContent,
          fileName: file.name,
          bankType: bankType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      
      setUploadSuccess(true);
      
      if (onUploadComplete) {
        onUploadComplete(result);
      }

      // Reset success state after 5 seconds
      setTimeout(() => {
        setUploadSuccess(false);
        setPreview(null);
      }, 5000);

    } catch (error) {
      console.error('Error uploading CSV:', error);
      setUploadError(error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [bankType, onUploadComplete]);

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const detectBankType = (fileName) => {
    const name = fileName.toLowerCase();
    if (name.includes('amex') || name.includes('american')) return 'amex';
    if (name.includes('truist') || name.includes('bb&t') || name.includes('suntrust')) return 'truist';
    return 'generic';
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleClick = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    handleFileUpload(Array.from(e.target.files));
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Bank Type Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Bank Type
        </label>
        <div className="flex space-x-4">
          {[
            { value: 'amex', label: 'American Express', color: 'neon-blue' },
            { value: 'truist', label: 'Truist', color: 'neon-purple' },
            { value: 'generic', label: 'Generic CSV', color: 'neon-green' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setBankType(option.value)}
              className={`px-4 py-2 rounded-lg border-2 transition-all duration-300 font-medium ${
                bankType === option.value
                  ? `border-${option.color} bg-${option.color}/10 text-${option.color} shadow-lg`
                  : 'border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 bg-dark-800/50 backdrop-blur-sm
          ${dragOver 
            ? 'border-neon-blue bg-neon-blue/5 shadow-2xl shadow-neon-blue/20' 
            : 'border-gray-600 hover:border-gray-500'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        {/* Background Grid */}
        <div className="absolute inset-0 bg-cyber-grid bg-grid opacity-20 rounded-xl"></div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="relative z-10 flex flex-col items-center space-y-4">
            <div className="w-16 h-16 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-neon-blue font-bold text-lg">Processing CSV...</p>
              <p className="text-gray-400 text-sm">Parsing transactions and storing data</p>
            </div>
          </div>
        ) : uploadSuccess ? (
          <div className="relative z-10 flex flex-col items-center space-y-4 animate-float">
            <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center animate-glow">
              <CheckCircleIcon className="w-8 h-8 text-neon-green" />
            </div>
            <div className="text-center">
              <p className="text-neon-green font-bold text-lg">Upload Successful!</p>
              <p className="text-gray-400 text-sm">Your transactions are being processed</p>
            </div>
          </div>
        ) : uploadError ? (
          <div className="relative z-10 flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-neon-pink/20 rounded-full flex items-center justify-center">
              <ExclamationTriangleIcon className="w-8 h-8 text-neon-pink" />
            </div>
            <div className="text-center">
              <p className="text-neon-pink font-bold text-lg">Upload Failed</p>
              <p className="text-gray-400 text-sm">{uploadError}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); setUploadError(null); }}
                className="mt-2 text-neon-blue hover:text-neon-blue/80 text-sm underline"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center hover:animate-pulse">
              <CloudArrowUpIcon className="w-8 h-8 text-neon-blue" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg mb-2">
                Drop your {bankType.toUpperCase()} CSV here
              </p>
              <p className="text-gray-400 text-sm mb-4">
                or click to browse files
              </p>
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                <DocumentIcon className="w-4 h-4" />
                <span>CSV files only • Max 5MB</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File Preview */}
      {preview && !uploading && (
        <div className="mt-6 bg-dark-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center space-x-2">
              <ChartBarIcon className="w-5 h-5 text-neon-green" />
              <span>Preview: {preview.fileName}</span>
            </h3>
            <span className="text-gray-400 text-sm">{preview.totalLines} rows</span>
          </div>
          
          <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            {preview.lines.map((line, index) => (
              <div 
                key={index} 
                className={`${index === 0 ? 'text-neon-blue font-bold' : 'text-gray-300'} whitespace-nowrap`}
              >
                {line}
              </div>
            ))}
            {preview.totalLines > 5 && (
              <div className="text-gray-500 mt-2">
                ... and {preview.totalLines - 5} more rows
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-dark-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
          <h4 className="text-neon-blue font-bold mb-2">📊 AMEX</h4>
          <p className="text-gray-400">Login → Statements → Download CSV with all transactions</p>
        </div>
        <div className="bg-dark-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
          <h4 className="text-neon-purple font-bold mb-2">🏦 Truist</h4>
          <p className="text-gray-400">Login → Account → Export → CSV format with dates</p>
        </div>
        <div className="bg-dark-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
          <h4 className="text-neon-green font-bold mb-2">📈 Generic</h4>
          <p className="text-gray-400">Any CSV with Date, Description, Amount columns</p>
        </div>
      </div>
    </div>
  );
}