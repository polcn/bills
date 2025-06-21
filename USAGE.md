# Bill's Financial Management - Usage Guide

## 🎮 How to Use Your Financial Dashboard

### 1. Access Your Dashboard
Visit: `http://bill-finance-ui-1750520483.s3-website-us-east-1.amazonaws.com`

### 2. Upload Bank Transactions

#### AMEX CSV Format
Download from AMEX website with these columns:
```csv
Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
06/21/2025,STARBUCKS STORE #1234,JOHN DOE,XXXXX-12345,-4.50,"Coffee","STARBUCKS","123 MAIN ST","SEATTLE WA","98101","UNITED STATES","REF123","Food & Dining"
```

#### Truist CSV Format
Download from Truist with these columns:
```csv
Account Type,Account Number,Date,Description,Debit,Credit,Running Balance
Checking,****1234,06/21/2025,DIRECT DEPOSIT PAYROLL,,3000.00,5000.00
Checking,****1234,06/20/2025,AMAZON.COM,89.99,,2000.00
```

#### Generic CSV Format
Any CSV with at minimum:
```csv
Date,Description,Amount
06/21/2025,Coffee Shop,-4.50
06/20/2025,Salary,3000.00
```

### 3. Upload Process

1. **Select Bank Type**
   - AMEX (American Express)
   - Truist (including BB&T/SunTrust)  
   - Generic (any standard format)

2. **Drag & Drop or Click to Upload**
   - File size limit: 5MB
   - Format: CSV files only
   - Preview shows first 5 rows

3. **View Results**
   - Success animation confirms upload
   - Switch to Dashboard tab to see data

### 4. Dashboard Features

#### 📊 Statistics Cards
- **Total Spent:** All expenses (red)
- **Total Income:** All deposits (green)
- **This Month:** Current month spending (blue)
- **Transactions:** Total count (yellow)

#### 📈 Charts
- **Spending Trend:** Daily spending over last 30 days
- **Category Breakdown:** Pie chart of spending by category

#### 📋 Recent Transactions
- Last 10 transactions with details
- Color-coded by amount (red=expense, green=income)
- Source badges show data origin (AMEX, Truist, etc.)

### 5. Bank Download Instructions

#### American Express
1. Login to amex.com
2. Go to "Statements & Activity"
3. Select date range
4. Click "Download" → "Spreadsheet"
5. Save as CSV

#### Truist
1. Login to truist.com
2. Select account
3. Go to "Account Activity"
4. Click "Download/Export"
5. Select CSV format
6. Choose date range

#### Other Banks
Most banks offer CSV export in:
- Account Activity/History
- Statements section
- Download/Export options

### 6. Data Categories

The system automatically categorizes transactions:
- **Food & Drink:** Restaurants, coffee, groceries
- **Transportation:** Gas, Uber, parking
- **Shopping:** Amazon, retail stores
- **Healthcare:** Pharmacy, medical
- **Bills:** Utilities, subscriptions
- **Income:** Salary, deposits

### 7. Tips for Best Results

#### File Naming
- Include bank name: `amex_december_2024.csv`
- Use dates: `truist_2024_06.csv`
- Avoid spaces: use underscores or dashes

#### Data Quality
- Ensure all required columns are present
- Check date formats (MM/DD/YYYY preferred)
- Verify amounts are numeric
- Remove any header/footer text

#### Upload Order
- Start with oldest data first
- Upload one month at a time initially
- Can upload multiple accounts separately

### 8. Troubleshooting

#### Upload Fails
- Check file size (under 5MB)
- Verify CSV format
- Ensure required columns exist
- Try Generic format if bank-specific fails

#### Missing Data
- Check Dashboard tab after upload
- Allow 30 seconds for processing
- Refresh page if needed

#### Wrong Categories
- System learns from merchant names
- Manual categorization coming in future updates

### 9. Privacy & Security

- Data stays in your AWS account
- No third-party data sharing
- Bank credentials never stored
- CSV files processed and deleted

### 10. Future Features

Coming soon:
- Manual transaction editing
- Custom categories
- Budget tracking
- Bill splitting
- Mobile app
- Automated bank connections