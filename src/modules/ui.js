import { getAllTransactions, addTransaction, deleteTransaction, checkDuplicate } from './db.js';
import { recognizeText } from './ocr.js';
import { parseTransactionText } from './parser.js';
import Chart from 'chart.js/auto';

// State
let currentView = 'dashboard';
let categories = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Salary', 'Transfer', 'Uncategorized'];
let accounts = ['Cash', 'Bank Account', 'Credit Card'];

const loadSettings = () => {
    const savedCats = localStorage.getItem('ocr_categories');
    if (savedCats) categories = JSON.parse(savedCats);

    const savedAccs = localStorage.getItem('ocr_accounts');
    if (savedAccs) accounts = JSON.parse(savedAccs);
};

const saveSettings = () => {
    localStorage.setItem('ocr_categories', JSON.stringify(categories));
    localStorage.setItem('ocr_accounts', JSON.stringify(accounts));
};

// DOM Elements
const app = document.getElementById('app');

export const renderApp = async () => {
    app.innerHTML = `
    <aside>
      <h2>OCR Finance</h2>
      <nav>
        <button id="nav-dashboard" class="active">Dashboard</button>
        <button id="nav-upload">Upload & Scan</button>
        <button id="nav-transactions">Transactions</button>
      </nav>
    </aside>
    <main id="main-content">
      <!-- Dynamic Content -->
    </main>
  `;

    setupNavigation();
    loadSettings();
    await renderDashboard();
};

const setupNavigation = () => {
    const navs = ['dashboard', 'upload', 'transactions'];
    navs.forEach(view => {
        document.getElementById(`nav-${view}`).addEventListener('click', () => {
            currentView = view;
            updateActiveNav();
            renderView();
        });
    });
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
    }
};

// --- Dashboard ---
const renderDashboard = async () => {
    const transactions = await getAllTransactions();

    const income = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;

    const main = document.getElementById('main-content');
    main.innerHTML = `
    <header>
      <h1>Dashboard</h1>
    </header>
    <div class="grid-cols-3">
      <div class="card">
        <h3>Net Balance</h3>
        <p style="font-size: 2rem; font-weight: bold; color: ${balance >= 0 ? '#10b981' : '#ef4444'}">$${balance.toFixed(2)}</p>
      </div>
      <div class="card">
        <h3>Total Income</h3>
        <p style="font-size: 1.5rem; font-weight: bold; color: #10b981">$${income.toFixed(2)}</p>
      </div>
      <div class="card">
        <h3>Total Expenses</h3>
        <p style="font-size: 1.5rem; font-weight: bold; color: #ef4444">$${expense.toFixed(2)}</p>
      </div>
    </div>
    <div class="card">
      <canvas id="spendingChart"></canvas>
    </div>
  `;

    renderChart(transactions.filter(t => t.type === 'Expense'));
};

