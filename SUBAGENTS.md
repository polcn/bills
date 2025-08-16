# 🤖 AI Subagents Documentation

This project includes specialized AI subagents designed to handle specific aspects of the financial management system. Each subagent has focused expertise and limited tool access for safety and efficiency.

## 📋 Available Subagents

### 1. dynamodb-debugger
**Purpose**: Fix and optimize DynamoDB operations  
**Priority**: 🚨 CRITICAL - Fixing delete functionality bug  
**Tools**: Read, Bash, Grep, Edit, MultiEdit  
**Key Tasks**:
- Fix the critical bug where deleted transactions reappear after Lambda cold starts
- Optimize DynamoDB queries and scans
- Ensure data consistency between memory cache and database
- Debug persistence issues

**Usage**: `Use the dynamodb-debugger to fix the delete issue`

---

### 2. csv-parser-specialist
**Purpose**: Handle CSV parsing for various bank formats  
**Tools**: Read, Write, Edit, MultiEdit, Bash, Grep  
**Supported Banks**:
- American Express (AMEX)
- Truist (BB&T/SunTrust)
- Generic CSV format
- Ready to add: Chase, Bank of America, Wells Fargo, Capital One

**Key Tasks**:
- Fix parsing bugs and edge cases
- Add support for new bank formats
- Handle malformed CSV files
- Improve date and amount parsing

**Usage**: `Have the csv-parser-specialist add Chase bank support`

---

### 3. transaction-analyzer
**Purpose**: Analyze spending patterns and provide insights  
**Tools**: Read, Grep, Bash, Write  
**Capabilities**:
- Identify spending trends and patterns
- Detect recurring subscriptions
- Find anomalies and unusual transactions
- Categorize transactions intelligently
- Generate spending summaries

**Usage**: `Ask the transaction-analyzer to find all my subscriptions`

---

### 4. duplicate-detective
**Purpose**: Prevent and resolve duplicate transactions  
**Tools**: Read, Grep, Bash, Edit, MultiEdit  
**Features**:
- Cross-source duplicate detection (same transaction from multiple banks)
- Fuzzy matching for similar transactions
- Smart merging rules
- False positive/negative handling

**Key Focus**: Preventing duplicates when uploading from multiple banks or re-uploading files

**Usage**: `Get the duplicate-detective to improve duplicate detection`

---

### 5. financial-reporter
**Purpose**: Generate comprehensive financial reports  
**Tools**: Read, Write, Bash, Grep  
**Report Types**:
- Monthly/Annual summaries
- Tax-deductible expenses
- Budget vs actual analysis
- Category breakdowns
- Custom reports

**Export Formats**: PDF, CSV, JSON, HTML, TXT

**Usage**: `Have the financial-reporter generate a monthly summary`

---

### 6. receipt-processor
**Purpose**: Handle receipt OCR and processing  
**Tools**: Read, Write, Edit, WebFetch, Bash  
**Current Status**: Mock implementation (needs Textract integration)  
**Capabilities**:
- Extract merchant, date, amount from receipts
- Parse line items
- Match receipts to transactions
- Support various receipt formats

**Usage**: `Get the receipt-processor to implement Textract integration`

---

### 7. aws-infrastructure
**Purpose**: Manage AWS resources and deployments  
**Tools**: Bash, Read, Edit, Write  
**Responsibilities**:
- Deploy updates safely
- Monitor and optimize costs
- Improve performance
- Ensure security best practices
- Manage Lambda, DynamoDB, S3, API Gateway

**Usage**: `Have aws-infrastructure optimize our Lambda memory settings`

---

### 8. ui-enhancer
**Purpose**: Improve frontend UI/UX  
**Tools**: Read, Write, Edit, Glob, MultiEdit  
**Tech Stack**: React 18, Tailwind CSS, Recharts  
**Focus Areas**:
- Add new visualizations (heatmaps, sparklines, budget rings)
- Enhance mobile responsiveness
- Improve cyber theme aesthetics
- Optimize performance
- Implement accessibility features

**Usage**: `Ask the ui-enhancer to add a spending heatmap`

---

### 9. data-migration
**Purpose**: Handle data operations and migrations  
**Tools**: Read, Write, Bash, Edit, Grep  
**Capabilities**:
- Import/Export in multiple formats (CSV, JSON, QIF)
- Create and restore backups
- Bulk operations (update, delete)
- Data cleaning and normalization
- Migration between storage systems

**Usage**: `Have data-migration create a backup of all transactions`

---

## 🚀 How to Use Subagents

### Explicit Invocation
Simply mention the subagent by name and describe the task:
- "Use the dynamodb-debugger to investigate why deletes aren't working"
- "Have the csv-parser-specialist add support for Wells Fargo"
- "Get the financial-reporter to generate a tax report"

### Automatic Delegation
Claude Code may automatically delegate tasks to appropriate subagents based on context.

## 📁 Subagent Location
All subagent configurations are stored in: `.claude/agents/`

Each subagent is a Markdown file with:
- YAML frontmatter (name, description, tools)
- Detailed system prompt
- Specific instructions and context

## 🔧 Creating Custom Subagents

To create a new subagent:

1. Create a file in `.claude/agents/[name].md`
2. Add YAML frontmatter:
```yaml
---
name: your-subagent-name
description: Brief description
tools: Read, Write, Edit
---
```
3. Write a detailed system prompt below the frontmatter

## 📈 Best Practices

1. **Use the right subagent** - Each has specialized knowledge
2. **Be specific** - Clear instructions get better results
3. **Chain subagents** - Complex tasks may need multiple specialists
4. **Trust their expertise** - Subagents are configured for their domains

## 🎯 Priority Tasks

### Critical Issues
1. **Delete Bug**: Use `dynamodb-debugger` to fix transaction deletion
2. **Receipt OCR**: Use `receipt-processor` to implement Textract

### Enhancements
1. **New Banks**: Use `csv-parser-specialist` for more bank support
2. **Reports**: Use `financial-reporter` for tax season
3. **UI**: Use `ui-enhancer` for better visualizations

---

*Last Updated: August 16, 2025*