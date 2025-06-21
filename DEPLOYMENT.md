# Bill's Financial Management - Deployment Guide

## 🚀 Current Live Deployment

- **API Endpoint:** `https://8bvnp8f956.execute-api.us-east-1.amazonaws.com/dev`
- **Frontend URL:** `http://bill-finance-ui-1750520483.s3-website-us-east-1.amazonaws.com`
- **Region:** `us-east-1`

## 📋 Deployed Resources

### AWS Lambda Functions
- `bill-finance-minimal-dev-api` - Main API handler
- `bill-finance-minimal-dev-syncPlaidTransactions` - Transaction sync (future use)

### Amazon DynamoDB
- `bill-finance-minimal-dev-transactions` - Transaction storage

### Amazon S3
- `bill-csv-uploads-1750517575` - CSV file uploads
- `bill-finance-ui-1750520483` - Frontend hosting

### Amazon API Gateway
- `dev-bill-finance-minimal` - REST API

## 🔧 Deployment Commands

### Backend Deployment
```bash
# Install dependencies
npm install

# Deploy to AWS
npx serverless deploy --stage dev

# Update specific function
zip function.zip handler.js
aws lambda update-function-code --function-name bill-finance-minimal-dev-api --zip-file fileb://function.zip
```

### Frontend Deployment
```bash
cd frontend
npm install
npm run build
aws s3 sync dist/ s3://bill-finance-ui-1750520483 --delete
```

## 🔐 Environment Variables

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

## 🏗️ Infrastructure Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   S3 Frontend   │    │   API Gateway    │    │     Lambda      │
│                 │◄──►│                  │◄──►│                 │
│ React Dashboard │    │ REST Endpoints   │    │ CSV Processing  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐             │
                       │   DynamoDB      │◄────────────┘
                       │                 │
                       │  Transactions   │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   S3 Uploads    │
                       │                 │
                       │   CSV Files     │
                       └─────────────────┘
```

## 🔄 CI/CD Setup (Future)

To set up automated deployment:

1. Create GitHub Actions workflow
2. Add AWS credentials to GitHub secrets
3. Automate testing and deployment on push

## 📊 Monitoring

- **Logs:** CloudWatch `/aws/lambda/bill-finance-minimal-dev-api`
- **Metrics:** Lambda execution time, error rates
- **Costs:** Monitor AWS billing dashboard

## 🔧 Troubleshooting

### Common Issues
1. **API returning 500 errors:** Check Lambda logs in CloudWatch
2. **CORS issues:** Verify headers in handler.js
3. **Upload failures:** Check S3 permissions and bucket access
4. **Frontend not loading:** Verify S3 bucket policy for public access

### Useful Commands
```bash
# Check API health
curl https://8bvnp8f956.execute-api.us-east-1.amazonaws.com/dev/health

# View Lambda logs
aws logs filter-log-events --log-group-name "/aws/lambda/bill-finance-minimal-dev-api"

# Test file upload
curl -X POST https://8bvnp8f956.execute-api.us-east-1.amazonaws.com/dev/upload/csv \
  -H "Content-Type: application/json" \
  -d '{"csvContent":"Date,Amount\n2025-06-21,-50","fileName":"test.csv"}'
```