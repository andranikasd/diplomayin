// Tabbed Interface with Chat and SQL Editor
class TabManager {
    constructor() {
        this.currentTab = localStorage.getItem('activeTab') || 'chat';
        this.sessionId = this.generateSessionId();
        this.charts = {};

        this.init();
    }

    init() {
        // Initialize tab switching
        this.setupTabs();

        // Initialize chat functionality
        this.setupChat();

        // Initialize SQL editor
        this.setupSQLEditor();

        // Initialize sidebar toggle
        this.setupSidebar();

        // Load active tab from storage
        this.switchTab(this.currentTab);
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // Save to localStorage
        localStorage.setItem('activeTab', tabName);
        this.currentTab = tabName;
    }

    setupSidebar() {
        const toggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');

        toggle?.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // ========================================
    // CHAT FUNCTIONALITY
    // ========================================

    setupChat() {
        this.messages = document.getElementById('messages');
        this.input = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.welcome = document.getElementById('welcome');
        this.newChatBtn = document.getElementById('new-chat-btn');

        // Auto-resize textarea
        this.input?.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = (this.input.scrollHeight) + 'px';
        });

        // Send on Enter
        this.input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send button
        this.sendBtn?.addEventListener('click', () => this.sendMessage());

        // New chat button
        this.newChatBtn?.addEventListener('click', () => this.newChat());

