import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// TODO: Replace the following with your app's Firebase project configuration
// You can find these in the Firebase Console -> Project Settings
const firebaseConfig = {
    apiKey: "AIzaSyBHS1UUqCyOgY1seQTyrNupwnZ9s-VvCWg",
    authDomain: "ocrfinance-4e5e8.firebaseapp.com",
    databaseURL: "https://ocrfinance-4e5e8-default-rtdb.firebaseio.com",
    projectId: "ocrfinance-4e5e8",
    storageBucket: "ocrfinance-4e5e8.firebasestorage.app",
    messagingSenderId: "28712676812",
    appId: "1:28712676812:web:195dbca36ebbd82b5dc169",
    measurementId: "G-T5FQL50BPQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
});
const auth = getAuth(app);

export { db, auth };
