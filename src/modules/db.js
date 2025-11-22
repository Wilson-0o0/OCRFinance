import { openDB } from 'idb';

const DB_NAME = 'OCRFinanceDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

export const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('date', 'date');
                store.createIndex('category', 'category');
            }
        },
    });
};

export const addTransaction = async (transaction) => {
    const db = await initDB();
    return db.add(STORE_NAME, transaction);
};

export const getAllTransactions = async () => {
    const db = await initDB();
    return db.getAllFromIndex(STORE_NAME, 'date');
};

export const deleteTransaction = async (id) => {
    const db = await initDB();
    return db.delete(STORE_NAME, id);
};

export const updateTransaction = async (transaction) => {
    const db = await initDB();
    return db.put(STORE_NAME, transaction);
};

export const checkDuplicate = async (transaction) => {
    const db = await initDB();
    const allTransactions = await db.getAllFromIndex(STORE_NAME, 'date');
    // Filter in memory for now (IndexedDB compound indexes are tricky without a library)
    return allTransactions.some(t =>
        t.date === transaction.date &&
        t.amount === transaction.amount &&
        t.merchant === transaction.merchant
    );
};
