import { initDB, deleteTransaction } from '../modules/db.js';
import { db } from '../firebase-config.js';
import { doc, deleteDoc } from 'firebase/firestore';

/**
 * Cleanup script to delete transactions with undefined or null amounts
 * Deletes from BOTH IndexedDB and Firestore to prevent sync issues
 */
export const cleanupInvalidTransactions = async () => {
    try {
        const dbInstance = await initDB();
        const allTransactions = await dbInstance.getAll('transactions');

        console.log(`Total transactions found: ${allTransactions.length}`);

        // Find transactions with invalid amounts
        const invalidTransactions = allTransactions.filter(t => {
            return t.amount === undefined ||
                t.amount === null ||
                isNaN(t.amount) ||
                t.amount === '';
        });

        console.log(`Found ${invalidTransactions.length} transactions with invalid amounts:`);

        if (invalidTransactions.length === 0) {
            console.log('✅ No invalid transactions found. Database is clean!');
            return {
                success: true,
                deletedCount: 0,
                message: 'No invalid transactions found'
            };
        }

        // Log details of invalid transactions
        invalidTransactions.forEach((t, index) => {
            console.log(`${index + 1}. ID: ${t.id}, Date: ${t.date}, Merchant: ${t.merchant}, Amount: ${t.amount}, FirestoreID: ${t.firestoreId || 'N/A'}`);
        });

        // Ask for confirmation
        const confirmed = confirm(
            `Found ${invalidTransactions.length} transaction(s) with invalid amounts.\n\n` +
            `These will be deleted from BOTH local database AND Firestore.\n\n` +
            `Do you want to delete them?\n\n` +
            `This action cannot be undone!`
        );

        if (!confirmed) {
            console.log('❌ Cleanup cancelled by user');
            return {
                success: false,
                deletedCount: 0,
                message: 'Cleanup cancelled by user'
            };
        }

        // Delete invalid transactions from both IndexedDB and Firestore
        let deletedCount = 0;
        let firestoreDeletedCount = 0;

        for (const transaction of invalidTransactions) {
            try {
                // Delete from IndexedDB
                await deleteTransaction(transaction.id);
                deletedCount++;
                console.log(`✅ Deleted from IndexedDB - ID: ${transaction.id}`);

                // Delete from Firestore if it has a firestoreId
                if (transaction.firestoreId) {
                    try {
                        const docRef = doc(db, 'transactions', transaction.firestoreId);
                        await deleteDoc(docRef);
                        firestoreDeletedCount++;
                        console.log(`✅ Deleted from Firestore - ID: ${transaction.firestoreId}`);
                    } catch (firestoreError) {
                        console.warn(`⚠️ Failed to delete from Firestore (ID: ${transaction.firestoreId}):`, firestoreError.message);
                    }
                }
            } catch (error) {
                console.error(`❌ Failed to delete transaction ID: ${transaction.id}`, error);
            }
        }

        console.log(`\n✅ Cleanup complete!`);
        console.log(`   - Deleted ${deletedCount} from IndexedDB`);
        console.log(`   - Deleted ${firestoreDeletedCount} from Firestore`);

        return {
            success: true,
            deletedCount,
            firestoreDeletedCount,
            totalInvalid: invalidTransactions.length,
            message: `Successfully deleted ${deletedCount} invalid transactions (${firestoreDeletedCount} from Firestore)`
        };

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        return {
            success: false,
            deletedCount: 0,
            error: error.message
        };
    }
};

/**
 * List all transactions with invalid amounts without deleting them
 */
export const listInvalidTransactions = async () => {
    try {
        const dbInstance = await initDB();
        const allTransactions = await dbInstance.getAll('transactions');

        const invalidTransactions = allTransactions.filter(t => {
            return t.amount === undefined ||
                t.amount === null ||
                isNaN(t.amount) ||
                t.amount === '';
        });

        console.log(`Found ${invalidTransactions.length} transactions with invalid amounts:`);
        console.table(invalidTransactions.map(t => ({
            ID: t.id,
            Date: t.date,
            Merchant: t.merchant,
            Amount: t.amount,
            Type: t.type,
            Category: t.category,
            Account: t.accountId,
            FirestoreID: t.firestoreId || 'N/A'
        })));

        return invalidTransactions;

    } catch (error) {
        console.error('❌ Error listing invalid transactions:', error);
        return [];
    }
};

// Make functions available globally for console access
if (typeof window !== 'undefined') {
    window.cleanupInvalidTransactions = cleanupInvalidTransactions;
    window.listInvalidTransactions = listInvalidTransactions;
}
