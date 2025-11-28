import { db } from '../firebase-config.js';
import { collection, doc, setDoc, getDocs, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { getAllTransactions, addTransaction, updateTransaction, checkDuplicate } from './db.js';

const TRANSACTIONS_COLLECTION = 'transactions';
const USERS_COLLECTION = 'users';

// Backup local transactions to Firestore
export const backupToFirestore = async (uid) => {
    if (!uid) return;
    console.log(`Starting backup for ${uid}...`);

    try {
        const transactions = await getAllTransactions(uid);
        if (transactions.length === 0) return;

        const batch = writeBatch(db);
        let updatesCount = 0;

        for (const transaction of transactions) {
            let docRef;
            if (transaction.firestoreId) {
                // Update existing document
                docRef = doc(db, TRANSACTIONS_COLLECTION, transaction.firestoreId);
                batch.set(docRef, {
                    ...transaction,
                    userId: uid,
                    syncedAt: new Date().toISOString()
                }, { merge: true });
            } else {
                // Create new document
                docRef = doc(collection(db, TRANSACTIONS_COLLECTION));
                const firestoreId = docRef.id;

                // Update local transaction with firestoreId immediately
                await updateTransaction({ ...transaction, firestoreId });

                batch.set(docRef, {
                    ...transaction,
                    firestoreId: firestoreId,
                    userId: uid,
                    syncedAt: new Date().toISOString()
                });
            }
            updatesCount++;
        }

        if (updatesCount > 0) {
            await batch.commit();
            console.log(`Backup complete for ${uid}. Synced ${updatesCount} items.`);
        }

    } catch (error) {
        console.error("Error backing up:", error);
    }
};

// Restore transactions from Firestore to local DB
export const restoreFromFirestore = async (uid) => {
    if (!uid) return;
    console.log(`Restoring data for ${uid}...`);

    try {
        const q = query(collection(db, TRANSACTIONS_COLLECTION), where("userId", "==", uid));
        const querySnapshot = await getDocs(q);

        for (const docSnapshot of querySnapshot.docs) {
            const data = docSnapshot.data();
            const firestoreId = docSnapshot.id;

            // Check if exists locally by firestoreId or duplicate check
            // We need a better check. For now, let's check if we have a transaction with this firestoreId
            // Since our local DB doesn't index firestoreId, we might need to rely on the old checkDuplicate for now
            // OR we can just check duplicate based on content if firestoreId is missing locally.

            const isDuplicate = await checkDuplicate(data, uid);

            if (!isDuplicate) {
                const { userId, syncedAt, ...transactionData } = data;
                await addTransaction({ ...transactionData, firestoreId, username: uid });
            } else {
                // If it exists (duplicate content), we should ensure it has the firestoreId if it's missing
                // This is a bit complex without a direct lookup. 
                // For this iteration, let's assume if it's a duplicate content-wise, we might want to update it to have the ID?
                // Let's keep it simple: Only add if not duplicate.
                // Ideally we should update the local copy to have the firestoreId if it matches content but lacks ID.
            }
        }
        console.log(`Restore complete for ${uid}.`);
    } catch (error) {
        console.error("Error restoring:", error);
    }
};

export const getUserRole = async (uid) => {
    try {
        const userDocRef = doc(db, USERS_COLLECTION, uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Error getting user role:", error);
        return null;
    }
};

export const saveUserToFirestore = async (user) => {
    try {
        const userRef = doc(db, USERS_COLLECTION, user.uid);
        await setDoc(userRef, user, { merge: true });
    } catch (error) {
        console.error("Error saving user:", error);
    }
};

export const syncData = async (uid) => {
    await restoreFromFirestore(uid);
    await backupToFirestore(uid);
};

export const getAllUsersFromFirestore = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
        const users = [];
        querySnapshot.forEach((doc) => {
            users.push(doc.data());
        });
        return users;
    } catch (error) {
        console.error("Error getting all users:", error);
        return [];
    }
};

export const updateUserRole = async (uid, newRole) => {
    try {
        const userRef = doc(db, USERS_COLLECTION, uid);
        await setDoc(userRef, { role: newRole }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error updating user role:", error);
        return false;
    }
};