        // Suggestion buttons
        document.querySelectorAll('.suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                this.input.value = query;
                this.sendMessage();
            });
        });
    }

    newChat() {
        this.sessionId = this.generateSessionId();
        this.messages.innerHTML = '';
        this.welcome.style.display = 'block';
        this.input.value = '';
        this.input.style.height = 'auto';
    }

    hideWelcome() {
        if (this.welcome) {
            this.welcome.style.display = 'none';
        }
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.hideWelcome();
        this.addMessage('user', text);
        this.input.value = '';
        this.input.style.height = 'auto';
        this.input.disabled = true;
        this.sendBtn.disabled = true;

        const typingId = this.addTyping();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, sessionId: this.sessionId })
            });

            const data = await response.json();
            this.removeTyping(typingId);

            if (data.success) {
                this.addAssistantMessage(data);
            } else {
                this.addMessage('assistant', data.response || data.error || 'An error occurred.');
            }
        } catch (error) {
            this.removeTyping(typingId);
            this.addMessage('assistant', 'Failed to connect to server.');
        } finally {
            this.input.disabled = false;
            this.sendBtn.disabled = false;
            this.input.focus();
        }
    }

    addMessage(role, content) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}`;
        messageEl.innerHTML = `<div class="message-content"><div class="message-text">${this.escapeHtml(content)}</div></div>`;
        this.messages.appendChild(messageEl);
        this.scrollToBottom();
        return messageEl;
    }

    addAssistantMessage(data) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant';

        let contentHtml = `<div class="message-text">${this.escapeHtml(data.response)}</div>`;

        // Add chart
        if (data.chart && data.data && data.data.length > 0) {
            const chartId = 'chart-' + Date.now();
            contentHtml += `<div class="message-chart"><canvas id="${chartId}"></canvas></div>`;
            setTimeout(() => this.createChart(chartId, data.chart, data.data), 100);
        }
        // Add table for small datasets
        else if (data.data && data.data.length > 0 && data.data.length <= 20 && !data.chart) {
            contentHtml += this.createDataTable(data.data);
        }

        // Add SQL toggle
        if (data.sql) {
            const sqlId = 'sql-' + Date.now();
            contentHtml += `
        <button class="sql-toggle" onclick="document.getElementById('${sqlId}').classList.toggle('visible')">
          View SQL Query
        </button>
        <div class="sql-code" id="${sqlId}">${this.escapeHtml(data.sql)}</div>
      `;
        }

        messageEl.innerHTML = `<div class="message-content">${contentHtml}</div>`;
        this.messages.appendChild(messageEl);
        this.scrollToBottom();
    }

    createDataTable(data) {
        if (!data || data.length === 0) return '';
        const columns = Object.keys(data[0]);
        let html = '<div class="message-table"><table><thead><tr>';
        columns.forEach(col => html += `<th>${this.escapeHtml(col)}</th>`);
        html += '</tr></thead><tbody>';
        data.slice(0, 20).forEach(row => {
            html += '<tr>';
            columns.forEach(col => html += `<td>${this.escapeHtml(String(row[col] || ''))}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        return html;
    }

    createChart(canvasId, chartConfig, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const { type, labelColumn, dataColumns } = chartConfig;

        const labels = data.map(row => row[labelColumn]);
        const datasets = dataColumns.map((col, index) => ({
            label: col,
            data: data.map(row => row[col]),
            backgroundColor: this.getChartColors(type, data.length, index),
            borderColor: type === 'line' ? this.getLineColor(index) : undefined,
            borderWidth: type === 'line' ? 2 : 1
        }));

        this.charts[canvasId] = new Chart(ctx, {
            type: type === 'pie' || type === 'doughnut' ? type : (type === 'line' ? 'line' : 'bar'),
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true, position: 'bottom' }
                },
                scales: type !== 'pie' && type !== 'doughnut' ? { y: { beginAtZero: true } } : undefined
            }
        });
    }

    getChartColors(type, count, datasetIndex) {
        const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];
        return (type === 'pie' || type === 'doughnut') ? colors.slice(0, count) : colors[datasetIndex % colors.length];
    }

    getLineColor(index) {
        const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
        return colors[index % colors.length];
    }

    addTyping() {
        const id = 'typing-' + Date.now();
        const messageEl = document.createElement('div');
        messageEl.id = id;
        messageEl.className = 'message assistant';
        messageEl.innerHTML = `
      <div class="message-content">
        <div class="typing">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
        this.messages.appendChild(messageEl);
        this.scrollToBottom();
        return id;
    }

    removeTyping(id) {
        document.getElementById(id)?.remove();
    }

    scrollToBottom() {
        if (this.messages) {
            this.messages.scrollTop = this.messages.scrollHeight;
        }
    }

    // ========================================
    // SQL EDITOR FUNCTIONALITY
    // ========================================

    setupSQLEditor() {
        this.sqlEditor = document.getElementById('sql-editor');
        this.lineNumbers = document.getElementById('line-numbers');
        this.runSQLBtn = document.getElementById('run-sql-btn');
        this.clearSQLBtn = document.getElementById('clear-sql-btn');
        this.sqlResults = document.getElementById('sql-results');

        // Update line numbers on input
        this.sqlEditor?.addEventListener('input', () => this.updateLineNumbers());
        this.sqlEditor?.addEventListener('scroll', () => this.syncScroll());

        // Run SQL button
        this.runSQLBtn?.addEventListener('click', () => this.executeSQL());

        // Run SQL with Ctrl+Enter
        this.sqlEditor?.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.executeSQL();
            }
        });

        // Clear button
        this.clearSQLBtn?.addEventListener('click', () => {
            this.sqlEditor.value = '';
            this.updateLineNumbers();
            this.sqlResults.innerHTML = `
        <div class="results-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
          <p>Run a query to see results</p>
        </div>
      `;
        });

        // Initialize line numbers
        this.updateLineNumbers();
    }

    updateLineNumbers() {
        if (!this.sqlEditor || !this.lineNumbers) return;

        const lines = this.sqlEditor.value.split('\n').length;
        this.lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    }

    syncScroll() {
        if (!this.sqlEditor || !this.lineNumbers) return;
        this.lineNumbers.scrollTop = this.sqlEditor.scrollTop;
    }

    async executeSQL() {
        const sql = this.sqlEditor?.value.trim();
        if (!sql) return;

        this.runSQLBtn.disabled = true;
        this.runSQLBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg> Running...';

        try {
            const startTime = Date.now();
            const response = await fetch('/api/sql/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql })
            });

            const data = await response.json();
            const executionTime = Date.now() - startTime;

            if (data.success) {
                this.displaySQLResults(data.results, executionTime);
            } else {
                this.displaySQLError(data.error);
            }
        } catch (error) {
            this.displaySQLError('Failed to execute query: ' + error.message);
        } finally {
            this.runSQLBtn.disabled = false;
            this.runSQLBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Run Query';
        }
    }

    displaySQLResults(results, executionTime) {
        if (!results || results.length === 0) {
            this.sqlResults.innerHTML = `
        <div class="results-header">
          <div class="results-info">Query returned <strong>0 rows</strong> in ${executionTime}ms</div>
        </div>
        <div class="results-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>Query returned no results</p>
        </div>
      `;
            return;
        }

        const columns = Object.keys(results[0]);
        let tableHTML = `
      <div class="results-header">
        <div class="results-info">
          Query returned <strong>${results.length} row${results.length !== 1 ? 's' : ''}</strong> in ${executionTime}ms
        </div>
      </div>
      <div class="results-table-wrapper">
        <table class="results-table">
          <thead><tr>
    `;

        columns.forEach(col => {
            tableHTML += `<th>${this.escapeHtml(col)}</th>`;
        });

        tableHTML += '</tr></thead><tbody>';

        results.forEach(row => {
            tableHTML += '<tr>';
            columns.forEach(col => {
                const value = row[col] !== null && row[col] !== undefined ? String(row[col]) : '';
                tableHTML += `<td>${this.escapeHtml(value)}</td>`;
            });
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table></div>';
        this.sqlResults.innerHTML = tableHTML;
    }

    displaySQLError(error) {
        this.sqlResults.innerHTML = `
      <div class="error-message">
        <strong>Error:</strong><br>${this.escapeHtml(error)}
      </div>
    `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TabManager();
});
