# OCR Financial Manager

A web-based financial management application that allows users to track income and expenses, manage accounts, and automatically extract transaction data from receipts using OCR (Optical Character Recognition).

## Features
- **Dashboard**: Visual overview of net balance, income, expenses, and interactive charts.
- **OCR Scanning**: Upload receipt images to automatically extract transaction details (Date, Amount, Merchant).
- **Transaction Management**: Add, edit, delete, filter, and sort transactions.
- **Account Management**: Manage multiple accounts (Cash, Bank, Credit Card) with opening balances.
- **Authentication**: Secure Login and Signup functionality.
- **Local Data**: All data is stored locally in your browser using IndexedDB.

## Project Structure & File Correlations

### Entry Points
- **`index.html`**: The main entry point for the application. It loads the dashboard and main application logic.
- **`login.html`**: The dedicated authentication page. Users are redirected here if they are not logged in.

### Core Logic (`src/`)
- **`main.js`**: The bootstrap script for `index.html`. It checks if a user is authenticated. If yes, it initializes the UI; if no, it redirects to `login.html`.
- **`style.css`**: The global stylesheet for the main application, featuring a "Tokyo Night" dark theme.
- **`login.js`**: Handles the logic for `login.html` (Login/Signup form submission, redirecting on success).
- **`login.css`**: Dedicated styles for the login page.

### Modules (`src/modules/`)
These modules handle specific domains of the application logic:

1.  **`ui.js`** (User Interface)
    -   **Role**: The central hub for rendering the application views (Dashboard, Transactions, Upload, Accounts, Settings).
    -   **Correlations**:
        -   Calls `db.js` to fetch and save data.
        -   Calls `auth.js` to get current user info.
        -   Calls `ocr.js` to initiate scanning.
        -   Calls `parser.js` to process scanned text.
        -   Uses `Chart.js` to render dashboard graphs.

2.  **`db.js`** (Database)
    -   **Role**: Manages all interactions with **IndexedDB**. Handles CRUD operations for Transactions and Users.
    -   **Correlations**: Used by `ui.js` and `auth.js` to persist data.

3.  **`auth.js`** (Authentication)
    -   **Role**: Manages user sessions (Login, Signup, Logout) and persistence (LocalStorage/SessionStorage).
    -   **Correlations**: Used by `login.js` for initial auth and `ui.js` for session checks and logout.

4.  **`ocr.js`** (Optical Character Recognition)
    -   **Role**: Wraps **Tesseract.js** to perform text recognition on uploaded images.
    -   **Correlations**: Called by `ui.js` when a user uploads a file.

5.  **`parser.js`** (Text Parsing)
    -   **Role**: Analyzes the raw text output from `ocr.js` to identify potential dates, amounts, and merchant names using Regex.
    -   **Correlations**: Called by `ui.js` after a successful OCR scan to format data for user review.

## How to Use

### 1. Installation & Setup
This project uses **Vite** as a build tool.

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Run Development Server**:
    ```bash
    npm run dev
    ```
3.  **Open in Browser**:
    Click the link provided in the terminal (usually `http://localhost:5173`).

### 2. Getting Started
1.  **Sign Up**: Create a new account on the login page.
2.  **Dashboard**: You will land on the dashboard. It will be empty initially.
3.  **Accounts**: Go to the **Accounts** tab to set up your initial balances (e.g., Bank Account: $5000).
4.  **Add Transactions**:
    -   **Manual**: Go to **Transactions** and click "Add Transaction".
    -   **OCR**: Go to **Upload & Scan**, drop a receipt image, and click "Start OCR Scan". Review the extracted data and click "Save".

### 3. Managing Finances
-   **Filter & Sort**: Use the filters in the Transactions view to find specific entries.
-   **Analyze**: Use the Dashboard graphs to view expenses by Category, Time, or Account.
