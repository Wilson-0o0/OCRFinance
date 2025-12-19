import { getAllTransactions, addTransaction, deleteTransaction, checkDuplicate, getAllUsers, deleteUser } from './db.js';
import { updateUserRole, getAllUsersFromFirestore, saveSettingsToFirestore, getSettingsFromFirestore } from './firestore.js';
import { recognizeText } from './ocr.js';
import { parseTransactionText } from './parser.js';
import { initAuth, getCurrentUser, login, signup, logout, changeUserPassword } from './auth.js';
import { cleanupInvalidTransactions, listInvalidTransactions } from '../utils/cleanupTransactions.js';
import Chart from 'chart.js/auto';

// State
let currentView = 'dashboard';
let categories = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Salary', 'Transfer', 'Uncategorized'];
let accounts = ['Cash', 'Bank Account', 'Credit Card'];
let openingBalances = {}; // { "AccountName": 1000.00 }
let txSortField = 'date';
let txSortOrder = 'desc';
let txFilterStartDate = '';
let txFilterEndDate = '';
let txFilterMerchant = '';
let txFilterType = '';
let txFilterCategory = '';
let txFilterAccount = '';
let graphViewMode = 'Category';
let dashboardStartDate = '';
let dashboardEndDate = '';
let currency = '$';
let dateFormat = 'YYYY-MM-DD';
let theme = 'tokyo-night';
let budgetLimits = {}; // { "CategoryName": 500 }
let categoryTypes = {}; // { "CategoryName": "Expense" }

// Dashboard Widget State
let dashboardCharts = [
    { id: 'chart-1', type: 'Category', title: 'Expenses by Category' },
    { id: 'chart-2', type: 'Time', title: 'Transaction Volume Over Time' }
];
let excludedTransactionIds = new Set(); // Set of transaction IDs excluded from analytics
let transactionFilterMode = 'all'; // 'all', 'excluded-only', 'hide-excluded'

const loadSettings = async () => {
    const user = getCurrentUser();
    if (!user) return;

    const prefix = `ocr_${user.uid}_`;

    // Try Firestore first
    const firestoreSettings = await getSettingsFromFirestore(user.uid);

    if (firestoreSettings) {
        categories = firestoreSettings.categories || categories;
        accounts = firestoreSettings.accounts || accounts;
        openingBalances = firestoreSettings.openingBalances || openingBalances;
        currency = firestoreSettings.currency || currency;
        dateFormat = firestoreSettings.dateFormat || dateFormat;
        theme = firestoreSettings.theme || theme;
        budgetLimits = firestoreSettings.budgetLimits || budgetLimits;
        categoryTypes = firestoreSettings.categoryTypes || categoryTypes;
        dashboardCharts = firestoreSettings.dashboardCharts || dashboardCharts;
        excludedTransactionIds = new Set(firestoreSettings.excludedTransactionIds || []);

        // Update local storage to match
        localStorage.setItem(`${prefix}categories`, JSON.stringify(categories));
        localStorage.setItem(`${prefix}accounts`, JSON.stringify(accounts));
        localStorage.setItem(`${prefix}opening_balances`, JSON.stringify(openingBalances));
    } else {
        // Fallback to LocalStorage (Migration or Offline)
        const savedCats = localStorage.getItem(`${prefix}categories`);
        if (savedCats) categories = JSON.parse(savedCats);

        const savedAccs = localStorage.getItem(`${prefix}accounts`);
        if (savedAccs) accounts = JSON.parse(savedAccs);

        const savedBalances = localStorage.getItem(`${prefix}opening_balances`);
        if (savedBalances) openingBalances = JSON.parse(savedBalances);

        const savedCurrency = localStorage.getItem(`${prefix}currency`);
        if (savedCurrency) currency = savedCurrency;

        const savedDateFormat = localStorage.getItem(`${prefix}dateFormat`);
        if (savedDateFormat) dateFormat = savedDateFormat;

        const savedTheme = localStorage.getItem(`${prefix}theme`);
        if (savedTheme) theme = savedTheme;

        const savedBudget = localStorage.getItem(`${prefix}budgetLimits`);
        if (savedBudget) budgetLimits = JSON.parse(savedBudget);

        const savedTypes = localStorage.getItem(`${prefix}categoryTypes`);
        if (savedTypes) categoryTypes = JSON.parse(savedTypes);

        const savedCharts = localStorage.getItem(`${prefix}dashboardCharts`);
        if (savedCharts) dashboardCharts = JSON.parse(savedCharts);

        const savedExcluded = localStorage.getItem(`${prefix}excludedTransactionIds`);
        if (savedExcluded) excludedTransactionIds = new Set(JSON.parse(savedExcluded));

        // If we have local data but nothing in Firestore, save to Firestore (Migration)
        if (savedCats || savedAccs || savedBalances) {
            await saveSettings();
        }
    }

    // Apply Theme
    document.documentElement.setAttribute('data-theme', theme);
};

const saveSettings = async () => {
    const user = getCurrentUser();
    if (!user) return;

    const prefix = `ocr_${user.uid}_`;

    localStorage.setItem(`${prefix}categories`, JSON.stringify(categories));
    localStorage.setItem(`${prefix}accounts`, JSON.stringify(accounts));
    localStorage.setItem(`${prefix}opening_balances`, JSON.stringify(openingBalances));

    await saveSettingsToFirestore(user.uid, {
        categories,
        accounts,
        openingBalances,
        currency,
        dateFormat,
        theme,
        budgetLimits,
        categoryTypes,
        dashboardCharts,
        excludedTransactionIds: Array.from(excludedTransactionIds)
    });
};

// DOM Elements
const app = document.getElementById('app');

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (dateFormat === 'MM/DD/YYYY') {
        return `${month}/${day}/${year}`;
    } else if (dateFormat === 'DD/MM/YYYY') {
        return `${day}/${month}/${year}`;
    }
    return `${year}-${month}-${day}`; // Default YYYY-MM-DD
};

export const renderApp = async () => {
    const user = getCurrentUser();

    if (!user) {
        // Fallback safety
        window.location.href = './login.html';
        return;
    }

    app.innerHTML = `
    <aside>
      <h2>OCR Finance</h2>
      <div style="padding: 0 1rem; margin-bottom: 1rem; font-size: 0.9rem; color: #94a3b8;">
        User: ${user.username} <br>
        Role: ${user.role}
      </div>
      <nav>
        <button id="nav-dashboard" class="active">Dashboard</button>
        <button id="nav-upload">Upload & Scan</button>
        <button id="nav-transactions">Transactions</button>
        <button id="nav-installments">Installments</button>
        <button id="nav-settings">Settings</button>
        <button id="nav-guide" style="margin-top: auto;">User Guide</button>
        <button id="nav-patch-notes">Patch Notes</button>
        <button id="nav-logout" style="border-top: 1px solid #334155;">Logout</button>
      </nav>
    </aside>
    <main id="main-content">
      <!-- Dynamic Content -->
    </main>
  `;

    setupNavigation();
    await loadSettings();
    await renderDashboard();
};

const setupNavigation = () => {
    const navs = ['dashboard', 'upload', 'transactions', 'installments', 'settings'];
    const user = getCurrentUser();

    navs.forEach(view => {
        const btn = document.getElementById(`nav-${view}`);
        if (btn) {
            btn.addEventListener('click', () => {
                currentView = view;
                updateActiveNav();
                renderView();
            });
        }
    });

    document.getElementById('nav-guide').addEventListener('click', toggleUserGuide);
    document.getElementById('nav-patch-notes').addEventListener('click', togglePatchNotes);

    document.getElementById('nav-logout').addEventListener('click', () => {
        logout();
        window.location.href = './login.html';
    });
};

const toggleUserGuide = () => {
    let guideWindow = document.getElementById('user-guide-window');

    if (guideWindow) {
        // Toggle visibility
        if (guideWindow.style.display === 'none') {
            guideWindow.style.display = 'flex';
        } else {
            guideWindow.style.display = 'none';
        }
        return;
    }

    // Create the window
    guideWindow = document.createElement('div');
    guideWindow.id = 'user-guide-window';
    guideWindow.className = 'floating-window'; // Generic class
    guideWindow.style.display = 'flex';

    guideWindow.innerHTML = `
        <div class="floating-window-header" id="user-guide-header">
            <h3>User Guide</h3>
            <button class="btn-close-window" onclick="document.getElementById('user-guide-window').style.display='none'">×</button>
        </div>
        <div class="floating-window-content">
            <h4>Welcome to OCR Financial Manager</h4>
            <p>This application helps you track your finances by scanning receipts and managing transactions.</p>
            
            <hr>
            
            <h4>🚀 Getting Started</h4>
            <ul>
                <li><strong>Dashboard:</strong> View your net balance, total income/expenses, and analytics.</li>
                <li><strong>Upload & Scan:</strong> Upload receipt images to automatically extract transaction details.</li>
                <li><strong>Transactions:</strong> View, filter, and edit your transaction history.</li>
                <li><strong>Installments:</strong> specific tracking for installment-based payments.</li>
            </ul>

            <hr>

            <h4>🧾 How to Scan Receipts</h4>
            <div style="background: rgba(122, 162, 247, 0.1); border-left: 3px solid #7aa2f7; padding: 0.8rem; margin-bottom: 1rem; border-radius: 4px; font-size: 0.85rem;">
                <strong>Supported Formats:</strong> TnG transaction history and M2U web/mobile view.<br>
                <strong>Tip:</strong> For best results, crop the image to show only the transaction details before uploading.
            </div>
            <ol>
                <li>Go to "Upload & Scan" tab.</li>
                <li>Paste an image or select a file.</li>
                <li>Wait for the OCR to process the text.</li>
                <li>Review the extracted Date, Merchant, and Amount.</li>
                <li>Select a Category and Account.</li>
                <li>Click "Save Transaction".</li>
            </ol>
            
            <hr>

            <h4>📊 Tips</h4>
            <ul>
                <li>Use the <strong>Settings</strong> to customize categories and accounts.</li>
                <li>Transactions are saved locally (offline) and synced to the cloud when online.</li>
            </ul>
        </div>
    `;

    document.body.appendChild(guideWindow);
    makeDraggable(document.getElementById('user-guide-window'), document.getElementById('user-guide-header'));
};

