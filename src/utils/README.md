# Database Cleanup Utility

This utility helps identify and remove transactions with invalid or missing amount values from **both IndexedDB and Firestore**.

## What It Does

The cleanup script identifies and deletes transactions with:
- `undefined` amount values
- `null` amount values
- `NaN` (Not a Number) amount values
- Empty string amount values

**Important:** The script deletes from **BOTH** your local IndexedDB database **AND** Firestore cloud storage to prevent invalid transactions from syncing back.

## How to Use

### Method 1: Using the UI (Recommended)

1. Open the OCRFinance application
2. Navigate to **Settings** (click the gear icon in the sidebar)
3. Scroll down to the **Database Maintenance** section
4. Click **"List Invalid Transactions"** to see how many invalid transactions exist
   - Results will be shown on the page
   - Detailed information will be logged to the browser console
5. Click **"Delete Invalid Transactions"** to remove them
   - You'll be asked to confirm before deletion
   - The number of deleted transactions will be displayed

### Method 2: Using Browser Console

You can also run the cleanup functions directly from the browser console:

```javascript
// List invalid transactions without deleting them
await listInvalidTransactions();

// Delete invalid transactions (will ask for confirmation)
await cleanupInvalidTransactions();
```

## What Happens After Cleanup

- Invalid transactions are permanently deleted from **IndexedDB** (local database)
- Invalid transactions are permanently deleted from **Firestore** (cloud database)
- The dashboard and transaction list will automatically refresh
- Your data will be cleaner and the app will run without errors
- Invalid transactions won't sync back from Firestore on other devices

## Safety Features

- ✅ **Confirmation required**: You must confirm before any deletions occur
- ✅ **Preview available**: You can list invalid transactions before deleting
- ✅ **Detailed logging**: All actions are logged to the console
- ✅ **Non-destructive listing**: The "List" function only reads data, never modifies it

## When to Use This

Run the cleanup utility if you:
- See errors like "Cannot read properties of undefined (reading 'toFixed')"
- Notice transactions displaying as "$0.00" when they shouldn't
- Have imported old data that may be incomplete
- Experience calculation errors in the dashboard

## Technical Details

The cleanup script is located at:
- `src/utils/cleanupTransactions.js`

It's imported and used in:
- `src/modules/ui.js` (Settings view)

The script uses the existing database functions from `src/modules/db.js` to safely delete transactions.
