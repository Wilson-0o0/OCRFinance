import { auth } from '../firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,

    onAuthStateChanged,
    updatePassword
} from 'firebase/auth';
import { syncData, getUserRole, saveUserToFirestore } from './firestore.js';

let currentUser = null;

export const getCurrentUser = () => currentUser;

export const initAuth = (onAuthReady) => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Fetch role from Firestore
            let role = 'user';
            try {
                const userDoc = await getUserRole(user.uid);
                if (userDoc) {
                    role = userDoc.role;
                } else {
                    // Create user doc if not exists
                    await saveUserToFirestore({
                        uid: user.uid,
                        email: user.email,
                        role: 'user',
                        username: user.email.split('@')[0]
                    });
                }
            } catch (e) {
                console.error("Error fetching role:", e);
            }

            currentUser = {
                uid: user.uid,
                email: user.email,
                username: user.email.split('@')[0],
                role: role
            };
            console.log("User logged in:", currentUser.email, "Role:", role);
            // Start sync when user is authenticated
            await syncData(currentUser.uid);
        } else {
            currentUser = null;
            console.log("User logged out");
        }

        if (onAuthReady) {
            onAuthReady(currentUser);
        }
    });
};

export const login = async (email, password) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        return true;
    } catch (error) {
        console.error("Login error:", error);
        throw error;
    }
};

export const signup = async (email, password) => {
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        return true;
    } catch (error) {
        console.error("Signup error:", error);
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
    }
};

export const changeUserPassword = async (newPassword) => {
    try {
        if (auth.currentUser) {
            await updatePassword(auth.currentUser, newPassword);
            return { success: true };
        }
        return { success: false, error: "No user logged in" };
    } catch (error) {
        console.error("Change password error:", error);
        return { success: false, error: error.message };
    }
};