const togglePatchNotes = () => {
    let patchWindow = document.getElementById('patch-notes-window');

    if (patchWindow) {
        if (patchWindow.style.display === 'none') {
            patchWindow.style.display = 'flex';
        } else {
            patchWindow.style.display = 'none';
        }
        return;
    }

    // Create the window
    patchWindow = document.createElement('div');
    patchWindow.id = 'patch-notes-window';
    patchWindow.className = 'floating-window'; // Generic class
    patchWindow.style.display = 'flex';
    // Offset slightly from user guide so they don't exactly overlap if both open
    patchWindow.style.top = '150px';
    patchWindow.style.right = '60px';

    patchWindow.innerHTML = `
        <div class="floating-window-header" id="patch-notes-header">
            <h3>Patch Notes v0.2.1</h3>
            <button class="btn-close-window" onclick="document.getElementById('patch-notes-window').style.display='none'">×</button>
        </div>
        <div class="floating-window-content">
            <h4>✨ New Features</h4>
            <ul>
                <li>
                    <strong>Floating User Guide:</strong> 
                    Added a comprehensive user guide accessible from the sidebar. The window is floating, draggable, and resizable.
                </li>
                <li>
                    <strong>Patch Notes:</strong> 
                    You are reading it! View the latest updates directly in the app.
                </li>
            </ul>

            <hr>

            <h4>🛠️ Improvements</h4>
            <ul>
                <li>
                    <strong>UI/UX:</strong> 
                    Updated sidebar navigation layout.
                </li>
                <li>
                    <strong>Documentation:</strong> 
                    Added specific instructions for scanning TnG and M2U receipts.
                </li>
            </ul>
        </div>
    `;

    document.body.appendChild(patchWindow);
    makeDraggable(document.getElementById('patch-notes-window'), document.getElementById('patch-notes-header'));
};

const makeDraggable = (element, handle) => {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
};

const updateActiveNav = () => {
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`nav-${currentView}`).classList.add('active');
};

const renderView = async () => {
    const main = document.getElementById('main-content');
    main.innerHTML = '<p>Loading...</p>';

    switch (currentView) {
        case 'dashboard':
            await renderDashboard();
            break;
        case 'upload':
            renderUpload();
            break;
        case 'transactions':
            await renderTransactions();
            break;
        case 'installments':
            await renderInstallments();
            break;
        case 'settings':
            renderSettings();
            break;
    }
};

// Helper function to generate unique transaction key
const getTransactionKey = (t) => {
    return `${t.date}_${t.merchant}_${t.amount}_${t.type}`;
};

const getCategoriesForType = (type) => {
    return categories.filter(c => {
        const cType = categoryTypes[c] || 'Expense'; // Default to Expense
        if (type === 'Installment') return cType === 'Expense' || cType === 'Installment';
        return cType === type;
    });
};

// --- Dashboard ---
const renderDashboard = async () => {
    const user = getCurrentUser();
    const transactions = await getAllTransactions(user.uid);
    const main = document.getElementById('main-content');

    // Filter transactions for Dashboard - process Installments and apply date filters
    let processedTransactions = [];

    const dashboardStart = dashboardStartDate ? new Date(dashboardStartDate) : null;
    const dashboardEnd = dashboardEndDate ? new Date(dashboardEndDate) : null;

    transactions.forEach(t => {
        if (t.type === 'Installment') {
            const start = new Date(t.date);
            const end = t.endDate ? new Date(t.endDate) : new Date();

            const diffTime = Math.abs(end - start);
            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            const dailyAmount = t.amount / Math.max(1, days);

            for (let d = 0; d < days; d++) {
                const currentDay = new Date(start);
                currentDay.setDate(start.getDate() + d);
                const currentDayStr = currentDay.toISOString().split('T')[0];

                if (dashboardStart && currentDay < dashboardStart) continue;
                if (dashboardEnd && currentDay > dashboardEnd) continue;

                processedTransactions.push({
                    ...t,
                    date: currentDayStr,
                    amount: dailyAmount,
                    originalAmount: t.amount,
                    isInstallmentSplit: true
                });
            }
        } else {
            if (dashboardStartDate && t.date < dashboardStartDate) return;
            if (dashboardEndDate && t.date > dashboardEndDate) return;
            processedTransactions.push(t);
        }
    });

    // Filter out excluded transactions for analytics
    const includedTransactions = processedTransactions.filter(t => !excludedTransactionIds.has(getTransactionKey(t)));

    // Calculate totals based on INCLUDED transactions only
    let totalIncome = 0;
    let totalExpense = 0;

    includedTransactions.forEach(t => {
        if (t.type === 'Income') {
            totalIncome += (t.amount ?? 0);
        } else if (t.type === 'Expense' || t.type === 'Installment') {
            totalExpense += (t.amount ?? 0);
        }
    });

    let totalOpening = 0;
    Object.values(openingBalances).forEach(val => totalOpening += (parseFloat(val) || 0));

    const netBalance = totalOpening + totalIncome - totalExpense;

    // Render Dashboard HTML
    main.innerHTML = `
        <header>
            <h1>Dashboard</h1>
        </header>
        <div class="dashboard-grid">
            <div class="card">
                <h3>Net Balance</h3>
                <p class="amount ${netBalance >= 0 ? 'positive' : 'negative'}">${currency}${netBalance.toFixed(2)}</p>
                <small style="color: var(--text-muted);">Includes Opening Balances: ${currency}${totalOpening.toFixed(2)}</small>
            </div>
            <div class="card">
                <h3>Total Income</h3>
                <p class="amount positive">${currency}${totalIncome.toFixed(2)}</p>
            </div>
            <div class="card">
                <h3>Total Expenses</h3>
                <p class="amount negative">${currency}${totalExpense.toFixed(2)}</p>
            </div>
        </div>

        <div style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <h3 style="margin: 0;">Analytics</h3>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <input type="date" value="${dashboardStartDate}" onchange="window.handleDashboardDateChange('start', this.value)" style="padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.85rem; width: 140px;">
                <span style="color: var(--text-muted); font-size: 0.85rem;">to</span>
                <input type="date" value="${dashboardEndDate}" onchange="window.handleDashboardDateChange('end', this.value)" style="padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.85rem; width: 140px;">
                <button class="btn-clear" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="window.clearDashboardDateFilter()">Clear</button>
            </div>
        </div>

        <div class="chart-widgets-grid" id="chart-widgets-container">
            <!-- Chart widgets will be rendered here -->
        </div>

        <div class="card dashboard-table" style="margin-top: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                <h3 style="margin: 0;">Transactions</h3>
                <div class="transaction-filter-controls">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="checkbox" id="toggle-all-checkbox" onchange="window.toggleAllTransactions()" style="cursor: pointer;">
                        <span style="font-size: 0.9rem;">Toggle All</span>
                    </label>
                    <button class="filter-btn ${transactionFilterMode === 'all' ? 'active' : ''}" onclick="window.setTransactionFilterMode('all')">Show All</button>
                    <button class="filter-btn ${transactionFilterMode === 'hide-excluded' ? 'active' : ''}" onclick="window.setTransactionFilterMode('hide-excluded')">Hide Excluded</button>
                    <button class="filter-btn ${transactionFilterMode === 'excluded-only' ? 'active' : ''}" onclick="window.setTransactionFilterMode('excluded-only')">Show Excluded Only</button>
                </div>
            </div>
            <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center;">
                <select id="filter-merchant" onchange="window.applyTransactionFilters()" style="padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; min-width: 150px;">
                    <option value="">All Merchants</option>
                </select>
                <select id="filter-type" onchange="window.applyTransactionFilters()" style="padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; min-width: 130px;">
                    <option value="">All Types</option>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Installment">Installment</option>
                </select>
                <select id="filter-category" onchange="window.applyTransactionFilters()" style="padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; min-width: 150px;">
                    <option value="">All Categories</option>
                </select>
                <select id="filter-account" onchange="window.applyTransactionFilters()" style="padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; min-width: 150px;">
                    <option value="">All Accounts</option>
                </select>
                <button class="btn-clear" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="window.clearTransactionFilters()">Clear Filters</button>
            </div>
            <div id="transaction-table-container">
                <!-- Transaction table will be rendered here -->
            </div>
        </div>
    `;

    // Render chart widgets
    renderChartWidgets(includedTransactions);

    // Render transaction table
    renderTransactionTable(processedTransactions);

    // Populate filter dropdowns
    populateTransactionFilters(processedTransactions);

    // Setup event handlers
    window.handleDashboardDateChange = (type, value) => {
        if (type === 'start') dashboardStartDate = value;
        if (type === 'end') dashboardEndDate = value;
        renderDashboard();
    };

    window.clearDashboardDateFilter = () => {
        dashboardStartDate = '';
        dashboardEndDate = '';
        renderDashboard();
    };
};

const renderChart = (data, type, label) => {
    const ctx = document.getElementById('dashboard-chart').getContext('2d');

    // Destroy existing chart if it exists
    if (window.dashboardChart instanceof Chart) {
        window.dashboardChart.destroy();
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    const colors = [
        '#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#bb9af7', '#7dcfff', '#ff9e64', '#db4b4b',
        '#2ac3de', '#73daca', '#b4f9f8', '#c0caf5', '#a9b1d6', '#9aa5ce', '#565f89', '#414868'
    ];

    window.dashboardChart = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: type === 'line' || type === 'bar' ? '#7aa2f7' : colors,
                borderColor: type === 'line' ? '#7aa2f7' : '#ffffff',
                borderWidth: 1,
                fill: type === 'line' ? false : true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    display: type !== 'bar' && type !== 'line'
                }
            },
            scales: (type === 'bar' || type === 'line') ? {
                y: {
                    beginAtZero: true
                }
            } : {}
        }
    });
};

// --- Chart Widget Functions ---
const renderChartWidgets = (transactions) => {
    const container = document.getElementById('chart-widgets-container');
    if (!container) return;

    let html = '';

    // Render each chart widget
    dashboardCharts.forEach(chart => {
        html += renderChartWidget(chart, transactions);
    });

    // Add "+" Add Chart card
    html += `
        <div class="card add-chart-card" onclick="window.showAddChartModal()">
            <div class="add-chart-icon">+</div>
            <div style="color: var(--text-muted); font-weight: 600;">Add Chart</div>
        </div>
    `;

    container.innerHTML = html;

    // Render all charts
    dashboardCharts.forEach(chart => {
        const chartData = calculateChartData(chart.type, transactions);
        renderWidgetChart(chart.id, chartData.data, chartData.type, chart.title);
    });
};

const renderChartWidget = (chart, transactions) => {
    return `
        <div class="card chart-widget">
            <div class="chart-widget-controls">
                <button onclick="window.expandChartWidget('${chart.id}')" title="Expand">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
                    </svg>
                </button>
                <button onclick="window.removeChartWidget('${chart.id}')" title="Remove">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
            <h3 style="margin-bottom: 1.5rem;">${chart.title}</h3>
            <div style="height: 300px; position: relative;">
                <canvas id="widget-chart-${chart.id}"></canvas>
            </div>
        </div>
    `;
};

