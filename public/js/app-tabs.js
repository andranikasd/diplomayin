// Armenian OSINT Analytics — Main App
class TabManager {
    constructor() {
        this.currentTab = localStorage.getItem('activeTab') || 'chat';
        this.sessionId = this.generateSessionId();
        this.charts = {};
        this.token = localStorage.getItem('auth_token');

        // Redirect to login if no token
        if (!this.token) {
            window.location.href = '/login';
            return;
        }

        this.init();
        this.loadUserInfo();
    }

    init() {
        this.setupTabs();
        this.setupChat();
        this.setupSQLEditor();
        this.setupSidebar();
        this.setupLogout();
        this.switchTab(this.currentTab);
        this.loadSessions();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    // Auth helpers
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    async handleUnauthorized() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
    }

    async authedFetch(url, options = {}) {
        const res = await fetch(url, {
            ...options,
            headers: { ...this.getAuthHeaders(), ...(options.headers || {}) }
        });

        if (res.status === 401) {
            await this.handleUnauthorized();
            throw new Error('Unauthorized');
        }

        return res;
    }

    // Load user info from localStorage or server
    async loadUserInfo() {
        let user = null;
        const cached = localStorage.getItem('auth_user');
        if (cached) {
            try { user = JSON.parse(cached); } catch (_) {}
        }

        if (!user) {
            try {
                const res = await this.authedFetch('/api/auth/me');
                const data = await res.json();
                if (data.success) {
                    user = data.user;
                    localStorage.setItem('auth_user', JSON.stringify(user));
                }
            } catch (_) {}
        }

        if (user) {
            const displayName = user.full_name || user.email.split('@')[0];
            const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

            const avatarEl = document.getElementById('user-avatar');
            const nameEl = document.getElementById('user-name');
            const emailEl = document.getElementById('user-email');

            if (avatarEl) avatarEl.textContent = initials;
            if (nameEl) nameEl.textContent = displayName;
            if (emailEl) emailEl.textContent = user.email;
        }
    }

    // ========================================
    // CHAT SESSIONS (sidebar history)
    // ========================================
    async loadSessions() {
        const historyEl = document.getElementById('chat-history');
        if (!historyEl) return;
        try {
            const res = await this.authedFetch('/api/chat/sessions');
            const data = await res.json();
            if (!data.success || !data.sessions?.length) {
                historyEl.innerHTML = '<p class="empty-history">No previous chats</p>';
                return;
            }
            historyEl.innerHTML = data.sessions.map(s => {
                const title = this.escapeHtml((s.title || 'Untitled chat').slice(0, 48));
                const date = s.last_message ? new Date(s.last_message).toLocaleDateString() : '';
                return `<div class="history-item" data-session="${this.escapeHtml(s.session_id)}" title="${title}">
                    <span class="history-item-text">${title}</span>
                    <span class="history-item-date">${date}</span>
                </div>`;
            }).join('');
            historyEl.querySelectorAll('.history-item').forEach(el => {
                el.addEventListener('click', () => this.openSession(el.dataset.session));
            });
        } catch { /* non-fatal */ }
    }

    async openSession(sessionId) {
        this.sessionId = sessionId;
        this.messages.innerHTML = '';
        if (this.welcome) this.welcome.style.display = 'none';
        try {
            const res = await this.authedFetch(`/api/chat/history/${sessionId}`);
            const data = await res.json();
            if (data.success && data.history?.length) {
                data.history.forEach(h => {
                    this.addMessage('user', h.user_message);
                    if (h.assistant_response) {
                        // Reconstruct assistant message from stored data
                        const el = document.createElement('div');
                        el.className = 'message assistant';
                        el.innerHTML = `<div class="message-content">
                            <div class="message-role"><span class="message-role-dot"></span>OSINT Assistant</div>
                            <div class="message-text">${this.escapeHtml(h.assistant_response)}</div>
                        </div>`;
                        this.messages.appendChild(el);
                    }
                });
                this.scrollToBottom();
            }
        } catch { /* non-fatal */ }
        // Switch to chat tab
        this.switchTab('chat');
    }