const renderChart = (transactions) => {
    const ctx = document.getElementById('spendingChart');
    if (!ctx) return;

    // Group by date (simple)
    const dataMap = {};
    transactions.forEach(t => {
        const date = t.date; // Assuming YYYY-MM-DD or similar
        dataMap[date] = (dataMap[date] || 0) + t.amount;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dataMap),
            datasets: [{
                label: 'Daily Spending',
                data: Object.values(dataMap),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' } },
                x: { grid: { display: false } }
            }
        }
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
    let duplicateCount = 0;
    for (let t of transactions) {
        t.isDuplicate = await checkDuplicate(t);
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
      
      <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;">
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
            ? '<span style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-left: 0.5rem;">Possible Duplicate</span>'
            : '';
        const checked = t.isDuplicate ? '' : 'checked';

        const typeOptions = ['Expense', 'Income', 'Transfer'].map(opt =>
            `<option value="${opt}" ${opt === (t.type || 'Expense') ? 'selected' : ''}>${opt}</option>`
        ).join('');

        const currentAccountOptions = accounts.map(opt =>
            `<option value="${opt}" ${opt === (t.accountId || accounts[0]) ? 'selected' : ''}>${opt}</option>`
        ).join('') + '<option value="__NEW__">+ Add Account</option>';

        const categoryOptions = categories.map(opt =>
            `<option value="${opt}" ${opt === (t.category || 'Uncategorized') ? 'selected' : ''}>${opt}</option>`
        ).join('') + '<option value="__NEW__">+ Add Category</option>';

        const isTransfer = t.type === 'Transfer';

        html += `
        <div class="review-item" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid ${t.isDuplicate ? '#fca5a5' : '#ddd'}; border-radius: 4px; background: ${t.isDuplicate ? '#fef2f2' : 'transparent'};">
            <div style="margin-bottom: 0.5rem; display: flex; align-items: center;">
                <label style="font-weight: bold; display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="save-${index}" ${checked} style="margin-right: 0.5rem;"> 
                    Save this transaction
                </label>
                ${duplicateBadge}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
                <label>Date: <input type="date" id="date-${index}" value="${t.date || ''}" style="width: 100%"></label>
                <label>Amount: <input type="number" step="0.01" id="amount-${index}" value="${t.amount || 0}" style="width: 100%"></label>
                <label>Merchant: <input type="text" id="merchant-${index}" value="${t.merchant || ''}" style="width: 100%"></label>
                
                <label>Type: 
                    <select id="type-${index}" onchange="handleTypeChange(this, ${index})" style="width: 100%">${typeOptions}</select>
                </label>
                
                <label id="lbl-account-${index}">Account ${isTransfer ? '(From)' : ''}: 
                    <select id="account-${index}" onchange="handleAccountChange(this, ${index})" style="width: 100%">${currentAccountOptions}</select>
                </label>

                <label id="lbl-to-account-${index}" style="display: ${isTransfer ? 'block' : 'none'};">Account (To): 
                    <select id="to-account-${index}" onchange="handleAccountChange(this, ${index})" style="width: 100%">${accountOptions}</select>
                </label>

                <label>Category: 
                    <select id="category-${index}" onchange="handleCategoryChange(this, ${index})" style="width: 100%">${categoryOptions}</select>
                </label>
            </div>
        </div>
        `;
    });

    html += `
      </div>
      <div style="margin-top: 1rem;">
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
                saveSettings();
                // Refresh all category dropdowns
                document.querySelectorAll(`[id^="category-"]`).forEach(el => {
                    const currentVal = el.value === '__NEW__' ? newName : el.value;
                    el.innerHTML = categories.map(opt => `<option value="${opt}">${opt}</option>`).join('') + '<option value="__NEW__">+ Add Category</option>';
                    el.value = currentVal;
                });
                select.value = newName;
            } else {
                select.value = 'Uncategorized'; // Revert
            }
        }
    };

    document.getElementById('btn-cancel-review').onclick = () => {
        resultsArea.classList.add('hidden');
        resultsArea.innerHTML = '';
    };

    document.getElementById('btn-save-all').onclick = async () => {
        let savedCount = 0;
        for (let i = 0; i < transactions.length; i++) {
            const shouldSave = document.getElementById(`save-${i}`).checked;
            if (!shouldSave) continue;

            const date = document.getElementById(`date-${i}`).value;
            const amount = parseFloat(document.getElementById(`amount-${i}`).value);
            const merchant = document.getElementById(`merchant-${i}`).value;
            const type = document.getElementById(`type-${i}`).value;
            const accountId = document.getElementById(`account-${i}`).value;
            const category = document.getElementById(`category-${i}`).value;

            let toAccountId = null;
            if (type === 'Transfer') {
                toAccountId = document.getElementById(`to-account-${i}`).value;
            }

            await addTransaction({ date, amount, merchant, type, accountId, toAccountId, category });
            savedCount++;
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
const renderTransactions = async () => {
    const transactions = await getAllTransactions();
    const main = document.getElementById('main-content');

    let html = `
    <header>
        <h1>All Transactions</h1>
    </header>
    <div class="card">
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                `;

    if (transactions.length === 0) {
        html += '<tr><td colspan="7" style="text-align: center;">No transactions found.</td></tr>';
    } else {
        transactions.forEach(t => {
            let accountDisplay = t.accountId || '-';
            if (t.type === 'Transfer' && t.toAccountId) {
                accountDisplay = `${t.accountId} &rarr; ${t.toAccountId}`;
            }

            html += `
        <tr>
          <td>${t.date}</td>
          <td>${t.merchant}</td>
          <td>${t.type || '-'}</td>
          <td>${t.category}</td>
          <td>${accountDisplay}</td>
          <td>$${t.amount.toFixed(2)}</td>
          <td>
            <button class="btn-secondary" onclick="window.deleteTx(${t.id})">Delete</button>
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

    window.deleteTx = async (id) => {
        if (confirm('Are you sure?')) {
            await deleteTransaction(id);
            renderTransactions();
        }
    };
};