const calculateChartData = (type, transactions) => {
    let data = {};
    let chartType = 'doughnut';

    if (type === 'Category') {
        chartType = 'doughnut';
        transactions.forEach(t => {
            if (t.type === 'Expense' || t.type === 'Installment') {
                const cat = t.category || 'Uncategorized';
                data[cat] = (data[cat] || 0) + (t.amount ?? 0);
            }
        });
    } else if (type === 'Time') {
        chartType = 'line';
        const timeData = {};
        transactions.forEach(t => {
            const date = t.date;
            timeData[date] = (timeData[date] || 0) + (t.amount ?? 0);
        });
        const sortedKeys = Object.keys(timeData).sort((a, b) => new Date(a) - new Date(b));
        sortedKeys.forEach(k => data[k] = timeData[k]);
    } else if (type === 'Account') {
        chartType = 'bar';
        transactions.forEach(t => {
            if (t.accountId) {
                let amount = t.amount ?? 0;
                if (t.type === 'Expense' || t.type === 'Installment') amount = -amount;
                if (t.type === 'Transfer' && t.toAccountId) amount = -amount;
                data[t.accountId] = (data[t.accountId] || 0) + amount;
            }
        });
    } else if (type === 'Merchant') {
        chartType = 'doughnut';
        transactions.forEach(t => {
            if (t.type === 'Expense' || t.type === 'Installment') {
                data[t.merchant] = (data[t.merchant] || 0) + (t.amount ?? 0);
            }
        });
        const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
        data = Object.fromEntries(sorted);
    } else if (type === 'Type') {
        chartType = 'pie';
        transactions.forEach(t => {
            data[t.type] = (data[t.type] || 0) + (t.amount ?? 0);
        });
    }

    return { data, type: chartType };
};

const renderWidgetChart = (widgetId, data, type, label) => {
    const ctx = document.getElementById(`widget-chart-${widgetId}`);
    if (!ctx) return;

    const chartCtx = ctx.getContext('2d');

    // Destroy existing chart if it exists
    if (window[`chart_${widgetId}`] instanceof Chart) {
        window[`chart_${widgetId}`].destroy();
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    const colors = [
        '#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#bb9af7', '#7dcfff', '#ff9e64', '#db4b4b',
        '#2ac3de', '#73daca', '#b4f9f8', '#c0caf5', '#a9b1d6', '#9aa5ce', '#565f89', '#414868'
    ];

    window[`chart_${widgetId}`] = new Chart(chartCtx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: type === 'line' || type === 'bar' ? '#7aa2f7' : colors,
                borderColor: type === 'line' ? '#7aa2f7' : '#ffffff',
                borderWidth: 1,
                fill: type === 'line' ? false : true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    display: type !== 'bar' && type !== 'line'
                }
            },
            scales: (type === 'bar' || type === 'line') ? {
                y: {
                    beginAtZero: true
                }
            } : {}
        }
    });
};

// Chart Widget Actions
window.showAddChartModal = () => {
    const modal = document.createElement('div');
    modal.className = 'chart-modal-overlay';
    modal.innerHTML = `
        <div class="chart-modal">
            <h3>Add New Chart</h3>
            <div class="chart-type-grid">
                <div class="chart-type-option" onclick="window.addChartWidget('Category')">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📊</div>
                    <div>Category</div>
                </div>
                <div class="chart-type-option" onclick="window.addChartWidget('Time')">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📈</div>
                    <div>Time</div>
                </div>
                <div class="chart-type-option" onclick="window.addChartWidget('Account')">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">💰</div>
                    <div>Account</div>
                </div>
                <div class="chart-type-option" onclick="window.addChartWidget('Merchant')">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🏪</div>
                    <div>Merchant</div>
                </div>
                <div class="chart-type-option" onclick="window.addChartWidget('Type')">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔖</div>
                    <div>Type</div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="window.closeAddChartModal()">Cancel</button>
            </div>
        </div>
    `;
    modal.onclick = (e) => {
        if (e.target === modal) window.closeAddChartModal();
    };
    document.body.appendChild(modal);
};

window.closeAddChartModal = () => {
    const modal = document.querySelector('.chart-modal-overlay');
    if (modal) modal.remove();
};

window.addChartWidget = (type) => {
    const titles = {
        'Category': 'Expenses by Category',
        'Time': 'Transaction Volume Over Time',
        'Account': 'Balance Movement by Account',
        'Merchant': 'Top Merchants',
        'Type': 'Transactions by Type'
    };

    const newChart = {
        id: 'chart-' + Date.now(),
        type: type,
        title: titles[type]
    };

    dashboardCharts.push(newChart);
    saveSettings();
    window.closeAddChartModal();
    renderDashboard();
};

window.removeChartWidget = (id) => {
    if (confirm('Remove this chart?')) {
        dashboardCharts = dashboardCharts.filter(c => c.id !== id);
        saveSettings();
        renderDashboard();
    }
};

window.expandChartWidget = (id) => {
    const chart = dashboardCharts.find(c => c.id === id);
    if (!chart) return;

    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-chart-overlay';
    overlay.innerHTML = `
        <div class="fullscreen-chart-header">
            <h2>${chart.title}</h2>
            <button class="btn-close-fullscreen" onclick="window.closeFullscreenChart()">Close</button>
        </div>
        <div class="fullscreen-chart-content">
            <canvas id="fullscreen-chart-canvas"></canvas>
        </div>
    `;
    document.body.appendChild(overlay);

    // Render chart in fullscreen
    setTimeout(async () => {
        const user = getCurrentUser();
        const transactions = await getAllTransactions(user.uid);
        const includedTransactions = transactions.filter(t => !excludedTransactionIds.has(t.id));
        const chartData = calculateChartData(chart.type, includedTransactions);

        const ctx = document.getElementById('fullscreen-chart-canvas').getContext('2d');
        const labels = Object.keys(chartData.data);
        const values = Object.values(chartData.data);

        const colors = [
            '#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#bb9af7', '#7dcfff', '#ff9e64', '#db4b4b',
            '#2ac3de', '#73daca', '#b4f9f8', '#c0caf5', '#a9b1d6', '#9aa5ce', '#565f89', '#414868'
        ];

        new Chart(ctx, {
            type: chartData.type,
            data: {
                labels: labels,
                datasets: [{
                    label: chart.title,
                    data: values,
                    backgroundColor: chartData.type === 'line' || chartData.type === 'bar' ? '#7aa2f7' : colors,
                    borderColor: chartData.type === 'line' ? '#7aa2f7' : '#ffffff',
                    borderWidth: 1,
                    fill: chartData.type === 'line' ? false : true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        display: chartData.type !== 'bar' && chartData.type !== 'line'
                    }
                },
                scales: (chartData.type === 'bar' || chartData.type === 'line') ? {
                    y: {
                        beginAtZero: true
                    }
                } : {}
            }
        });
    }, 100);
};

window.closeFullscreenChart = () => {
    const overlay = document.querySelector('.fullscreen-chart-overlay');
    if (overlay) overlay.remove();
};

// --- Transaction Filter Functions ---
const populateTransactionFilters = (transactions) => {
    // Get unique values
    const merchants = [...new Set(transactions.map(t => t.merchant).filter(Boolean))].sort();
    const categories = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort();
    const accountIds = [...new Set(transactions.map(t => t.accountId).filter(Boolean))].sort();

    // Populate merchant dropdown
    const merchantSelect = document.getElementById('filter-merchant');
    if (merchantSelect) {
        const currentValue = merchantSelect.value;
        merchantSelect.innerHTML = '<option value="">All Merchants</option>' +
            merchants.map(m => `<option value="${m}" ${m === currentValue ? 'selected' : ''}>${m}</option>`).join('');
    }

    // Populate category dropdown
    const categorySelect = document.getElementById('filter-category');
    if (categorySelect) {
        const currentValue = categorySelect.value;
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
            categories.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
    }

    // Populate account dropdown
    const accountSelect = document.getElementById('filter-account');
    if (accountSelect) {
        const currentValue = accountSelect.value;
        accountSelect.innerHTML = '<option value="">All Accounts</option>' +
            accountIds.map(a => `<option value="${a}" ${a === currentValue ? 'selected' : ''}>${a}</option>`).join('');
    }
};

window.applyTransactionFilters = () => {
    // Get filter values
    txFilterMerchant = document.getElementById('filter-merchant')?.value || '';
    txFilterType = document.getElementById('filter-type')?.value || '';
    txFilterCategory = document.getElementById('filter-category')?.value || '';
    txFilterAccount = document.getElementById('filter-account')?.value || '';

    // Re-render dashboard to apply filters
    renderDashboard();
};

window.clearTransactionFilters = () => {
    // Reset all filter values
    txFilterMerchant = '';
    txFilterType = '';
    txFilterCategory = '';
    txFilterAccount = '';

    // Reset dropdown selections
    const merchantSelect = document.getElementById('filter-merchant');
    const typeSelect = document.getElementById('filter-type');
    const categorySelect = document.getElementById('filter-category');
    const accountSelect = document.getElementById('filter-account');

    if (merchantSelect) merchantSelect.value = '';
    if (typeSelect) typeSelect.value = '';
    if (categorySelect) categorySelect.value = '';
    if (accountSelect) accountSelect.value = '';

    // Re-render dashboard
    renderDashboard();
};

