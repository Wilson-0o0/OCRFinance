import { openDB } from 'idb';

const DB_NAME = 'OCRFinanceDB';
const DB_VERSION = 3;
const STORE_NAME = 'transactions';
const USER_STORE = 'users';

export const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('date', 'date');
                store.createIndex('category', 'category');
                store.createIndex('username', 'username');
            } else {
                const store = transaction.objectStore(STORE_NAME);
                if (!store.indexNames.contains('username')) {
                    store.createIndex('username', 'username');
                }
            }
            if (!db.objectStoreNames.contains(USER_STORE)) {
                const userStore = db.createObjectStore(USER_STORE, { keyPath: 'username' });
                userStore.createIndex('role', 'role');
            }
        },
    });
};

export const addTransaction = async (transaction) => {
    const db = await initDB();
    return db.add(STORE_NAME, transaction);
};

export const getAllTransactions = async (username) => {
    const db = await initDB();
    if (username) {
        return db.getAllFromIndex(STORE_NAME, 'username', username);
    }
    return db.getAllFromIndex(STORE_NAME, 'date'); // Fallback or admin view if needed
};

export const deleteTransaction = async (id) => {
    const db = await initDB();
    return db.delete(STORE_NAME, id);
};

export const updateTransaction = async (transaction) => {
    const db = await initDB();
    return db.put(STORE_NAME, transaction);
};

export const checkDuplicate = async (transaction, username) => {
    const db = await initDB();
    let allTransactions;
    if (username) {
        allTransactions = await db.getAllFromIndex(STORE_NAME, 'username', username);
    } else {
        allTransactions = await db.getAllFromIndex(STORE_NAME, 'date');
    }

    return allTransactions.some(t =>
        t.date === transaction.date &&
        t.amount === transaction.amount &&
        t.merchant === transaction.merchant
    );
};

export const registerUser = async (user) => {
    const db = await initDB();
    return db.add(USER_STORE, user);
};

export const findUser = async (username) => {
    const db = await initDB();
    return db.get(USER_STORE, username);
};

export const getAllUsers = async () => {
    const db = await initDB();
    return db.getAll(USER_STORE);
};

export const deleteUser = async (username) => {
    const db = await initDB();
    return db.delete(USER_STORE, username);
};
