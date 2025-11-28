# OCR Financial Manager

A web-based financial management application that allows users to track income and expenses, manage accounts, and automatically extract transaction data from receipts using OCR (Optical Character Recognition). Now features real-time cloud synchronization and multi-user support.

## Features
- **Dashboard**: Visual overview of net balance, income, expenses, and interactive charts.
- **OCR Scanning**: Upload receipt images to automatically extract transaction details (Date, Amount, Merchant).
- **Transaction Management**: Add, edit, delete, filter, and sort transactions.
- **Cloud Sync**: Automatic backup and synchronization of data across devices using Firebase Firestore.
- **Account Management**: Manage multiple accounts (Cash, Bank, Credit Card) with opening balances.
- **Admin Dashboard**: Dedicated view for administrators to manage users and roles.
- **Authentication**: Secure Login and Signup functionality.

## Project Structure & File Correlations

### Entry Points
- **`index.html`**: The main entry point for the application. It loads the dashboard and main application logic.
- **`login.html`**: The dedicated authentication page. Users are redirected here if they are not logged in.

### Core Logic (`src/`)
- **`main.js`**: The bootstrap script for `index.html`. It checks if a user is authenticated. If yes, it initializes the UI; if no, it redirects to `login.html`.
- **`style.css`**: The global stylesheet for the main application, featuring a "Tokyo Night" dark theme.
- **`login.js`**: Handles the logic for `login.html` (Login/Signup form submission, redirecting on success).
- **`firebase-config.js`**: Firebase configuration file (requires setup).

### Modules (`src/modules/`)
These modules handle specific domains of the application logic:

1.  **`ui.js`** (User Interface)
    -   **Role**: The central hub for rendering the application views (Dashboard, Transactions, Upload, Accounts, Settings, Admin).
    -   **Correlations**: Orchestrates data flow between the user and the backend modules (`db.js`, `firestore.js`, `auth.js`).

2.  **`db.js`** (Local Database)
    -   **Role**: Manages interactions with **IndexedDB** for offline-first data storage.
    -   **Correlations**: Used by `ui.js` for fast local reads/writes and by `firestore.js` for syncing.

3.  **`firestore.js`** (Cloud Database)
    -   **Role**: Handles synchronization between the local IndexedDB and Firebase Firestore.
    -   **Correlations**: Called by `ui.js` to trigger backups and by `auth.js` to sync data on login.

4.  **`auth.js`** (Authentication)
    -   **Role**: Manages user sessions (Login, Signup, Logout) and role-based access control.
    -   **Correlations**: Used by `login.js` and `ui.js` to manage user state.

5.  **`ocr.js`** (Optical Character Recognition)
    -   **Role**: Wraps **Tesseract.js** to perform text recognition on uploaded images.

6.  **`parser.js`** (Text Parsing)
    -   **Role**: Analyzes the raw text output from `ocr.js` to extract structured transaction data.

## How to Use

### 1. Installation & Setup
This project uses **Vite** as a build tool and **Firebase** for backend services.

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Firebase Setup**:
    -   Create a project in the Firebase Console.
    -   Enable **Authentication** (Email/Password) and **Firestore Database**.
    -   Copy your web app configuration keys into `src/firebase-config.js`.
    -   Deploy security rules:
        ```bash
        npx firebase deploy --only firestore:rules
        ```
3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
4.  **Open in Browser**:
    Click the link provided in the terminal (usually `http://localhost:5173`).

### 2. Getting Started
1.  **Sign Up**: Create a new account on the login page.
2.  **Dashboard**: You will land on the dashboard. It will be empty initially.
3.  **Accounts**: Go to the **Accounts** tab to set up your initial balances.
4.  **Add Transactions**:
    -   **Manual**: Go to **Transactions** and click "Add Transaction".
    -   **OCR**: Go to **Upload & Scan**, drop a receipt image, and click "Start OCR Scan".

### 3. Managing Finances
-   **Edit**: Click the "Edit" button on any transaction to modify details.
-   **Filter & Sort**: Use the filters in the Transactions view to find specific entries.
-   **Analyze**: Use the Dashboard graphs to view expenses by Category, Time, or Account.
