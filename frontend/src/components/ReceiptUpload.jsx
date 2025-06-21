import React, { useState, useRef } from 'react';
import { CloudArrowUpIcon, DocumentIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function ReceiptUpload({ onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a valid image (JPG, PNG) or PDF file.');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB.');
      return;
    }

    try {
      setUploading(true);
      setUploadSuccess(false);

      // For now, we'll simulate the upload process
      // In production, this would upload to S3 which triggers the receipt processing
      await simulateUpload(file);
      
      setUploadSuccess(true);
      if (onUpload) {
        onUpload();
      }

      // Reset success state after 3 seconds
      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);

    } catch (error) {
      console.error('Error uploading receipt:', error);
      alert('Error uploading receipt. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const simulateUpload = (file) => {
    return new Promise((resolve) => {
      // Simulate upload delay
      setTimeout(() => {
        console.log('Receipt uploaded:', file.name);
        resolve();
      }, 2000);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    handleFileUpload(Array.from(e.target.files));
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragOver 
            ? 'border-bill-accent bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={!uploading ? handleClick : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bill-accent mb-3"></div>
            <p className="text-bill-primary font-medium">Processing receipt...</p>
            <p className="text-sm text-gray-500">This may take a few moments</p>
          </div>
        ) : uploadSuccess ? (
          <div className="flex flex-col items-center">
            <CheckCircleIcon className="h-12 w-12 text-bill-success mb-3" />
            <p className="text-bill-success font-medium">Receipt uploaded successfully!</p>
            <p className="text-sm text-gray-500">Transaction will appear shortly</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-bill-primary font-medium mb-1">
              Drop your receipt here or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-3">
              Supports JPG, PNG, and PDF files up to 10MB
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <DocumentIcon className="h-4 w-4" />
              <span>Receipts are processed automatically with OCR technology</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>💡 <strong>Tips for better results:</strong></p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Ensure the receipt is well-lit and clearly visible</li>
          <li>Avoid shadows or glare on the receipt</li>
          <li>Include the entire receipt with totals and merchant info</li>
        </ul>
      </div>
    </div>
  );
}