// --- Transaction Table Functions ---
const renderTransactionTable = (transactions) => {
    const container = document.getElementById('transaction-table-container');
    if (!container) return;

    // Apply filter mode
    let filteredTransactions = transactions;
    if (transactionFilterMode === 'hide-excluded') {
        filteredTransactions = transactions.filter(t => !excludedTransactionIds.has(getTransactionKey(t)));
    } else if (transactionFilterMode === 'excluded-only') {
        filteredTransactions = transactions.filter(t => excludedTransactionIds.has(getTransactionKey(t)));
    }

    // Apply additional filters
    if (txFilterMerchant) {
        filteredTransactions = filteredTransactions.filter(t => t.merchant === txFilterMerchant);
    }
    if (txFilterType) {
        filteredTransactions = filteredTransactions.filter(t => t.type === txFilterType);
    }
    if (txFilterCategory) {
        filteredTransactions = filteredTransactions.filter(t => t.category === txFilterCategory);
    }
    if (txFilterAccount) {
        filteredTransactions = filteredTransactions.filter(t => t.accountId === txFilterAccount);
    }

    // Sort by date descending
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredTransactions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No transactions to display</p>';
        return;
    }

    let html = `
        <div class="table-scroll">
        <table>
            <thead>
                <tr>
                    <th>DATE</th>
                    <th>MERCHANT</th>
                    <th>TYPE</th>
                    <th>CATEGORY</th>
                    <th>ACCOUNT</th>
                    <th>AMOUNT</th>
                    <th style="text-align: center;">INCLUDE</th>
                </tr>
            </thead>
            <tbody>
    `;

    filteredTransactions.forEach(t => {
        const txKey = getTransactionKey(t);
        const isExcluded = excludedTransactionIds.has(txKey);
        const isChecked = !isExcluded;
        const rowClass = isExcluded ? 'transaction-row excluded' : 'transaction-row';

        const typeClass = t.type === 'Income' ? 'income' : t.type === 'Expense' ? 'expense' : 'transfer';

        html += `
            <tr class="${rowClass}">
                <td>${formatDate(t.date)}</td>
                <td>${t.merchant || '-'}</td>
                <td><span class="badge ${typeClass}">${t.type}</span></td>
                <td>${t.category || '-'}</td>
                <td>${t.accountId || '-'}</td>
                <td style="color: ${t.type === 'Expense' || t.type === 'Installment' ? 'var(--text-error)' : 'var(--text-success)'}; font-weight: 600;">${currency}${(t.amount ?? 0).toFixed(2)}</td>
                <td style="text-align: center;">
                    <input type="checkbox" class="transaction-checkbox" ${isChecked ? 'checked' : ''} data-tx-key="${txKey}">
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        </div>
    `;

    container.innerHTML = html;

    // Setup event listeners for checkboxes
    setupTransactionCheckboxListeners();
};

// Transaction Filter Actions
window.toggleTransactionInclusion = (txKey) => {
    if (excludedTransactionIds.has(txKey)) {
        excludedTransactionIds.delete(txKey);
    } else {
        excludedTransactionIds.add(txKey);
    }
    saveSettings();
    renderDashboard(); // Re-render to update analytics
};

window.setTransactionFilterMode = (mode) => {
    transactionFilterMode = mode;
    renderDashboard();
};

window.toggleAllTransactions = () => {
    const checkbox = document.getElementById('toggle-all-checkbox');
    const allTransactions = document.querySelectorAll('.transaction-checkbox');

    allTransactions.forEach(cb => {
        const isChecked = checkbox.checked;
        cb.checked = isChecked;

        // Get the transaction key from data attribute
        const txKey = cb.getAttribute('data-tx-key');
        if (isChecked && excludedTransactionIds.has(txKey)) {
            excludedTransactionIds.delete(txKey);
        } else if (!isChecked && !excludedTransactionIds.has(txKey)) {
            excludedTransactionIds.add(txKey);
        }
    });

    saveSettings();
    renderDashboard();
};

// Setup event listeners for transaction checkboxes after table renders
const setupTransactionCheckboxListeners = () => {
    document.querySelectorAll('.transaction-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const txKey = e.target.getAttribute('data-tx-key');
            window.toggleTransactionInclusion(txKey);
        });
    });
};


// --- Upload ---
const renderUpload = () => {
    const main = document.getElementById('main-content');
    main.innerHTML = `
    <header>
      <h1>Upload Transaction History</h1>
    </header>
    <div class="card">
      <div class="upload-zone" id="drop-zone">
        <p>Drag & Drop image here or click to select</p>
        <input type="file" id="file-input" accept="image/*" style="display: none;">
      </div>
      <div id="preview-area" class="hidden" style="margin-top: 1rem;">
        <img id="img-preview" style="max-width: 100%; border-radius: 8px; margin-bottom: 1rem;">
        <div id="ocr-status" style="margin-bottom: 1rem; color: var(--text-accent);"></div>
        <button id="btn-scan" class="btn">Start OCR Scan</button>
      </div>
    </div>
    <div id="results-area" class="hidden"></div>
    
    <div class="card" style="margin-top: 1rem; background: #1e293b; color: #94a3b8; font-family: monospace; font-size: 0.9rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h4 style="margin: 0; color: #e2e8f0;">Activity Log</h4>
        <button id="btn-clear-log" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 0.8rem;">Clear</button>
      </div>
      <div id="app-log" style="height: 150px; overflow-y: auto; border-top: 1px solid #334155; padding-top: 0.5rem;">
        <div class="log-entry">[System] Ready.</div>
      </div>
    </div>
  `;

    setupUploadEvents();

    document.getElementById('btn-clear-log').addEventListener('click', () => {
        document.getElementById('app-log').innerHTML = '<div class="log-entry">[System] Log cleared.</div>';
    });
};

const logToUI = (msg) => {
    const log = document.getElementById('app-log');
    if (!log) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    console.log(msg);
};

const setupUploadEvents = () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewArea = document.getElementById('preview-area');
    const imgPreview = document.getElementById('img-preview');
    const btnScan = document.getElementById('btn-scan');

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) showPreview(file);
    });

    // Drag & Drop (simplified)
    dropZone.addEventListener('dragover', (e) => e.preventDefault());
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) showPreview(file);
    });

    const showPreview = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            imgPreview.src = e.target.result;
            previewArea.classList.remove('hidden');
            btnScan.onclick = () => startScan(file);
        };
        reader.readAsDataURL(file);
    };
};

const startScan = async (file) => {
    const statusDiv = document.getElementById('ocr-status');
    statusDiv.innerText = 'Scanning... (This may take a moment)';
    logToUI(`Starting scan for file: ${file.name}`);

    try {
        const text = await recognizeText(file, (m) => {
            if (m.status === 'recognizing text') {
                const progress = Math.round(m.progress * 100);
                statusDiv.innerText = `Scanning... ${progress}%`;
                if (progress % 20 === 0) { // Log every 20% to avoid spam
                    logToUI(`OCR Progress: ${progress}%`);
                }
            }
        });

        statusDiv.innerText = 'Scan Complete!';
        logToUI('OCR Scan completed. Parsing text...');

        // Debug: Show raw text
        const rawTextDiv = document.createElement('div');
        rawTextDiv.innerHTML = `
            <button id="btn-toggle-raw" class="btn-secondary" style="margin-top: 1rem; font-size: 0.8rem;">Show Raw OCR Text</button>
            <pre id="raw-text-display" style="display: none; background: #f1f5f9; padding: 1rem; border-radius: 4px; margin-top: 0.5rem; white-space: pre-wrap; font-family: monospace; font-size: 0.8rem; color: #334155; max-height: 200px; overflow-y: auto;"></pre>
        `;
        statusDiv.appendChild(rawTextDiv);

        document.getElementById('btn-toggle-raw').onclick = () => {
            const el = document.getElementById('raw-text-display');
            if (el.style.display === 'none') {
                el.style.display = 'block';
                el.innerText = text;
                document.getElementById('btn-toggle-raw').innerText = 'Hide Raw OCR Text';
            } else {
                el.style.display = 'none';
                document.getElementById('btn-toggle-raw').innerText = 'Show Raw OCR Text';
            }
        };

        const parsedData = parseTransactionText(text);
        logToUI(`Found ${parsedData.length} potential transactions.`);

        renderReviewForm(parsedData);

    } catch (err) {
        statusDiv.innerText = 'Error during scan: ' + err.message;
        logToUI(`ERROR: ${err.message}`);
    }
};

