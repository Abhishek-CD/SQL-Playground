/**
 * SQL PLAYGROUND — REAL-TIME INTERACTIVE AJAX CONTROLLER
 * Pure Vanilla JavaScript
 */

(function () {
    'use strict';

    // State Variables
    let isExecuting = false;
    let expandedTables = new Set();
    let currentDbStructure = null;
    const HISTORY_STORAGE_KEY = 'sql_playground_history_v1';

    // DOM Elements
    const elements = {
        // Editor
        sqlEditor: document.getElementById('sqlEditor'),
        lineNumbers: document.getElementById('lineNumbers'),
        btnRunSql: document.getElementById('btnRunSql'),
        runBtnText: document.getElementById('runBtnText'),
        btnFormatSql: document.getElementById('btnFormatSql'),
        btnClearSql: document.getElementById('btnClearSql'),
        btnCopySql: document.getElementById('btnCopySql'),
        
        // Result Section
        tabQueryResult: document.getElementById('tabQueryResult'),
        tabQueryHistory: document.getElementById('tabQueryHistory'),
        panelQueryResult: document.getElementById('panelQueryResult'),
        panelQueryHistory: document.getElementById('panelQueryHistory'),
        resultRowCountBadge: document.getElementById('resultRowCountBadge'),
        historyCountBadge: document.getElementById('historyCountBadge'),
        metaExecutionTime: document.getElementById('metaExecutionTime'),
        statusBanner: document.getElementById('statusBanner'),
        bannerIcon: document.getElementById('bannerIcon'),
        bannerMessage: document.getElementById('bannerMessage'),
        errorBanner: document.getElementById('errorBanner'),
        errorBody: document.getElementById('errorBody'),
        queryResultContainer: document.getElementById('queryResultContainer'),
        resultEmptyState: document.getElementById('resultEmptyState'),
        queryResultTable: document.getElementById('queryResultTable'),
        queryResultHead: document.getElementById('queryResultHead'),
        queryResultBody: document.getElementById('queryResultBody'),
        historyList: document.getElementById('historyList'),
        btnClearHistory: document.getElementById('btnClearHistory'),
        
        // Database Explorer
        tableCountBadge: document.getElementById('tableCountBadge'),
        btnRefreshDb: document.getElementById('btnRefreshDb'),
        tableFilterInput: document.getElementById('tableFilterInput'),
        dbEmptyState: document.getElementById('dbEmptyState'),
        tablesAccordion: document.getElementById('tablesAccordion'),
        relationshipsContainer: document.getElementById('relationshipsContainer'),
        relationshipsList: document.getElementById('relationshipsList'),
        btnCopyDefaultCreate: document.getElementById('btnCopyDefaultCreate'),
        
        // Templates Dropdown
        btnTemplates: document.getElementById('btnTemplates'),
        templatesMenu: document.getElementById('templatesMenu'),
        
        // Reset Modal
        btnResetDatabase: document.getElementById('btnResetDatabase'),
        resetModal: document.getElementById('resetModal'),
        btnCancelReset: document.getElementById('btnCancelReset'),
        btnConfirmReset: document.getElementById('btnConfirmReset'),
        
        // Toasts
        toastContainer: document.getElementById('toastContainer')
    };

    // Predefined SQL Templates
    const SQL_TEMPLATES = {
        create_employees: `-- Create employees table with primary key and constraints
CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    salary INTEGER,
    joined_date DATE DEFAULT CURRENT_DATE
);`,
        insert_employees: `-- Insert multiple sample employee records
INSERT INTO employees (name, email, salary)
VALUES 
    ('Abhishek Sharma', 'abhishek@example.com', 75000),
    ('Priya Patel', 'priya@example.com', 82000),
    ('Rahul Verma', 'rahul@example.com', 64000),
    ('Sneha Rao', 'sneha@example.com', 91000);`,
        create_relational: `-- Create departments table
CREATE TABLE departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dept_name TEXT NOT NULL,
    location TEXT
);

-- Create employees table referencing departments
CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    salary INTEGER,
    dept_id INTEGER,
    FOREIGN KEY (dept_id) REFERENCES departments(id)
);

-- Seed initial data
INSERT INTO departments (dept_name, location)
VALUES ('Engineering', 'Bangalore'), ('Design', 'Mumbai'), ('Marketing', 'Delhi');

INSERT INTO employees (name, salary, dept_id)
VALUES 
    ('Abhishek', 90000, 1),
    ('Priya', 85000, 1),
    ('Rahul', 65000, 2),
    ('Sneha', 72000, 3);`,
        select_queries: `-- Select all employees with their department info
SELECT 
    e.id AS employee_id,
    e.name,
    e.salary,
    d.dept_name,
    d.location
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id
ORDER BY e.salary DESC;`
    };

    /* ==========================================================================
       INITIALIZATION
       ========================================================================== */
    function init() {
        setupEventListeners();
        updateLineNumbers();
        loadHistoryCount();
        
        // Initial database fetch
        refreshDatabase();
        
        // If editor is empty, prefill starter example
        if (!elements.sqlEditor.value.trim()) {
            elements.sqlEditor.value = SQL_TEMPLATES.create_employees;
            updateLineNumbers();
        }
    }

    /* ==========================================================================
       EVENT LISTENERS
       ========================================================================== */
    function setupEventListeners() {
        // Run SQL Button
        elements.btnRunSql.addEventListener('click', () => {
            executeSQL();
        });

        // Editor Input & Line Numbers Sync
        elements.sqlEditor.addEventListener('input', () => {
            updateLineNumbers();
        });

        elements.sqlEditor.addEventListener('scroll', () => {
            elements.lineNumbers.scrollTop = elements.sqlEditor.scrollTop;
        });

        // Tab Key & Keyboard Shortcuts in Editor
        elements.sqlEditor.addEventListener('keydown', (e) => {
            // Ctrl + Enter or Cmd + Enter to Run
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                executeSQL();
                return;
            }

            // Tab key support (indent 4 spaces)
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = elements.sqlEditor.selectionStart;
                const end = elements.sqlEditor.selectionEnd;
                const val = elements.sqlEditor.value;

                elements.sqlEditor.value = val.substring(0, start) + '    ' + val.substring(end);
                elements.sqlEditor.selectionStart = elements.sqlEditor.selectionEnd = start + 4;
                updateLineNumbers();
            }
        });

        // Format SQL Button
        elements.btnFormatSql.addEventListener('click', formatSQL);

        // Clear Editor Button
        elements.btnClearSql.addEventListener('click', () => {
            elements.sqlEditor.value = '';
            elements.sqlEditor.focus();
            updateLineNumbers();
            showToast('Editor cleared', 'info');
        });

        // Copy Editor SQL Button
        elements.btnCopySql.addEventListener('click', () => {
            const sql = elements.sqlEditor.value;
            if (!sql) return;
            navigator.clipboard.writeText(sql).then(() => {
                showToast('SQL copied to clipboard', 'success');
            });
        });

        // Refresh Database Button
        elements.btnRefreshDb.addEventListener('click', () => {
            refreshDatabase(true);
        });

        // Table Filter Input
        elements.tableFilterInput.addEventListener('input', filterTables);

        // Quick Templates Dropdown Toggle
        elements.btnTemplates.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.templatesMenu.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            elements.templatesMenu.classList.remove('show');
        });

        elements.templatesMenu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const templateKey = item.getAttribute('data-template');
                if (SQL_TEMPLATES[templateKey]) {
                    elements.sqlEditor.value = SQL_TEMPLATES[templateKey];
                    updateLineNumbers();
                    elements.templatesMenu.classList.remove('show');
                    showToast('Sample query loaded into editor', 'info');
                }
            });
        });

        // Copy default CREATE query in empty state
        if (elements.btnCopyDefaultCreate) {
            elements.btnCopyDefaultCreate.addEventListener('click', () => {
                elements.sqlEditor.value = SQL_TEMPLATES.create_employees;
                updateLineNumbers();
                elements.sqlEditor.focus();
                showToast('Schema loaded into editor', 'info');
            });
        }

        // Result / History Tab Switching
        elements.tabQueryResult.addEventListener('click', () => switchResultTab('result'));
        elements.tabQueryHistory.addEventListener('click', () => {
            switchResultTab('history');
            renderHistory();
        });

        // Clear History
        elements.btnClearHistory.addEventListener('click', clearHistory);

        // Reset Database Modal
        elements.btnResetDatabase.addEventListener('click', () => {
            elements.resetModal.classList.remove('hidden');
        });

        elements.btnCancelReset.addEventListener('click', () => {
            elements.resetModal.classList.add('hidden');
        });

        elements.btnConfirmReset.addEventListener('click', handleResetDatabase);

        elements.resetModal.addEventListener('click', (e) => {
            if (e.target === elements.resetModal) {
                elements.resetModal.classList.add('hidden');
            }
        });
    }

    /* ==========================================================================
       EDITOR LINE NUMBERS
       ========================================================================== */
    function updateLineNumbers() {
        const text = elements.sqlEditor.value;
        const lines = text.split('\n').length;
        let lineNumbersHTML = '';
        for (let i = 1; i <= Math.max(lines, 1); i++) {
            lineNumbersHTML += `<div>${i}</div>`;
        }
        elements.lineNumbers.innerHTML = lineNumbersHTML;
    }

    /* ==========================================================================
       SQL EXECUTION (AJAX)
       ========================================================================== */
    async function executeSQL() {
        if (isExecuting) return;

        const query = elements.sqlEditor.value.trim();
        if (!query) {
            showError('Please enter at least one SQL statement to execute.');
            return;
        }

        setLoadingState(true);
        hideError();

        try {
            const response = await fetch('/api/execute/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ query: query })
            });

            const result = await response.json();

            if (result.success) {
                // Render query result table
                renderQueryResult(result);
                // Save to local history
                saveQueryToHistory(query, result.type);
                // Switch to Result tab if on history tab
                switchResultTab('result');

                // If updated database structure is attached, render it immediately
                if (result.db_structure) {
                    renderDatabaseExplorer(result.db_structure);
                } else {
                    await refreshDatabase();
                }
            } else {
                showError(result.error || 'Failed to execute query.', result.execution_time_ms);
            }
        } catch (error) {
            showError('Network or server connection error: ' + error.message);
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(loading) {
        isExecuting = loading;
        elements.btnRunSql.disabled = loading;
        if (loading) {
            elements.runBtnText.textContent = 'Executing...';
            elements.btnRunSql.classList.add('loading');
        } else {
            elements.runBtnText.textContent = 'Run SQL';
            elements.btnRunSql.classList.remove('loading');
        }
    }

    /* ==========================================================================
       QUERY RESULT RENDERING
       ========================================================================== */
    function renderQueryResult(result) {
        hideError();

        // Update meta stats
        const execTime = result.execution_time_ms !== undefined ? result.execution_time_ms : 0;
        elements.metaExecutionTime.textContent = `Execution: ${execTime} ms`;

        // Update status banner
        elements.statusBanner.className = 'status-banner banner-success';
        elements.bannerIcon.textContent = '✓';
        elements.bannerMessage.innerHTML = `<strong>${escapeHtml(result.message || 'Query executed successfully')}</strong> (${execTime} ms)`;

        if (result.is_select && result.columns && result.columns.length > 0) {
            elements.resultRowCountBadge.textContent = `${result.rows.length} ${result.rows.length === 1 ? 'row' : 'rows'}`;
            elements.resultEmptyState.classList.add('hidden');
            elements.queryResultTable.classList.remove('hidden');

            // Render Header
            let theadHTML = '<tr><th class="th-row-num">#</th>';
            result.columns.forEach(col => {
                theadHTML += `<th>${escapeHtml(col)}</th>`;
            });
            theadHTML += '</tr>';
            elements.queryResultHead.innerHTML = theadHTML;

            // Render Body
            if (result.rows.length === 0) {
                elements.queryResultBody.innerHTML = `
                    <tr>
                        <td colspan="${result.columns.length + 1}" class="no-rows-msg">
                            Query returned 0 rows.
                        </td>
                    </tr>`;
            } else {
                let tbodyHTML = '';
                result.rows.forEach((row, rowIndex) => {
                    tbodyHTML += `<tr><td class="td-row-num">${rowIndex + 1}</td>`;
                    row.forEach(cell => {
                        if (cell === null || cell === undefined) {
                            tbodyHTML += `<td><span class="null-badge">NULL</span></td>`;
                        } else {
                            tbodyHTML += `<td title="${escapeHtml(String(cell))}">${escapeHtml(String(cell))}</td>`;
                        }
                    });
                    tbodyHTML += '</tr>';
                });
                elements.queryResultBody.innerHTML = tbodyHTML;
            }
        } else {
            // DDL or DML result (e.g. INSERT, CREATE TABLE, UPDATE)
            const count = result.row_count || result.affected_rows || 0;
            elements.resultRowCountBadge.textContent = `${count} affected`;
            elements.queryResultTable.classList.add('hidden');
            elements.resultEmptyState.classList.remove('hidden');
            elements.resultEmptyState.innerHTML = `
                <div class="empty-icon" style="color: #10b981;">✓</div>
                <div class="empty-title" style="color: #f1f5f9;">${escapeHtml(result.message || 'Statement Executed')}</div>
                <div class="empty-desc">Check the Live Database on the right to see table structure & data changes.</div>
            `;
        }
    }

    function showError(errorMessage, executionTime) {
        elements.errorBanner.classList.remove('hidden');
        elements.errorBody.textContent = errorMessage;

        elements.statusBanner.className = 'status-banner';
        elements.statusBanner.style.background = 'rgba(244, 63, 94, 0.08)';
        elements.statusBanner.style.color = '#fca5a5';
        elements.bannerIcon.textContent = '❌';
        elements.bannerMessage.innerHTML = `<strong>Query failed:</strong> ${escapeHtml(errorMessage.split('\n')[0])}`;

        if (executionTime !== undefined) {
            elements.metaExecutionTime.textContent = `Execution: ${executionTime} ms`;
        }
        elements.resultRowCountBadge.textContent = 'Error';
    }

    function hideError() {
        elements.errorBanner.classList.add('hidden');
    }

    /* ==========================================================================
       LIVE DATABASE EXPLORER (AJAX)
       ========================================================================== */
    async function refreshDatabase(showToastNotice = false) {
        try {
            const response = await fetch('/api/database/', {
                method: 'GET',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await response.json();

            if (data.success) {
                currentDbStructure = data;
                renderDatabaseExplorer(data);
                if (showToastNotice) {
                    showToast('Database explorer updated', 'info');
                }
            }
        } catch (err) {
            console.error('Failed to inspect database:', err);
        }
    }

    function renderDatabaseExplorer(dbData) {
        const tables = dbData.tables || [];
        const relationships = dbData.relationships || [];

        elements.tableCountBadge.textContent = `${tables.length} ${tables.length === 1 ? 'Table' : 'Tables'}`;

        // Foreign Key Relationships
        if (relationships.length > 0) {
            elements.relationshipsContainer.classList.remove('hidden');
            let relHTML = '';
            relationships.forEach(rel => {
                relHTML += `
                    <div class="relationship-chip">
                        <span>${escapeHtml(rel.from_table)}.${escapeHtml(rel.from_column)}</span>
                        <span class="rel-arrow">➔</span>
                        <span>${escapeHtml(rel.to_table)}.${escapeHtml(rel.to_column)}</span>
                    </div>
                `;
            });
            elements.relationshipsList.innerHTML = relHTML;
        } else {
            elements.relationshipsContainer.classList.add('hidden');
            elements.relationshipsList.innerHTML = '';
        }

        // Empty state when no tables exist
        if (tables.length === 0) {
            elements.dbEmptyState.classList.remove('hidden');
            elements.tablesAccordion.innerHTML = '';
            return;
        }

        elements.dbEmptyState.classList.add('hidden');

        // Render Tables List
        let accordionHTML = '';
        tables.forEach(table => {
            // Default first table or previously expanded tables to open
            const isExpanded = expandedTables.has(table.name) || (tables.length === 1 && expandedTables.size === 0);
            if (isExpanded) {
                expandedTables.add(table.name);
            }

            const openClass = isExpanded ? 'open' : '';
            const rowCountLabel = `${table.total_rows} ${table.total_rows === 1 ? 'row' : 'rows'}`;
            const colCountLabel = `${table.columns.length} cols`;

            accordionHTML += `
                <div class="table-card ${openClass}" data-table-name="${escapeHtml(table.name)}">
                    <div class="table-card-header" onclick="window.SQLPlayground.toggleTable('${escapeHtml(table.name)}')">
                        <div class="table-header-left">
                            <span class="table-toggle-icon">▶</span>
                            <span class="table-name">${escapeHtml(table.name)}</span>
                            ${table.type === 'view' ? '<span class="badge badge-subtle">VIEW</span>' : ''}
                        </div>
                        <div class="table-header-right">
                            <span class="table-meta-counts">${colCountLabel} · ${rowCountLabel}</span>
                            <div class="table-actions-inline" onclick="event.stopPropagation()">
                                <button type="button" class="btn btn-ghost btn-xs" title="Select from table" onclick="window.SQLPlayground.loadSelect('${escapeHtml(table.name)}')">
                                    SELECT *
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="table-card-body">
                        <!-- Schema Columns -->
                        <div class="schema-section-title">
                            <span>Columns &amp; Types</span>
                        </div>
                        <div class="columns-grid">
                            ${table.columns.map(col => `
                                <div class="column-row">
                                    <div class="col-left">
                                        <span class="col-name">${escapeHtml(col.name)}</span>
                                        <span class="badge badge-type">${escapeHtml(col.type || 'TEXT')}</span>
                                    </div>
                                    <div class="col-badges">
                                        ${col.primary_key ? '<span class="badge badge-pk" title="Primary Key">PK</span>' : ''}
                                        ${col.foreign_key ? `<span class="badge badge-fk" title="Foreign Key to ${escapeHtml(col.foreign_key.to_table)}.${escapeHtml(col.foreign_key.to_column)}">FK → ${escapeHtml(col.foreign_key.to_table)}.${escapeHtml(col.foreign_key.to_column)}</span>` : ''}
                                        ${col.not_null ? '<span class="badge badge-nn" title="NOT NULL">NN</span>' : ''}
                                        ${col.is_unique && !col.primary_key ? '<span class="badge badge-uq" title="UNIQUE">UQ</span>' : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Data Table Preview -->
                        <div class="table-data-preview">
                            <div class="schema-section-title">
                                <span>Current Data (${rowCountLabel})</span>
                            </div>
                            ${table.total_rows === 0 ? `
                                <div class="no-rows-msg">No rows in this table yet.</div>
                            ` : `
                                <div class="data-preview-scroll">
                                    <table class="preview-table">
                                        <thead>
                                            <tr>
                                                ${table.column_names.map(c => `<th>${escapeHtml(c)}</th>`).join('')}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(table.rows_preview || []).map(row => `
                                                <tr>
                                                    ${row.map(val => val === null ? '<td><span class="null-badge">NULL</span></td>' : `<td title="${escapeHtml(String(val))}">${escapeHtml(String(val))}</td>`).join('')}
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        });

        elements.tablesAccordion.innerHTML = accordionHTML;
    }

    function toggleTable(tableName) {
        if (expandedTables.has(tableName)) {
            expandedTables.delete(tableName);
        } else {
            expandedTables.add(tableName);
        }

        const card = document.querySelector(`.table-card[data-table-name="${tableName}"]`);
        if (card) {
            card.classList.toggle('open');
        }
    }

    function loadSelect(tableName) {
        elements.sqlEditor.value = `SELECT * FROM ${tableName} LIMIT 50;`;
        updateLineNumbers();
        elements.sqlEditor.focus();
        showToast(`Query created for table "${tableName}"`, 'info');
    }

    function filterTables() {
        const filterVal = elements.tableFilterInput.value.toLowerCase().trim();
        const cards = elements.tablesAccordion.querySelectorAll('.table-card');
        cards.forEach(card => {
            const name = card.getAttribute('data-table-name').toLowerCase();
            if (name.includes(filterVal)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    /* ==========================================================================
       DATABASE RESET (AJAX)
       ========================================================================== */
    async function handleResetDatabase() {
        elements.btnConfirmReset.disabled = true;
        elements.btnConfirmReset.textContent = 'Resetting...';

        try {
            const response = await fetch('/api/reset/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            const data = await response.json();

            if (data.success) {
                expandedTables.clear();
                // Refresh database view
                if (data.db_structure) {
                    renderDatabaseExplorer(data.db_structure);
                } else {
                    await refreshDatabase();
                }

                // Reset query results view
                elements.queryResultTable.classList.add('hidden');
                elements.resultEmptyState.classList.remove('hidden');
                elements.resultEmptyState.innerHTML = `
                    <div class="empty-icon">📊</div>
                    <div class="empty-title">Database was reset</div>
                    <div class="empty-desc">All tables and data have been cleared. Write SQL queries to start fresh.</div>
                `;
                elements.resultRowCountBadge.textContent = '0 rows';
                elements.statusBanner.className = 'status-banner banner-info';
                elements.bannerIcon.textContent = 'ℹ️';
                elements.bannerMessage.innerHTML = '<strong>Database reset:</strong> All tables have been cleared.';
                hideError();

                showToast('Database reset successfully', 'success');
            } else {
                showToast(data.error || 'Failed to reset database', 'error');
            }
        } catch (e) {
            showToast('Reset failed: ' + e.message, 'error');
        } finally {
            elements.btnConfirmReset.disabled = false;
            elements.btnConfirmReset.textContent = 'Yes, Reset Database';
            elements.resetModal.classList.add('hidden');
        }
    }

    /* ==========================================================================
       SQL FORMATTER
       ========================================================================== */
    async function formatSQL() {
        const rawSql = elements.sqlEditor.value;
        if (!rawSql.trim()) return;

        try {
            const response = await fetch('/api/format/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ query: rawSql })
            });
            const data = await response.json();
            if (data.success && data.formatted_query) {
                elements.sqlEditor.value = data.formatted_query;
                updateLineNumbers();
                showToast('SQL query formatted', 'success');
                return;
            }
        } catch (e) {
            // Fallback to client formatter
        }

        // Simple client fallback
        const formatted = formatSqlClient(rawSql);
        elements.sqlEditor.value = formatted;
        updateLineNumbers();
        showToast('SQL query formatted', 'success');
    }

    function formatSqlClient(sql) {
        const keywords = [
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT INTO', 'VALUES',
            'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'DROP TABLE',
            'ALTER TABLE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
            'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
            'ON', 'UNION', 'UNION ALL', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES',
            'INTEGER', 'TEXT', 'REAL', 'BLOB', 'NOT NULL', 'UNIQUE', 'DEFAULT',
            'AUTOINCREMENT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC'
        ];

        let result = sql;
        keywords.forEach(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            result = result.replace(regex, kw);
        });

        return result;
    }

    /* ==========================================================================
       QUERY HISTORY (LOCAL STORAGE)
       ========================================================================== */
    function saveQueryToHistory(sql, stmtType) {
        try {
            const history = getStoredHistory();
            // Avoid immediate duplicate
            if (history.length > 0 && history[0].sql.trim() === sql.trim()) {
                return;
            }
            history.unshift({
                sql: sql,
                type: stmtType || 'SQL',
                timestamp: new Date().toLocaleTimeString()
            });
            // Keep top 30 queries
            const trimmed = history.slice(0, 30);
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
            loadHistoryCount();
        } catch (e) {
            console.warn('LocalStorage error:', e);
        }
    }

    function getStoredHistory() {
        try {
            const data = localStorage.getItem(HISTORY_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function loadHistoryCount() {
        const history = getStoredHistory();
        elements.historyCountBadge.textContent = history.length;
    }

    function renderHistory() {
        const history = getStoredHistory();
        if (history.length === 0) {
            elements.historyList.innerHTML = '<div class="history-empty">No query history yet. Run some SQL statements!</div>';
            return;
        }

        let html = '';
        history.forEach((item, index) => {
            html += `
                <div class="history-item" onclick="window.SQLPlayground.loadHistoryItem(${index})">
                    <div class="history-item-header">
                        <span class="history-item-type">${escapeHtml(item.type)}</span>
                        <span class="history-item-time">${escapeHtml(item.timestamp)}</span>
                    </div>
                    <div class="history-item-sql">${escapeHtml(item.sql)}</div>
                </div>
            `;
        });
        elements.historyList.innerHTML = html;
    }

    function loadHistoryItem(index) {
        const history = getStoredHistory();
        if (history[index]) {
            elements.sqlEditor.value = history[index].sql;
            updateLineNumbers();
            switchResultTab('result');
            showToast('Loaded query from history', 'info');
        }
    }

    function clearHistory() {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        loadHistoryCount();
        renderHistory();
        showToast('Query history cleared', 'info');
    }

    function switchResultTab(tabName) {
        if (tabName === 'result') {
            elements.tabQueryResult.classList.add('active');
            elements.tabQueryHistory.classList.remove('active');
            elements.panelQueryResult.classList.remove('hidden');
            elements.panelQueryHistory.classList.add('hidden');
        } else {
            elements.tabQueryResult.classList.remove('active');
            elements.tabQueryHistory.classList.add('active');
            elements.panelQueryResult.classList.add('hidden');
            elements.panelQueryHistory.classList.remove('hidden');
        }
    }

    /* ==========================================================================
       UTILITIES & TOAST NOTIFICATIONS
       ========================================================================== */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✓';
        if (type === 'error') icon = '⚠️';
        
        toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 250);
        }, 3000);
    }

    // Export global helpers for inline click handlers
    window.SQLPlayground = {
        toggleTable,
        loadSelect,
        loadHistoryItem
    };

    // Run on DOM ready
    document.addEventListener('DOMContentLoaded', init);

})();
