# Known Issues and Fixes

## Fixed Issues

### 🔧 CRITICAL FIX: Delete Upload Functionality
**Issue:** Deleting uploads only removed transactions from memory, not DynamoDB. After Lambda cold starts, deleted transactions would reappear.

**Root Cause:** Delete function only operated on `global.transactionStore` memory but didn't delete from persistent DynamoDB storage.

**Fix Applied:** 
- Added `deleteFromDynamoDB()` function to permanently remove transactions
- Modified delete endpoint to remove from both memory AND DynamoDB
- Ensures deletions persist across Lambda cold starts

**Status:** ✅ RESOLVED - Transactions now permanently deleted from both memory and DynamoDB

### 🔧 Data Persistence Enhancement
**Issue:** Data could appear to be lost during Lambda cold starts.

**Root Cause:** Hybrid memory/DynamoDB architecture had initialization conflicts.

**Fix Applied:**
- Improved `initializeStorage()` to properly load from DynamoDB on cold starts
- Removed duplicate loading logic that could cause conflicts
- Enhanced error handling for DynamoDB operations

**Status:** ✅ RESOLVED - Data now persists reliably across cold starts

### 🔧 Cross-Source Duplicate Detection
**Issue:** Same transaction from different banks could be uploaded multiple times.

**Root Cause:** Duplicate keys were bank-specific instead of transaction-specific.

**Fix Applied:**
- Implemented `generateDuplicateKey()` with normalized transaction matching
- Cross-source detection works across AMEX, Truist, and generic CSV formats
- Duplicate checking now queries both memory and DynamoDB

**Status:** ✅ RESOLVED - Duplicates prevented across all sources and sessions

## Architecture Notes

### Current Storage System
- **Hybrid Architecture:** Memory caching + DynamoDB persistence
- **Cold Start Handling:** Automatic DynamoDB loading on Lambda initialization
- **Delete Operations:** Synchronous removal from both memory and DynamoDB
- **Duplicate Prevention:** Cross-session and cross-source detection

### Performance Characteristics
- **Read Operations:** Sub-second response via memory cache
- **Write Operations:** Immediate memory + background DynamoDB save
- **Delete Operations:** Immediate memory + synchronous DynamoDB delete
- **Data Consistency:** Eventually consistent with strong delete consistency

*Last Updated: June 22, 2025*