const renderReviewForm = async (transactions) => {
    const resultsArea = document.getElementById('results-area');
    resultsArea.classList.remove('hidden');

    if (transactions.length === 0) {
        resultsArea.innerHTML = '<p>No transactions found. Try a clearer image.</p>';
        return;
    }

    // Check for duplicates
    logToUI('Checking for duplicates in database...');
    const user = getCurrentUser();
    let duplicateCount = 0;
    for (let t of transactions) {
        t.isDuplicate = await checkDuplicate(t, user.uid);
        if (t.isDuplicate) duplicateCount++;
    }
    if (duplicateCount > 0) {
        logToUI(`Found ${duplicateCount} duplicate transactions.`);
    } else {
        logToUI('No duplicates found.');
    }

    const accountOptions = accounts.map(opt => `<option value="${opt}">${opt}</option>`).join('') + '<option value="__NEW__">+ Add Account</option>';

    let html = `
    <div class="card">
      <h3>Review Extracted Data</h3>
      
      <div style="background: var(--bg-input); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--border-color);">
        <label style="font-weight: bold; display: block; margin-bottom: 0.5rem;">Apply Account to All Transactions:</label>
        <div style="display: flex; gap: 0.5rem;">
            <select id="bulk-account-select" style="flex: 1;">
                <option value="">-- Select Account --</option>
                ${accounts.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
            </select>
            <button id="btn-apply-bulk" class="btn-secondary">Apply</button>
        </div>
      </div>

      <p>Please verify the data before saving.</p>
      <div id="review-list">
    `;

    transactions.forEach((t, index) => {
        const duplicateBadge = t.isDuplicate
            ? '<span style="background: rgba(247, 118, 142, 0.2); color: var(--text-error); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-left: 0.5rem; font-weight: 600;">Possible Duplicate</span>'
            : '';
        const checked = t.isDuplicate ? '' : 'checked';

        const typeOptions = ['Expense', 'Income', 'Transfer', 'Installment'].map(opt =>
            `<option value="${opt}" ${opt === (t.type || 'Expense') ? 'selected' : ''}>${opt}</option>`
        ).join('');

        const currentAccountOptions = accounts.map(opt =>
            `<option value="${opt}" ${opt === (t.accountId || accounts[0]) ? 'selected' : ''}>${opt}</option>`
        ).join('') + '<option value="__NEW__">+ Add Account</option>';

        const currentType = t.type || 'Expense';

        const filteredCats = getCategoriesForType(currentType);

        const categoryOptions = filteredCats.map(opt =>
            `<option value="${opt}" ${opt === (t.category || 'Uncategorized') ? 'selected' : ''}>${opt}</option>`
        ).join('') + '<option value="__NEW__">+ Add Category</option>';

        const isTransfer = t.type === 'Transfer';

        html += `
        <div class="review-item" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid ${t.isDuplicate ? 'var(--text-error)' : 'var(--border-color)'}; border-radius: 8px; background: ${t.isDuplicate ? 'rgba(247, 118, 142, 0.05)' : 'transparent'};">
            <div style="margin-bottom: 0.5rem; display: flex; align-items: center;">
                <label style="font-weight: bold; display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="save-${index}" ${checked} style="margin-right: 0.5rem;"> 
                    Save this transaction
                </label>
                ${duplicateBadge}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                <label>Date <input type="date" id="date-${index}" value="${t.date || ''}"></label>
                <label>Amount <input type="number" step="0.01" id="amount-${index}" value="${t.amount || 0}"></label>
                <label>Merchant <input type="text" id="merchant-${index}" value="${t.merchant || ''}"></label>
                
                <label id="lbl-end-date-${index}" style="display: ${t.type === 'Installment' ? 'block' : 'none'};">End Date 
                    <input type="date" id="end-date-${index}" value="${t.endDate || ''}">
                </label>
                
                <label>Type 
                    <select id="type-${index}" onchange="handleTypeChange(this, ${index})">${typeOptions}</select>
                </label>
                
                <label id="lbl-account-${index}">Account ${isTransfer ? '(From)' : ''} 
                    <select id="account-${index}" onchange="handleAccountChange(this, ${index})">${currentAccountOptions}</select>
                </label>

                <label id="lbl-to-account-${index}" style="display: ${isTransfer ? 'block' : 'none'};">Account (To) 
                    <select id="to-account-${index}" onchange="handleAccountChange(this, ${index})">${accountOptions}</select>
                </label>

                <label>Category 
                    <select id="category-${index}" onchange="handleCategoryChange(this, ${index})">${categoryOptions}</select>
                </label>
            </div>
        </div>
        `;
    });

    html += `
      </div>
      <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
        <button id="btn-save-all" class="btn">Save Selected Transactions</button>
        <button id="btn-cancel-review" class="btn-secondary">Cancel</button>
      </div>
    </div>
    `;

    resultsArea.innerHTML = html;

    // Bulk Apply Handler
    document.getElementById('btn-apply-bulk').onclick = () => {
        const bulkVal = document.getElementById('bulk-account-select').value;
        if (bulkVal) {
            transactions.forEach((_, i) => {
                const el = document.getElementById(`account-${i}`);
                if (el) el.value = bulkVal;
            });
            alert(`Applied '${bulkVal}' to all transactions.`);
        }
    };

    // Dynamic Type Handler
    window.handleTypeChange = (select, index) => {
        const isTransfer = select.value === 'Transfer';
        const lblAccount = document.getElementById(`lbl-account-${index}`);
        const lblToAccount = document.getElementById(`lbl-to-account-${index}`);

        // Update label text
        lblAccount.childNodes[0].textContent = isTransfer ? 'Account (From): ' : 'Account: ';

        // Toggle To Account visibility
        lblToAccount.style.display = isTransfer ? 'block' : 'none';

        // Toggle End Date visibility
        const lblEndDate = document.getElementById(`lbl-end-date-${index}`);
        if (lblEndDate) lblEndDate.style.display = select.value === 'Installment' ? 'block' : 'none';

        // Update Category Options
        const catSelect = document.getElementById(`category-${index}`);
        const currentVal = catSelect.value;
        const type = select.value;

        const filteredCats = getCategoriesForType(type);

        catSelect.innerHTML = filteredCats.map(opt => `<option value="${opt}">${opt}</option>`).join('') + '<option value="__NEW__">+ Add Category</option>';

        if (filteredCats.includes(currentVal)) {
            catSelect.value = currentVal;
        } else if (filteredCats.length > 0) {
            catSelect.value = filteredCats[0];
        }
    };

    // Handlers for "Add New"
    window.handleAccountChange = (select, index) => {
        if (select.value === '__NEW__') {
            const newName = prompt("Enter new account name:");
            if (newName && !accounts.includes(newName)) {
                accounts.push(newName);
                saveSettings();

                // Refresh all account dropdowns (including bulk and to-accounts)
                const refreshOptions = (sel) => {
                    const currentVal = sel.value === '__NEW__' ? newName : sel.value;
                    sel.innerHTML = accounts.map(opt => `<option value="${opt}">${opt}</option>`).join('') + '<option value="__NEW__">+ Add Account</option>';
                    sel.value = currentVal;
                };

                document.querySelectorAll(`[id^="account-"], [id^="to-account-"]`).forEach(refreshOptions);

                const bulkSel = document.getElementById('bulk-account-select');
                const currentBulk = bulkSel.value;
                bulkSel.innerHTML = '<option value="">-- Select Account --</option>' + accounts.map(opt => `<option value="${opt}">${opt}</option>`).join('');
                bulkSel.value = currentBulk;

                select.value = newName;
            } else {
                select.value = accounts[0]; // Revert
            }
        }
    };

    window.handleCategoryChange = (select, index) => {
        if (select.value === '__NEW__') {
            const newName = prompt("Enter new category name:");
            if (newName && !categories.includes(newName)) {
                categories.push(newName);

                // Get current type for this row to assign to the new category
                const typeSelect = document.getElementById(`type-${index}`);
                const currentType = typeSelect ? typeSelect.value : 'Expense';

                // Determine effective type (Installment -> Expense)
                const effectiveType = currentType === 'Installment' ? 'Expense' : currentType;
                categoryTypes[newName] = effectiveType;

                saveSettings();

                // Refresh all category dropdowns
                document.querySelectorAll(`[id^="category-"]`).forEach(el => {
                    const currentVal = el.value === '__NEW__' ? newName : el.value;
                    const rowIdx = el.id.split('-')[1];
                    const rowType = document.getElementById(`type-${rowIdx}`)?.value || 'Expense';

                    // Filter again based on the row's type
                    const filtered = getCategoriesForType(rowType);

                    el.innerHTML = filtered.map(opt => `<option value="${opt}">${opt}</option>`).join('') + '<option value="__NEW__">+ Add Category</option>';

                    // Restore selection if valid, else default
                    if (filtered.includes(currentVal)) {
                        el.value = currentVal;
                    } else if (filtered.length > 0) {
                        el.value = filtered[0];
                    }
                });

                // Set the current select to the new name
                select.value = newName;
            } else {
                // Revert if cancelled or duplicate
                const typeSelect = document.getElementById(`type-${index}`);
                const rowType = typeSelect ? typeSelect.value : 'Expense';
                const filtered = getCategoriesForType(rowType);
                if (filtered.length > 0) select.value = filtered[0];
            }
        }
    };

    document.getElementById('btn-cancel-review').onclick = () => {
        resultsArea.classList.add('hidden');
        resultsArea.innerHTML = '';
    };

    document.getElementById('btn-save-all').onclick = async () => {
        let savedCount = 0;

        // Fetch all transactions once for budget checking
        const allTransactions = await getAllTransactions(user.uid);

        for (let i = 0; i < transactions.length; i++) {
            const shouldSave = document.getElementById(`save-${i}`).checked;
            if (!shouldSave) continue;

            const date = document.getElementById(`date-${i}`).value;
            const amount = parseFloat(document.getElementById(`amount-${i}`).value);
            const merchant = document.getElementById(`merchant-${i}`).value;
            const type = document.getElementById(`type-${i}`).value;
            const accountId = document.getElementById(`account-${i}`).value;
            const category = document.getElementById(`category-${i}`).value;
            const endDate = document.getElementById(`end-date-${i}`).value;

            let toAccountId = null;
            if (type === 'Transfer') {
                toAccountId = document.getElementById(`to-account-${i}`).value;
            }

            // Budget Check
            if (type === 'Expense' || type === 'Installment') {
                const limit = budgetLimits[category];
                if (limit) {
                    const now = new Date(date);
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

                    let currentSpent = 0;
                    allTransactions.forEach(t => {
                        if (t.category === category && (t.type === 'Expense' || t.type === 'Installment')) {
                            const tDate = new Date(t.date);
                            if (tDate >= startOfMonth && tDate <= endOfMonth) {
                                currentSpent += (t.amount ?? 0);
                            }
                        }
                    });

                    // Add amounts from *currently processing* batch to ensure we catch cumulative overages
                    // We can't easily check "other items in this batch" without a complex loop, 
                    // but we can at least check against the DB state.
                    // Ideally we should also add "previously saved items in this loop", but let's keep it simple for now.

                    if (currentSpent + amount > limit) {
                        const confirmSave = confirm(`⚠️ Budget Alert!\n\nTransaction "${merchant}" will exceed your monthly budget for "${category}".\n\nLimit: ${currency}${limit.toFixed(2)}\nCurrent: ${currency}${currentSpent.toFixed(2)}\nNew Total: ${currency}${(currentSpent + amount).toFixed(2)}\n\nDo you want to proceed?`);
                        if (!confirmSave) continue;
                    }
                }
            }

            await addTransaction({ date, amount, merchant, type, accountId, toAccountId, category, endDate, username: user.uid });
            savedCount++;

            // Update local list for next iteration's budget check (approximation)
            allTransactions.push({ date, amount, merchant, type, accountId, category, endDate });
        }

        if (savedCount > 0) {
            alert(`${savedCount} transactions saved successfully!`);
        } else {
            alert('No transactions saved.');
        }

        resultsArea.classList.add('hidden');
        resultsArea.innerHTML = '';
        if (currentView === 'dashboard') renderDashboard();
        if (currentView === 'transactions') renderTransactions();
    };
};

