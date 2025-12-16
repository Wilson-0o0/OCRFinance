# OCR Financial Manager

A comprehensive web-based financial management application that leverages Optical Character Recognition (OCR) to automate transaction tracking from receipts. Built with an offline-first architecture, it ensures seamless data availability while synchronizing real-time with the cloud.

## 🛠️ Technologies Used

- **Frontend Core**: HTML5, CSS3 (Vanilla), JavaScript (ES6+ Modules)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Database**: 
  - **Local**: [IndexedDB](https://github.com/jakearchibald/idb) (for offline capability)
  - **Cloud**: [Firebase Firestore](https://firebase.google.com/docs/firestore) (for backup & sync)
- **Authentication**: Firebase Authentication
- **OCR Engine**: [Tesseract.js](https://tesseract.projectnaptha.com/) (Client-side OCR)
- **Visualization**: [Chart.js](https://www.chartjs.org/)
- **Utilities**: `date-fns` (Date manipulation), `crypto-js` (Security)

## ✨ Features

- **🧾 Smart OCR Scanning**: Upload receipt images to automatically extract Date, Merchant, and Amount using Tesseract.js.
- **☁️ Real-time Cloud Sync**: Automatically backs up data to Firestore and syncs across devices.
- **📱 Offline-First Design**: Works without internet access using IndexedDB, syncing changes when connection is restored.
- **📊 Interactive Dashboard**: Visualizes financial health with dynamic charts for income, expenses, and net balance.
- **💳 Multi-Account Support**: Manage various accounts (Cash, Bank, Credit Card) with opening balance tracking.
- **🔐 Secure Authentication**: Robust login/signup system with role-based access control (User/Admin).
- **🌗 Modern UI**: Responsive "Tokyo Night" themed interface with glassmorphism effects.
- **⚙️ Transaction Management**: Full CRUD capabilities for transactions with filtering and sorting options.

## 🏗️ The Process (How it is Built)

This project was built with a focus on modularity and performance without relying on heavy frontend frameworks.

1.  **Modular Architecture**: The codebase is split into distinct modules (`auth.js`, `db.js`, `firestore.js`, `ocr.js`, `ui.js`) to separate concerns like UI logic, database interactions, and authentication.
2.  **Hybrid Database Strategy**: 
    -   We prioritized **read/write speed** by using **IndexedDB** as the primary data source.
    -   **Firestore** acts as the "source of truth" for backup and multi-device sync, listening for local changes and updating in the background.
3.  **OCR Pipeline**:
    -   Images are processed client-side using **Tesseract.js**.
    -   Raw text is passed through a custom **regex parser** (`parser.js`) to intelligently identify transaction patterns (e.g., finding currency formats, dates, and common merchant names).
4.  **Security**: Firebase Security Rules ensure users can only access their own data, while Admin roles have elevated privileges managed via custom claims.

## 📚 What I Learned

-   **State Management**: managing complex application state (user data, transactions, UI states) using vanilla JavaScript and the importance of a centralized store or data flow.
-   **Sync Logic**: The complexities of bidirectional synchronization between a local database (IndexedDB) and a cloud database (Firestore), handling conflicts and timing issues.
-   **Regex Patterns**: Developing robust regular expressions to parse unstructured text data from various receipt formats.
-   **Asynchronous JavaScript**: Mastering Promises and `async/await` for handling heavy operations like OCR processing and database transactions without freezing the UI.

## 🚀 Future Improvements

-   **Framework Migration**: Porting the application to **React** or **Vue.js** to simplify state management and component reusability.
-   **Image Preprocessing**: Implementing image filters (contrast, grayscale) before OCR to improve text recognition accuracy on poor-quality receipts.
-   **PWA Support**: Adding a Service Worker and Manifest to make the app installable on mobile devices.
-   **Budgeting Goals**: Adding features to set monthly budget limits per category and receive visual alerts.

## 💻 How to Run the Project

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/ocr-finance-manager.git
    cd ocr-finance-manager
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Firebase**
    -   Create a project in the [Firebase Console](https://console.firebase.google.com/).
    -   Enable **Authentication** (Email/Password) and **Firestore**.
    -   Create a file `src/firebase-config.js` and paste your web app config object:
        ```javascript
        import { initializeApp } from "firebase/app";
        import { getFirestore } from "firebase/firestore";
        import { getAuth } from "firebase/auth";

        const firebaseConfig = {
          // Your Config Here
        };

        const app = initializeApp(firebaseConfig);
        export const db = getFirestore(app);
        export const auth = getAuth(app);
        ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open the link shown in your terminal (usually `http://localhost:5173`).

5.  **Build for Production**
    ```bash
    npm run build
    ```