    setupLogout() {
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            window.location.href = '/login';
        });
    }

    // ========================================
    // TABS
    // ========================================
    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        localStorage.setItem('activeTab', tabName);
        this.currentTab = tabName;
    }

    setupSidebar() {
        const toggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        toggle?.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // ========================================
    // CHAT
    // ========================================
    setupChat() {
        this.messages = document.getElementById('messages');
        this.input = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.welcome = document.getElementById('welcome');

        this.input?.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = this.input.scrollHeight + 'px';
        });

        this.input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendBtn?.addEventListener('click', () => this.sendMessage());

        document.getElementById('new-chat-btn')?.addEventListener('click', () => this.newChat());

        document.querySelectorAll('.suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                this.input.value = btn.dataset.query;
                this.sendMessage();
            });
        });
    }

    newChat() {
        this.sessionId = this.generateSessionId();
        this.messages.innerHTML = '';
        if (this.welcome) this.welcome.style.display = '';
        this.input.value = '';
        this.input.style.height = 'auto';
    }

    hideWelcome() {
        if (this.welcome) this.welcome.style.display = 'none';
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
            const response = await this.authedFetch('/api/chat', {
                method: 'POST',
                body: JSON.stringify({ message: text, sessionId: this.sessionId })
            });

            const data = await response.json();
            this.removeTyping(typingId);

            if (data.success) {
                this.addAssistantMessage(data);
                this.loadSessions();
            } else {
                this.addMessage('assistant', data.response || data.error || 'An error occurred.');
            }
        } catch (error) {
            this.removeTyping(typingId);
            if (error.message !== 'Unauthorized') {
                this.addMessage('assistant', 'Failed to connect to server. Please try again.');
            }
        } finally {
            this.input.disabled = false;
            this.sendBtn.disabled = false;
            this.input.focus();
        }
    }

    addMessage(role, content) {
        const el = document.createElement('div');
        el.className = `message ${role}`;
        const label = role === 'user' ? 'You' : 'OSINT Assistant';
        el.innerHTML = `
            <div class="message-content">
                <div class="message-role"><span class="message-role-dot"></span>${label}</div>
                <div class="message-text">${this.escapeHtml(content)}</div>
            </div>`;
        this.messages.appendChild(el);
        this.scrollToBottom();
        return el;
    }

    addAssistantMessage(data) {
        const el = document.createElement('div');
        el.className = 'message assistant';

        let inner = `<div class="message-role"><span class="message-role-dot"></span>OSINT Assistant</div>
                     <div class="message-text">${this.escapeHtml(data.response)}</div>`;

        if (data.chart && data.data && data.data.length > 0) {
            const chartId = 'chart-' + Date.now();
            inner += `<div class="message-chart"><canvas id="${chartId}"></canvas></div>`;
            setTimeout(() => this.createChart(chartId, data.chart, data.data), 100);
        } else if (data.data && data.data.length > 0 && data.data.length <= 25 && !data.chart) {
            inner += this.createDataTable(data.data);
        }

        if (data.sql) {
            const sqlId = 'sql-' + Date.now();
            inner += `
                <button class="sql-toggle" onclick="document.getElementById('${sqlId}').classList.toggle('visible')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                    View SQL
                </button>
                <div class="sql-code" id="${sqlId}">${this.escapeHtml(data.sql)}</div>`;
        }

        if (data.provider) {
            inner += `<span class="provider-badge">via ${data.provider}${data.model ? ' · ' + data.model : ''}</span>`;
        }

        el.innerHTML = `<div class="message-content">${inner}</div>`;
        this.messages.appendChild(el);
        this.scrollToBottom();
    }

    createDataTable(data) {
        if (!data || data.length === 0) return '';
        const cols = Object.keys(data[0]);
        let html = '<div class="message-table"><table><thead><tr>';
        cols.forEach(c => { html += `<th>${this.escapeHtml(c)}</th>`; });
        html += '</tr></thead><tbody>';
        data.slice(0, 25).forEach(row => {
            html += '<tr>';
            cols.forEach(c => { html += `<td>${this.escapeHtml(String(row[c] ?? ''))}</td>`; });
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

        const labels = data.map(r => r[labelColumn]);
        const datasets = dataColumns.map((col, i) => ({
            label: col,
            data: data.map(r => r[col]),
            backgroundColor: this.getChartColors(type, data.length, i),
            borderColor: type === 'line' ? this.getLineColor(i) : undefined,
            borderWidth: type === 'line' ? 2 : 1,
            borderRadius: type === 'bar' ? 4 : 0
        }));

        this.charts[canvasId] = new Chart(ctx, {
            type: (type === 'pie' || type === 'doughnut') ? type : (type === 'line' ? 'line' : 'bar'),
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 12, padding: 16 } }
                },
                scales: (type !== 'pie' && type !== 'doughnut') ? {
                    y: { beginAtZero: true, grid: { color: '#f0f1f5' } },
                    x: { grid: { display: false } }
                } : undefined
            }
        });
    }

    getChartColors(type, count, idx) {
        const palette = ['#5b5ef4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16'];
        return (type === 'pie' || type === 'doughnut')
            ? palette.slice(0, count)
            : palette[idx % palette.length];
    }

    getLineColor(idx) {
        return ['#5b5ef4','#10b981','#f59e0b','#ef4444','#8b5cf6'][idx % 5];
    }

    addTyping() {
        const id = 'typing-' + Date.now();
        const el = document.createElement('div');
        el.id = id;
        el.className = 'message assistant';
        el.innerHTML = `
            <div class="message-content">
                <div class="message-role"><span class="message-role-dot"></span>OSINT Assistant</div>
                <div class="typing">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>`;
        this.messages.appendChild(el);
        this.scrollToBottom();
        return id;
    }

    removeTyping(id) { document.getElementById(id)?.remove(); }

    scrollToBottom() {
        if (this.messages) this.messages.scrollTop = this.messages.scrollHeight;
    }

    // ========================================
    // SQL EDITOR
    // ========================================
    setupSQLEditor() {
        this.sqlEditor = document.getElementById('sql-editor');
        this.lineNumbers = document.getElementById('line-numbers');
        this.runSQLBtn = document.getElementById('run-sql-btn');
        this.clearSQLBtn = document.getElementById('clear-sql-btn');
        this.sqlResults = document.getElementById('sql-results');

        this.sqlEditor?.addEventListener('input', () => this.updateLineNumbers());
        this.sqlEditor?.addEventListener('scroll', () => this.syncScroll());
        this.runSQLBtn?.addEventListener('click', () => this.executeSQL());

        this.sqlEditor?.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.executeSQL();
            }
        });

        this.clearSQLBtn?.addEventListener('click', () => {
            this.sqlEditor.value = '';
            this.updateLineNumbers();
            this.resetResultsPlaceholder();
        });

        this.updateLineNumbers();
    }

    resetResultsPlaceholder() {
        this.sqlResults.innerHTML = `
            <div class="results-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
                <p>Run a query to see results</p>
                <p class="results-hint">Ctrl+Enter to execute</p>
            </div>`;
    }

    updateLineNumbers() {
        if (!this.sqlEditor || !this.lineNumbers) return;
        const lines = this.sqlEditor.value.split('\n').length;
        this.lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    }

    syncScroll() {
        if (this.lineNumbers) this.lineNumbers.scrollTop = this.sqlEditor.scrollTop;
    }

    async executeSQL() {
        const sql = this.sqlEditor?.value.trim();
        if (!sql) return;

        this.runSQLBtn.disabled = true;
        this.runSQLBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="animation:spin 1s linear infinite">
                <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg> Running…`;

        try {
            const response = await this.authedFetch('/api/sql/execute', {
                method: 'POST',
                body: JSON.stringify({ sql })
            });

            const data = await response.json();

            if (data.success) {
                this.displaySQLResults(data.results, data.executionTime);
            } else {
                this.displaySQLError(data.error);
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.displaySQLError('Failed to execute query: ' + error.message);
            }
        } finally {
            this.runSQLBtn.disabled = false;
            this.runSQLBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Run Query`;
        }
    }

    displaySQLResults(results, executionTime) {
        if (!results || results.length === 0) {
            this.sqlResults.innerHTML = `
                <div class="results-header">
                    <div class="results-info">Returned <strong>0 rows</strong>${executionTime ? ` in ${executionTime}ms` : ''}</div>
                </div>
                <div class="results-placeholder" style="height:auto;padding:32px">
                    <p>Query returned no results</p>
                </div>`;
            return;
        }

        const cols = Object.keys(results[0]);
        let html = `
            <div class="results-header">
                <div class="results-info">Returned <strong>${results.length} row${results.length !== 1 ? 's' : ''}</strong>${executionTime ? ` in ${executionTime}ms` : ''}</div>
            </div>
            <div class="results-table-wrapper">
                <table class="results-table">
                    <thead><tr>${cols.map(c => `<th>${this.escapeHtml(c)}</th>`).join('')}</tr></thead>
                    <tbody>`;

        results.forEach(row => {
            html += '<tr>' + cols.map(c => {
                const v = row[c] !== null && row[c] !== undefined ? String(row[c]) : '';
                return `<td>${this.escapeHtml(v)}</td>`;
            }).join('') + '</tr>';
        });

        html += '</tbody></table></div>';
        this.sqlResults.innerHTML = html;
    }

    displaySQLError(error) {
        this.sqlResults.innerHTML = `<div class="error-message"><strong>Error:</strong><br>${this.escapeHtml(error)}</div>`;
    }

    escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => { new TabManager(); });