// --- Transactions List ---
// --- Transactions List ---
const renderTransactions = async () => {
    const user = getCurrentUser();
    const transactions = await getAllTransactions(user.uid);
    const main = document.getElementById('main-content');

    const accountOptions = accounts.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    const categoryOptions = categories.map(opt => `<option value="${opt}">${opt}</option>`).join('');

    // Filter Logic
    let filteredTxs = transactions.filter(t => {
        if (txFilterStartDate && t.date < txFilterStartDate) return false;
        if (txFilterEndDate && t.date > txFilterEndDate) return false;
        if (txFilterMerchant && !t.merchant.toLowerCase().includes(txFilterMerchant.toLowerCase())) return false;
        if (txFilterType && t.type !== txFilterType) return false;
        if (txFilterCategory && t.category !== txFilterCategory) return false;
        if (txFilterAccount && t.accountId !== txFilterAccount && t.toAccountId !== txFilterAccount) return false;
        return true;
    });

    // Sort Logic
    filteredTxs.sort((a, b) => {
        let valA = a[txSortField];
        let valB = b[txSortField];

        // Handle amounts
        if (txSortField === 'amount') {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        }
        // Handle dates
        if (txSortField === 'date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }
        // Handle strings (case insensitive)
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return txSortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return txSortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    let html = `
    <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h1>All Transactions</h1>
        <button id="btn-show-add-tx" class="btn">
            <span>+</span> Add Transaction
        </button>
    </header>

    <!-- Filter Controls -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-accent);">Filters</h4>
            <button class="btn-secondary" onclick="window.clearTxFilters()" style="font-size: 0.85rem;">Clear Filters</button>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
            <div style="display: flex; gap: 0.5rem; align-items: center; background: var(--bg-input); padding: 0.25rem 0.75rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <input type="date" value="${txFilterStartDate}" onchange="window.handleTxFilter('startDate', this.value)" style="border: none; padding: 0.5rem; background: transparent; width: auto;">
                <span style="color: var(--text-muted);">to</span>
                <input type="date" value="${txFilterEndDate}" onchange="window.handleTxFilter('endDate', this.value)" style="border: none; padding: 0.5rem; background: transparent; width: auto;">
            </div>
            <input type="text" value="${txFilterMerchant}" oninput="window.handleTxFilter('merchant', this.value)" placeholder="Search Merchant..." style="flex: 1; min-width: 200px;">
            <select onchange="window.handleTxFilter('type', this.value)" style="width: auto; min-width: 120px;">
                <option value="">All Types</option>
                <option value="Income" ${txFilterType === 'Income' ? 'selected' : ''}>Income</option>
                <option value="Expense" ${txFilterType === 'Expense' ? 'selected' : ''}>Expense</option>
                <option value="Transfer" ${txFilterType === 'Transfer' ? 'selected' : ''}>Transfer</option>
            </select>
            <select onchange="window.handleTxFilter('category', this.value)" style="width: auto; min-width: 150px;">
                <option value="">All Categories</option>
                ${categories.map(c => `<option value="${c}" ${txFilterCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <select onchange="window.handleTxFilter('account', this.value)" style="width: auto; min-width: 150px;">
                <option value="">All Accounts</option>
                ${accounts.map(a => `<option value="${a}" ${txFilterAccount === a ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
        </div>
    </div>

    <!-- Manual Input Form -->
    <div id="manual-tx-form" class="card hidden" style="margin-bottom: 1.5rem; border: 1px solid var(--text-accent);">
        <h3 style="color: var(--text-accent); margin-bottom: 1.5rem;">Add New Transaction</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
            <label>Date <input type="date" id="new-date" value="${new Date().toISOString().split('T')[0]}"></label>
            <label>Merchant <input type="text" id="new-merchant" placeholder="e.g. Grocery Store"></label>
            
            <label id="lbl-end-date" style="display: none;">End Date <input type="date" id="new-end-date" title="Leave blank for active installment"></label>
            
            <label>Type 
                <select id="new-type" onchange="toggleNewTxFields()">
                    <option value="Expense">Expense</option>
                    <option value="Income">Income</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Installment">Installment</option>
                </select>
            </label>
            
            <label>Amount <input type="number" step="0.01" id="new-amount" placeholder="0.00"></label>
            
            <label id="lbl-new-account">Account 
                <select id="new-account">${accountOptions}</select>
            </label>
            
            <label id="lbl-new-to-account" style="display: none;">To Account 
                <select id="new-to-account">${accountOptions}</select>
            </label>

            <label>Category 
                <select id="new-category" onchange="window.handleManualCategoryChange(this)">${categoryOptions}</select>
            </label>
        </div>
        <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="btn-cancel-tx" class="btn-secondary">Cancel</button>
            <button id="btn-save-tx" class="btn">Save Transaction</button>
        </div>
    </div>

    <div class="card" style="overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th onclick="window.handleTxSort('date')" style="cursor: pointer;">Date ${txSortField === 'date' ? (txSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                    <th onclick="window.handleTxSort('merchant')" style="cursor: pointer;">Merchant ${txSortField === 'merchant' ? (txSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                    <th onclick="window.handleTxSort('type')" style="cursor: pointer;">Type ${txSortField === 'type' ? (txSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                    <th onclick="window.handleTxSort('category')" style="cursor: pointer;">Category ${txSortField === 'category' ? (txSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                    <th onclick="window.handleTxSort('accountId')" style="cursor: pointer;">Account ${txSortField === 'accountId' ? (txSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                    <th onclick="window.handleTxSort('amount')" style="cursor: pointer;">Amount ${txSortField === 'amount' ? (txSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (filteredTxs.length === 0) {
        html += '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">No transactions found matching your filters.</td></tr>';
    } else {
        filteredTxs.forEach(t => {
            html += `
            <tr>
                <td>${formatDate(t.date)}</td>
                <td style="font-weight: 500; color: var(--text-main);">${t.merchant}</td>
                <td>
                    <span class="badge ${t.type.toLowerCase()}">${t.type}</span>
                    ${t.type === 'Installment' ? (() => {
                    const start = new Date(t.date);
                    const end = t.endDate ? new Date(t.endDate) : new Date();
                    const diffTime = Math.abs(end - start);
                    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    return `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">${t.endDate ? `Split over ${days} days` : `Active (${days} days)`}</div>`;
                })() : ''}
                </td>
                <td>${t.category || '<span style="color: var(--text-muted);">-</span>'}</td>
                <td>${t.accountId || '<span style="color: var(--text-muted);">-</span>'}</td>
                <td style="font-weight: 600; font-family: monospace; font-size: 1rem; color: ${t.type === 'Income' ? 'var(--text-success)' : (t.type === 'Expense' ? 'var(--text-error)' : 'var(--text-purple)')}">
                    ${currency}${(t.amount ?? 0).toFixed(2)}
                </td>
                <td>
                    <button class="btn-secondary" onclick="window.editTx('${t.id}')" style="color: var(--text-accent); border-color: rgba(122, 162, 247, 0.5); padding: 0.4rem 0.8rem; font-size: 0.8rem; margin-right: 0.5rem;">Edit</button>
                    <button class="btn-secondary" onclick="window.deleteTx('${t.id}')" style="color: var(--text-error); border-color: rgba(247, 118, 142, 0.5); padding: 0.4rem 0.8rem; font-size: 0.8rem;">Delete</button>
                </td>
            </tr>
            `;
        });
    }

    html += `
            </tbody>
        </table>
    </div>
    `;

    main.innerHTML = html;

    // Handlers
    const form = document.getElementById('manual-tx-form');
    let editingTransactionId = null;

    window.editTx = async (id) => {
        // Find transaction
        // Since we have filteredTxs in scope, we might find it there, but better to fetch from DB or use the list we have if complete.
        // filteredTxs might not have all fields if we optimized, but here it does.
        // However, ID is string in HTML, might be number in DB.
        const tx = transactions.find(t => t.id == id);
        if (!tx) return;

        editingTransactionId = tx.id;

        // Populate Form
        document.getElementById('new-date').value = tx.date;
        document.getElementById('new-merchant').value = tx.merchant;
        document.getElementById('new-type').value = tx.type;
        document.getElementById('new-amount').value = tx.amount;
        document.getElementById('new-category').value = tx.category || 'Uncategorized';
        document.getElementById('new-end-date').value = tx.endDate || '';

        // Handle Account
        const accSelect = document.getElementById('new-account');
        if (tx.accountId) accSelect.value = tx.accountId;

        // Handle Transfer
        window.toggleNewTxFields(); // Update visibility and categories
        if (tx.type === 'Transfer' && tx.toAccountId) {
            document.getElementById('new-to-account').value = tx.toAccountId;
        }

        // Update UI
        document.getElementById('btn-save-tx').innerText = 'Update Transaction';
        document.querySelector('#manual-tx-form h3').innerText = 'Edit Transaction';
        form.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth' });
    };

    document.getElementById('btn-show-add-tx').onclick = () => {
        editingTransactionId = null;
        document.getElementById('btn-save-tx').innerText = 'Save Transaction';
        document.querySelector('#manual-tx-form h3').innerText = 'Add New Transaction';

        // Clear form
        document.getElementById('new-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('new-end-date').value = '';
        document.getElementById('new-merchant').value = '';
        document.getElementById('new-amount').value = '';

        // Reset type and update categories
        document.getElementById('new-type').value = 'Expense';
        window.toggleNewTxFields();

        form.classList.remove('hidden');
    };

    document.getElementById('btn-cancel-tx').onclick = () => {
        form.classList.add('hidden');
    };

    window.updateCategoryOptions = (type) => {
        const catSelect = document.getElementById('new-category');
        const currentVal = catSelect.value;

        const filteredCats = getCategoriesForType(type);

        catSelect.innerHTML = filteredCats.map(opt => `<option value="${opt}">${opt}</option>`).join('') + '<option value="__NEW__">+ Add Category</option>';

        if (filteredCats.includes(currentVal)) {
            catSelect.value = currentVal;
        } else if (filteredCats.length > 0) {
            catSelect.value = filteredCats[0];
        }
    };

    window.handleManualCategoryChange = (select) => {
        if (select.value === '__NEW__') {
            const newName = prompt("Enter new category name:");
            if (newName && !categories.includes(newName)) {
                categories.push(newName);

                // Get current transaction type
                const currentType = document.getElementById('new-type').value;
                const effectiveType = currentType === 'Installment' ? 'Expense' : currentType;
                categoryTypes[newName] = effectiveType;

                saveSettings();

                // Refresh options
                window.updateCategoryOptions(currentType);

                select.value = newName;
            } else {
                // Revert
                const currentType = document.getElementById('new-type').value;
                window.updateCategoryOptions(currentType);
            }
        }
    };

    window.toggleNewTxFields = () => {
        const type = document.getElementById('new-type').value;
        const isTransfer = type === 'Transfer';
        const isInstallment = type === 'Installment';

        document.getElementById('lbl-new-to-account').style.display = isTransfer ? 'block' : 'none';
        document.getElementById('lbl-new-account').childNodes[0].textContent = isTransfer ? 'From Account: ' : 'Account: ';

        document.getElementById('lbl-end-date').style.display = isInstallment ? 'block' : 'none';

        window.updateCategoryOptions(type);
    };

    document.getElementById('btn-save-tx').onclick = async () => {
        const date = document.getElementById('new-date').value;
        const merchant = document.getElementById('new-merchant').value;
        const type = document.getElementById('new-type').value;
        const amount = parseFloat(document.getElementById('new-amount').value);
        const accountId = document.getElementById('new-account').value;
        const category = document.getElementById('new-category').value;
        const endDate = document.getElementById('new-end-date').value;

        let toAccountId = null;
        if (type === 'Transfer') {
            toAccountId = document.getElementById('new-to-account').value;
        }

        if (!merchant || isNaN(amount)) {
            alert('Please fill in Merchant and Amount.');
            return;
        }

        // Budget Check
        if (type === 'Expense' || type === 'Installment') {
            const limit = budgetLimits[category];
            if (limit) {
                const now = new Date(date);
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

                let currentSpent = 0;
                transactions.forEach(t => {
                    if (t.category === category && (t.type === 'Expense' || t.type === 'Installment')) {
                        const tDate = new Date(t.date);
                        if (tDate >= startOfMonth && tDate <= endOfMonth) {
                            if (editingTransactionId && t.id == editingTransactionId) return;
                            currentSpent += (t.amount ?? 0);
                        }
                    }
                });

                if (currentSpent + amount > limit) {
                    alert(`⚠️ Budget Alert!\n\nThis transaction will exceed your monthly budget for "${category}".\n\nLimit: ${currency}${limit.toFixed(2)}\nCurrent: ${currency}${currentSpent.toFixed(2)}\nNew Total: ${currency}${(currentSpent + amount).toFixed(2)}`);
                }
            }
        }

        if (editingTransactionId) {
            // Update
            const tx = transactions.find(t => t.id == editingTransactionId);
            if (tx) {
                const updatedTx = {
                    ...tx,
                    date, amount, merchant, type, accountId, toAccountId, category, endDate,
                    // Ensure we keep firestoreId if it exists
                };
                await import('./db.js').then(m => m.updateTransaction(updatedTx));

                // Trigger sync to push update
                import('./firestore.js').then(m => m.backupToFirestore(user.uid));
            }
        } else {
            // Add New
            await addTransaction({ date, amount, merchant, type, accountId, toAccountId, category, endDate, username: user.uid });
        }

        // Reset and Reload
        editingTransactionId = null;
        document.getElementById('btn-save-tx').innerText = 'Save Transaction';
        document.querySelector('#manual-tx-form h3').innerText = 'Add New Transaction';
        form.classList.add('hidden');
        renderTransactions();
    };

    window.deleteTx = async (id) => {
        if (confirm('Are you sure?')) {
            await deleteTransaction(id);
            renderTransactions();
        }
    };

    // Sort Handler
    window.handleTxSort = (field) => {
        if (txSortField === field) {
            txSortOrder = txSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            txSortField = field;
            txSortOrder = 'asc'; // Default to asc for new field
        }
        renderTransactions();
    };

    // Filter Handlers
    window.handleTxFilter = (field, value) => {
        if (field === 'startDate') txFilterStartDate = value;
        if (field === 'endDate') txFilterEndDate = value;
        if (field === 'merchant') txFilterMerchant = value;
        if (field === 'type') txFilterType = value;
        if (field === 'category') txFilterCategory = value;
        if (field === 'account') txFilterAccount = value;
        renderTransactions();
    };

    window.clearTxFilters = () => {
        txFilterStartDate = '';
        txFilterEndDate = '';
        txFilterMerchant = '';
        txFilterType = '';
        txFilterCategory = '';
        txFilterAccount = '';
        renderTransactions();
    };
};

// --- Installments View ---
const renderInstallments = async () => {
    const user = getCurrentUser();
    const transactions = await getAllTransactions(user.uid);
    const main = document.getElementById('main-content');

    const installments = transactions.filter(t => t.type === 'Installment');
    const activeInstallments = installments.filter(t => !t.endDate);
    const completedInstallments = installments.filter(t => t.endDate);

    const calculateDaily = (t) => {
        const start = new Date(t.date);
        const end = t.endDate ? new Date(t.endDate) : new Date();
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
        return (t.amount / Math.max(1, diffDays)).toFixed(2);
    };

    let html = `
    <header>
        <h1>Installments Management</h1>
    </header>
    
    <div class="card" style="margin-bottom: 2rem;">
        <h3 style="color: var(--text-success); margin-bottom: 1rem;">Active Installments</h3>
        ${activeInstallments.length === 0 ? '<p style="color: var(--text-muted);">No active installments.</p>' : ''}
        <div style="display: grid; gap: 1rem;">
    `;

    activeInstallments.forEach(t => {
        const daily = calculateDaily(t);
        html += `
        <div style="background: var(--bg-input); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
                <div style="font-weight: bold; font-size: 1.1rem;">${t.merchant}</div>
                <div style="color: var(--text-muted); font-size: 0.9rem;">Started: ${formatDate(t.date)}</div>
                <div style="margin-top: 0.5rem;">Total: ${currency}${parseFloat(t.amount).toFixed(2)}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.9rem; color: var(--text-muted);">Current Daily Average</div>
                <div style="font-size: 1.2rem; font-weight: bold; color: var(--text-purple);">${currency}${daily} / day</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">Running for ${Math.ceil(Math.abs(new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24)) + 1} days</div>
            </div>
            <button class="btn-secondary" onclick="window.stopInstallment('${t.id}')" style="color: var(--text-error); border-color: var(--text-error);">Stop (End Today)</button>
        </div>
        `;
    });

    html += `
        </div>
    </div>

    <div class="card">
        <h3 style="color: var(--text-muted); margin-bottom: 1rem;">Completed Installments</h3>
        ${completedInstallments.length === 0 ? '<p style="color: var(--text-muted);">No completed installments.</p>' : ''}
        <div style="display: grid; gap: 1rem;">
    `;

    completedInstallments.forEach(t => {
        const daily = calculateDaily(t);
        html += `
        <div style="background: var(--bg-input); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; opacity: 0.7;">
            <div>
                <div style="font-weight: bold;">${t.merchant}</div>
                <div style="color: var(--text-muted); font-size: 0.8rem;">${formatDate(t.date)} - ${formatDate(t.endDate)}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.8rem; color: var(--text-muted);">Final Daily Average</div>
                <div style="font-weight: bold;">${currency}${daily} / day</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Split over ${Math.ceil(Math.abs(new Date(t.endDate) - new Date(t.date)) / (1000 * 60 * 60 * 24)) + 1} days</div>
            </div>
        </div>
        `;
    });

    html += `
        </div>
    </div>
    `;

    main.innerHTML = html;

    window.stopInstallment = async (id) => {
        if (confirm('Are you sure you want to stop this installment? The end date will be set to today.')) {
            const tx = transactions.find(t => t.id == id);
            if (tx) {
                const today = new Date().toISOString().split('T')[0];
                const updatedTx = { ...tx, endDate: today };

                await import('./db.js').then(m => m.updateTransaction(updatedTx));
                await import('./firestore.js').then(m => m.backupToFirestore(user.uid));

                renderInstallments();
            }
        }
    };
};

// --- Settings View ---
let currentSettingsTab = 'general';

const renderSettings = async () => {
    const main = document.getElementById('main-content');
    const user = getCurrentUser();

    main.innerHTML = `
    <header>
        <h1>Settings</h1>
    </header>
    <div class="settings-layout">
        <aside class="settings-sidebar">
            <button onclick="window.switchSettingsTab('general')" id="tab-general" class="${currentSettingsTab === 'general' ? 'active' : ''}">General</button>
            <button onclick="window.switchSettingsTab('accounts')" id="tab-accounts" class="${currentSettingsTab === 'accounts' ? 'active' : ''}">Accounts</button>
            <button onclick="window.switchSettingsTab('categories')" id="tab-categories" class="${currentSettingsTab === 'categories' ? 'active' : ''}">Categories & Budget</button>
            <button onclick="window.switchSettingsTab('data')" id="tab-data" class="${currentSettingsTab === 'data' ? 'active' : ''}">Data & Sync</button>
            <button onclick="window.switchSettingsTab('security')" id="tab-security" class="${currentSettingsTab === 'security' ? 'active' : ''}">Security</button>
            ${user.role === 'admin' ? `<button onclick="window.switchSettingsTab('admin')" id="tab-admin" class="${currentSettingsTab === 'admin' ? 'active' : ''}">Admin</button>` : ''}
        </aside>
        <div id="settings-content" class="settings-content">
            <!-- Tab Content -->
        </div>
    </div>
    `;

    window.switchSettingsTab = (tab) => {
        currentSettingsTab = tab;
        document.querySelectorAll('.settings-sidebar button').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`tab-${tab}`);
        if (btn) btn.classList.add('active');
        renderSettingsTabContent();
    };

    await renderSettingsTabContent();
};

const renderSettingsTabContent = async () => {
    const container = document.getElementById('settings-content');
    if (!container) return;
    container.innerHTML = '<p style="color: var(--text-muted);">Loading...</p>';

    switch (currentSettingsTab) {
        case 'general': renderSettingsGeneral(container); break;
        case 'accounts': await renderSettingsAccounts(container); break;
        case 'categories': renderSettingsCategories(container); break;
        case 'data': renderSettingsData(container); break;
        case 'security': renderSettingsSecurity(container); break;
        case 'admin': await renderSettingsAdmin(container); break;
    }
};

const renderSettingsGeneral = (container) => {
    container.innerHTML = `
    <div class="card">
        <h3>Display Settings</h3>
        <div style="display: grid; gap: 1.5rem; max-width: 400px;">
            <label>Currency Symbol
                <input type="text" value="${currency}" onchange="window.updateSetting('currency', this.value)" placeholder="$">
            </label>
            <label>Date Format
                <select onchange="window.updateSetting('dateFormat', this.value)">
                    <option value="YYYY-MM-DD" ${dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
                    <option value="MM/DD/YYYY" ${dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY" ${dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
                </select>
            </label>
            <label>Theme
                <select onchange="window.updateSetting('theme', this.value)">
                    <option value="tokyo-night" ${theme === 'tokyo-night' ? 'selected' : ''}>Tokyo Night</option>
                    <option value="light" ${theme === 'light' ? 'selected' : ''}>Light (Coming Soon)</option>
                </select>
            </label>
        </div>
    </div>
    `;

    window.updateSetting = (key, value) => {
        if (key === 'currency') currency = value;
        if (key === 'dateFormat') dateFormat = value;
        if (key === 'theme') {
            theme = value;
            document.documentElement.setAttribute('data-theme', theme);
        }
        saveSettings();
        // Ideally re-render or apply theme immediately
        if (key === 'currency' || key === 'dateFormat') {
            alert('Settings saved. Some changes may require a refresh to take effect.');
        }
    };
};

const renderSettingsAccounts = async (container) => {
    const user = getCurrentUser();
    const transactions = await getAllTransactions(user.uid);

    // Calculate Net Movement per account
    const movements = {};
    accounts.forEach(acc => movements[acc] = 0);

    transactions.forEach(t => {
        if (t.type === 'Income' && t.accountId) {
            movements[t.accountId] = (movements[t.accountId] || 0) + (t.amount ?? 0);
        } else if ((t.type === 'Expense' || t.type === 'Installment') && t.accountId) {
            movements[t.accountId] = (movements[t.accountId] || 0) - (t.amount ?? 0);
        } else if (t.type === 'Transfer') {
            if (t.accountId) movements[t.accountId] = (movements[t.accountId] || 0) - (t.amount ?? 0);
            if (t.toAccountId) movements[t.toAccountId] = (movements[t.toAccountId] || 0) + (t.amount ?? 0);
        }
    });

    let html = `
    <div class="card">
        <h3>Manage Accounts</h3>
        <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
            <input type="text" id="new-account-name" placeholder="New Account Name" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
            <button id="btn-add-account" class="btn">Add Account</button>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Account Name</th>
                    <th>Opening Balance</th>
                    <th>Net Movement</th>
                    <th>Current Balance</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    accounts.forEach(acc => {
        const opening = parseFloat(openingBalances[acc] || 0);
        const movement = movements[acc] || 0;
        const current = opening + movement;

        html += `
        <tr>
            <td>${acc}</td>
            <td>
                <input type="number" step="0.01" value="${opening}" 
                    onchange="window.updateOpeningBalance('${acc}', this.value)"
                    style="width: 100px; padding: 0.25rem;">
            </td>
            <td style="color: ${movement >= 0 ? 'var(--text-success)' : 'var(--text-error)'}">
                ${movement >= 0 ? '+' : ''}${currency}${movement.toFixed(2)}
            </td>
            <td style="font-weight: bold;">${currency}${current.toFixed(2)}</td>
            <td>
                <button class="btn-secondary" onclick="window.deleteAccount('${acc}')" style="color: #ef4444; border-color: #ef4444;">Delete</button>
            </td>
        </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;

    container.innerHTML = html;

    document.getElementById('btn-add-account').onclick = () => {
        const name = document.getElementById('new-account-name').value.trim();
        if (name && !accounts.includes(name)) {
            accounts.push(name);
            saveSettings();
            renderSettingsTabContent();
        } else if (accounts.includes(name)) {
            alert('Account already exists!');
        }
    };

    window.updateOpeningBalance = (acc, val) => {
        openingBalances[acc] = parseFloat(val);
        saveSettings();
        renderSettingsTabContent();
    };

    window.deleteAccount = (acc) => {
        if (confirm(`Delete account "${acc}"? Transactions will remain but may show unknown account.`)) {
            accounts = accounts.filter(a => a !== acc);
            delete openingBalances[acc];
            saveSettings();
            renderSettingsTabContent();
        }
    };
};

const renderSettingsCategories = (container) => {
    let html = `
    <div class="card">
        <h3>Manage Categories & Budgets</h3>
        <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <input type="text" id="new-category-name" placeholder="New Category Name" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; flex: 1; min-width: 200px;">
            <button id="btn-add-category" class="btn">Add Category</button>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Category Name</th>
                    <th>Type</th>
                    <th>Monthly Budget</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    categories.forEach(cat => {
        const type = categoryTypes[cat] || 'Expense'; // Default to Expense if undefined
        const limit = budgetLimits[cat] || '';
        const isExpense = type === 'Expense';

        html += `
        <tr>
            <td>${cat}</td>
            <td>
                <select onchange="window.updateCategoryType('${cat}', this.value)" style="padding: 0.25rem;">
                    <option value="Expense" ${type === 'Expense' ? 'selected' : ''}>Expense</option>
                    <option value="Income" ${type === 'Income' ? 'selected' : ''}>Income</option>
                    <option value="Transfer" ${type === 'Transfer' ? 'selected' : ''}>Transfer</option>
                    <option value="Installment" ${type === 'Installment' ? 'selected' : ''}>Installment</option>
                </select>
            </td>
            <td>
                <input type="number" placeholder="No Limit" value="${limit}" 
                    onchange="window.updateBudgetLimit('${cat}', this.value)"
                    style="width: 120px; padding: 0.25rem;"
                    ${!isExpense ? 'disabled title="Budget limits are only for Expense categories"' : ''}>
            </td>
            <td>
                <button class="btn-secondary" onclick="window.deleteCategory('${cat}')" style="color: #ef4444; border-color: #ef4444; padding: 0.25rem 0.5rem; font-size: 0.8rem;">Delete</button>
            </td>
        </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;

    container.innerHTML = html;

    document.getElementById('btn-add-category').onclick = () => {
        const name = document.getElementById('new-category-name').value.trim();
        if (name && !categories.includes(name)) {
            categories.push(name);
            // Default type to Expense
            categoryTypes[name] = 'Expense';
            saveSettings();
            renderSettingsTabContent();
        } else if (categories.includes(name)) {
            alert('Category already exists!');
        }
    };

    window.updateCategoryType = (cat, val) => {
        categoryTypes[cat] = val;
        // If changing away from Expense, remove budget limit?
        // Or just keep it but it won't be active.
        // Let's re-render to update the disabled state of budget input
        saveSettings();
        renderSettingsTabContent();
    };

    window.updateBudgetLimit = (cat, val) => {
        if (val === '') {
            delete budgetLimits[cat];
        } else {
            budgetLimits[cat] = parseFloat(val);
        }
        saveSettings();
    };

    window.deleteCategory = (cat) => {
        if (confirm(`Delete category "${cat}"?`)) {
            categories = categories.filter(c => c !== cat);
            delete categoryTypes[cat];
            delete budgetLimits[cat];
            saveSettings();
            renderSettingsTabContent();
        }
    };
};

const renderSettingsData = (container) => {
    container.innerHTML = `
    <div class="card">
        <h3>Data Synchronization</h3>
        <p style="color: var(--text-muted); margin-bottom: 1rem;">Sync your data with the cloud to access it across devices.</p>
        <div style="display: flex; gap: 1rem; align-items: center;">
            <button id="btn-sync-now" class="btn">Sync Now</button>
            <span id="sync-status" style="color: var(--text-muted); font-size: 0.9rem;"></span>
        </div>
    </div>

    <div class="card" style="margin-top: 1.5rem;">
        <h3>Database Maintenance</h3>
        <p style="color: var(--text-muted); margin-bottom: 1rem;">Clean up invalid or corrupted transaction data.</p>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <button id="btn-list-invalid" class="btn-secondary">List Invalid Transactions</button>
            <button id="btn-cleanup-invalid" class="btn" style="background: var(--text-error); border-color: var(--text-error);">Delete Invalid Transactions</button>
        </div>
        <div id="cleanup-status" style="margin-top: 1rem; padding: 1rem; border-radius: 8px; display: none;"></div>
    </div>
    `;

    document.getElementById('btn-sync-now').onclick = async () => {
        const btn = document.getElementById('btn-sync-now');
        const status = document.getElementById('sync-status');
        btn.disabled = true;
        btn.innerText = 'Syncing...';

        try {
            const user = getCurrentUser();
            await import('./firestore.js').then(m => m.syncData(user.uid));
            status.innerText = `Last synced: ${new Date().toLocaleTimeString()}`;
            status.style.color = 'var(--text-success)';
        } catch (e) {
            status.innerText = 'Sync failed.';
            status.style.color = 'var(--text-error)';
            console.error(e);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Sync Now';
        }
    };

    // Database cleanup handlers (reused)
    const statusDiv = document.getElementById('cleanup-status');

    document.getElementById('btn-list-invalid').onclick = async () => {
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'var(--bg-input)';
        statusDiv.style.border = '1px solid var(--border-color)';
        statusDiv.innerHTML = '<p style="color: var(--text-muted);">Scanning database...</p>';

        const invalidTxs = await listInvalidTransactions();

        if (invalidTxs.length === 0) {
            statusDiv.style.background = 'rgba(158, 206, 106, 0.1)';
            statusDiv.style.border = '1px solid var(--text-success)';
            statusDiv.innerHTML = `
                <p style="color: var(--text-success); font-weight: 600;">✅ Database is clean!</p>
                <p style="color: var(--text-muted); font-size: 0.9rem;">No invalid transactions found.</p>
            `;
        } else {
            statusDiv.style.background = 'rgba(247, 118, 142, 0.1)';
            statusDiv.style.border = '1px solid var(--text-error)';
            statusDiv.innerHTML = `
                <p style="color: var(--text-error); font-weight: 600;">⚠️ Found ${invalidTxs.length} invalid transaction(s)</p>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">Check the browser console for details.</p>
            `;
        }
    };

    document.getElementById('btn-cleanup-invalid').onclick = async () => {
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'var(--bg-input)';
        statusDiv.style.border = '1px solid var(--border-color)';
        statusDiv.innerHTML = '<p style="color: var(--text-muted);">Processing cleanup...</p>';

        const result = await cleanupInvalidTransactions();

        if (result.success && result.deletedCount > 0) {
            statusDiv.style.background = 'rgba(158, 206, 106, 0.1)';
            statusDiv.style.border = '1px solid var(--text-success)';
            statusDiv.innerHTML = `
                <p style="color: var(--text-success); font-weight: 600;">✅ Cleanup successful!</p>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Deleted ${result.deletedCount} from IndexedDB and ${result.firestoreDeletedCount || 0} from Firestore.</p>
            `;
        } else if (result.success && result.deletedCount === 0) {
            statusDiv.style.background = 'rgba(158, 206, 106, 0.1)';
            statusDiv.style.border = '1px solid var(--text-success)';
            statusDiv.innerHTML = `
                <p style="color: var(--text-success); font-weight: 600;">✅ ${result.message}</p>
            `;
        } else {
            statusDiv.style.background = 'rgba(247, 118, 142, 0.1)';
            statusDiv.style.border = '1px solid var(--text-error)';
            statusDiv.innerHTML = `
                <p style="color: var(--text-error); font-weight: 600;">❌ ${result.message || 'Cleanup failed'}</p>
            `;
        }
    };
};

const renderSettingsSecurity = (container) => {
    container.innerHTML = `
    <div class="card">
        <h3>Security</h3>
        <div style="max-width: 400px;">
            <label>Change Password</label>
            <input type="password" id="new-password" placeholder="New Password" style="margin-bottom: 1rem;">
            <input type="password" id="confirm-password" placeholder="Confirm New Password" style="margin-bottom: 1rem;">
            <button id="btn-change-password" class="btn">Update Password</button>
            <p id="security-msg" style="margin-top: 1rem; font-size: 0.9rem;"></p>
        </div>
    </div>
    `;

    document.getElementById('btn-change-password').onclick = async () => {
        const p1 = document.getElementById('new-password').value;
        const p2 = document.getElementById('confirm-password').value;
        const msg = document.getElementById('security-msg');

        if (p1 !== p2) {
            msg.innerText = "Passwords do not match.";
            msg.style.color = "var(--text-error)";
            return;
        }
        if (p1.length < 6) {
            msg.innerText = "Password must be at least 6 characters.";
            msg.style.color = "var(--text-error)";
            return;
        }

        msg.innerText = "Updating...";
        msg.style.color = "var(--text-muted)";

        const result = await changeUserPassword(p1);
        if (result.success) {
            msg.innerText = "Password updated successfully.";
            msg.style.color = "var(--text-success)";
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
        } else {
            msg.innerText = "Error: " + result.error;
            msg.style.color = "var(--text-error)";
        }
    };
};

const renderSettingsAdmin = async (container) => {
    const users = await getAllUsersFromFirestore();

    let html = `
    <div class="card">
        <h3>User Management</h3>
        <table>
            <thead>
                <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (users) {
        users.forEach(u => {
            const isSelf = u.uid === getCurrentUser().uid;
            html += `
            <tr>
                <td>${u.email}</td>
                <td>
                    <select onchange="window.changeUserRole('${u.uid}', this.value)" ${isSelf ? 'disabled' : ''}>
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    ${!isSelf ? `<button class="btn-secondary" onclick="window.deleteUserBtn('${u.uid}')" style="color: var(--text-error); border-color: rgba(247, 118, 142, 0.5);">Delete</button>` : '<span style="color: var(--text-muted);">Current User</span>'}
                </td>
            </tr>
            `;
        });
    } else {
        html += '<tr><td colspan="3">No users found or permission denied.</td></tr>';
    }

    html += `
            </tbody>
        </table>
    </div>
    `;

    container.innerHTML = html;

    window.changeUserRole = async (uid, newRole) => {
        if (confirm(`Change role to ${newRole}?`)) {
            const success = await updateUserRole(uid, newRole);
            if (success) {
                alert('Role updated successfully.');
            } else {
                alert('Failed to update role.');
            }
        } else {
            renderSettingsTabContent(); // Revert selection
        }
    };

    window.deleteUserBtn = async (uid) => {
        if (confirm(`Delete user? This cannot be undone.`)) {
            alert("Delete not implemented yet for safety.");
        }
    };
};

