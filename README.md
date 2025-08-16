# 💰 Bill's Financial Management System

A sleek, cyber-themed serverless financial management system built on AWS with CSV upload capabilities for automated transaction tracking and beautiful data visualization.

## 🎮 Live Demo

- **🌐 Dashboard:** http://bill-finance-ui-1750520483.s3-website-us-east-1.amazonaws.com
- **🔗 API:** https://8bvnp8f956.execute-api.us-east-1.amazonaws.com/dev

## ✨ Features

### 🎨 Modern Cyber UI
- **Dark theme** with neon blue/green/purple accents
- **Animated components** with smooth transitions
- **Responsive design** that looks great on all devices
- **Real-time data visualization** with interactive charts

### 📊 Multi-Source Data Ingestion
- **CSV Upload** - Smart bank detection (AMEX, Truist, Generic)
- **Receipt Upload** - Photo processing with OCR capabilities
- **Drag & drop interface** with live preview for all uploads
- **Automatic categorization** of transactions
- **Real-time validation** and error handling

### 📈 Financial Dashboard
- **Spending statistics** with trend analysis
- **Interactive charts** showing spending patterns
- **Category breakdown** with colorful pie charts
- **Recent transactions** with detailed information

### 🏗️ Serverless Architecture
- **AWS Lambda** for serverless compute
- **API Gateway** for REST endpoints
- **DynamoDB** for transaction storage
- **S3** for file uploads and hosting

## 🚀 Quick Start

### For Users
1. Visit the dashboard: http://bill-finance-ui-1750520483.s3-website-us-east-1.amazonaws.com
2. **Upload CSV files** from your bank (AMEX, Truist, etc.)
3. **Upload receipt photos** for automatic processing
4. View your financial data with beautiful cyber-themed visualizations

### For Developers
```bash
# Clone the repository
git clone <your-repo-url>
cd bill

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Build and deploy
npm run build
```

## 📱 Supported Banks

### American Express
- Download from AMEX online banking
- Full transaction details with merchant info
- Automatic categorization

### Truist (BB&T/SunTrust)
- Standard CSV export format
- Debit/Credit transaction handling
- Account balance tracking

### Generic CSV
- Any bank with standard CSV format
- Minimum required: Date, Description, Amount
- Flexible column mapping

## 📖 Documentation

- **[Usage Guide](USAGE.md)** - How to use the dashboard
- **[Deployment Guide](DEPLOYMENT.md)** - Technical deployment details
- **[Issues & Fixes](ISSUES.md)** - Known issues and resolutions
- **[API Documentation](API.md)** - REST API endpoints
- **[MCP Servers](MCP_SERVERS.md)** - Model Context Protocol integrations
- **[Subagents](SUBAGENTS.md)** - Specialized AI assistants for development

## 🛠️ Tech Stack

### Frontend
- **React 18** with modern hooks
- **Tailwind CSS** with custom cyber theme
- **Recharts** for data visualization
- **Heroicons** for beautiful icons

### Backend
- **Node.js 18** with AWS Lambda
- **API Gateway** for REST endpoints
- **DynamoDB** for data storage
- **S3** for file handling

### DevOps
- **Serverless Framework** for infrastructure
- **AWS CloudFormation** for resource management
- **GitHub** for version control

## 🎯 Project Structure

```
bill/
├── 📁 .claude/
│   └── agents/            # Specialized AI subagents
├── 📁 frontend/           # React application
│   ├── src/components/    # UI components
│   └── src/services/      # API services
├── 📄 handler.js         # Lambda function (all backend logic)
├── 📄 serverless.yml     # Infrastructure config
├── 📄 README.md          # This file
├── 📄 USAGE.md           # User guide
├── 📄 DEPLOYMENT.md      # Deploy guide
├── 📄 MCP_SERVERS.md     # MCP documentation
└── 📄 SUBAGENTS.md       # Subagent documentation
```

## 🔧 Environment Setup

### Backend (.env)
```bash
PLAID_CLIENT_ID=placeholder
PLAID_SECRET=placeholder
PLAID_ENV=sandbox
```

### Frontend (.env)
```bash
REACT_APP_API_URL=https://8bvnp8f956.execute-api.us-east-1.amazonaws.com/dev
REACT_APP_VERSION=2.0.0
```

## 🚀 Deployment

### Quick Deploy
```bash
# Deploy backend
npx serverless deploy --stage dev

# Deploy frontend
cd frontend
npm run build
aws s3 sync dist/ s3://your-bucket --delete
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 📊 Current Status

- ✅ **MVP Complete** - Core functionality working with real data
- ✅ **UI Deployed** - Live cyber-themed dashboard at http://bill-finance-ui-1750520483.s3-website-us-east-1.amazonaws.com
- ✅ **CSV Upload** - AMEX and Truist formats fully working
- ✅ **Receipt Upload** - Photo upload with mock OCR processing (demo mode)
- ✅ **Data Visualization** - Charts and statistics with real transaction data
- ✅ **Duplicate Prevention** - Cross-session and cross-source duplicate detection
- ✅ **Upload Management** - Delete uploads via "Manage Uploads" tab  
- ✅ **Persistent Storage** - DynamoDB with cold-start loading and memory caching
- ✅ **Cross-Source Detection** - Same transaction from multiple banks prevented
- ❌ **Upload Deletion** - BROKEN: Deleted transactions reappear after cold starts
- ✅ **Multi-Source Ingestion** - CSV files and receipt photos
- 📋 **Future:** Email receipt parsing, budget tracking, bill splitting, full Textract OCR

## 🤝 Contributing

This is a personal financial management system for Bill. For feature requests or bugs, please create issues in the repository.

## 📄 License

Private project - All rights reserved.

## 🎮 Built with Cyber Vibes

Created with a futuristic aesthetic featuring:
- Neon color schemes
- Smooth animations
- Grid backgrounds
- Glowing effects
- Modern typography

*Making personal finance management look cool since 2025* ✨