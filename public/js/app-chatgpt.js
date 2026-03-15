// ChatGPT-style App
class ChatApp {
    constructor() {
        this.messages = document.getElementById('messages');
        this.welcome = document.getElementById('welcome');
        this.input = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.sidebar = document.getElementById('sidebar');

        this.sessionId = this.generateSessionId();
        this.charts = {};

        this.init();
    }

    init() {
        // Auto-resize textarea
        this.input.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = Math.min(this.input.scrollHeight, 200) + 'px';
        });

        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // New chat
        this.newChatBtn.addEventListener('click', () => {
            this.sessionId = this.generateSessionId();
            this.clearMessages();
        });

        // Sidebar toggle (mobile)
        this.sidebarToggle.addEventListener('click', () => {
            this.sidebar.classList.toggle('open');
        });

        // Suggestions
        document.querySelectorAll('.suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                this.input.value = btn.dataset.query;
                this.sendMessage();
            });
        });
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    clearMessages() {
        this.messages.innerHTML = '';
        this.welcome.style.display = 'block';
    }

    hideWelcome() {
        if (this.welcome) {
            this.welcome.style.display = 'none';
        }
    }

    async sendMessage() {
        const text = this.input.value.trim();
        console.log('📤 sendMessage called, text:', text);

        if (!text) {
            console.log('❌ Empty message, aborting');
            return;
        }

        console.log('✅ Hiding welcome screen');
        this.hideWelcome();

        // Add user message
        console.log('➕ Adding user message to UI');
        this.addMessage('user', text);

        // Clear input
        this.input.value = '';
        this.input.style.height = 'auto';

        // Disable input
        this.input.disabled = true;
        this.sendBtn.disabled = true;

        // Show typing
        console.log('⏳ Adding typing indicator');
        const typingId = this.addTyping();

        try {
            console.log('🌐 Sending POST request to /api/chat');
            console.log('Request body:', { message: text, sessionId: this.sessionId });

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, sessionId: this.sessionId })
            });

            console.log('📥 Response received, status:', response.status);

            const data = await response.json();
            console.log('📦 Response data:', data);

            this.removeTyping(typingId);

            if (data.success) {
                console.log('✅ Success! Adding assistant message');
                this.addAssistantMessage(data);
            } else {
                console.log('⚠️  Response unsuccessful');
                this.addMessage('assistant', data.response || data.error || 'An error occurred.');
            }
        } catch (error) {
            console.error('💥 Fetch error:', error);
            this.removeTyping(typingId);
            this.addMessage('assistant', 'Failed to connect to server.');
        } finally {
            console.log('🔓 Re-enabling input');
            this.input.disabled = false;
            this.sendBtn.disabled = false;
            this.input.focus();
        }
    }

    addMessage(role, content) {
        const msgEl = document.createElement('div');
        msgEl.className = `message ${role}`;
        msgEl.innerHTML = `
      <div class="message-content">
        <div class="message-text">${this.escapeHtml(content)}</div>
      </div>
    `;
        this.messages.appendChild(msgEl);
        this.scrollToBottom();
    }

    addAssistantMessage(data) {
        const msgEl = document.createElement('div');
        msgEl.className = 'message assistant';

        let contentHtml = `<div class="message-text">${this.escapeHtml(data.response)}</div>`;

        // Add chart if present
        if (data.chart && data.data && data.data.length > 0) {
            const chartId = 'chart-' + Date.now();
            contentHtml += `
        <div class="message-chart">
          <canvas id="${chartId}"></canvas>
        </div>
      `;
            setTimeout(() => this.createChart(chartId, data.chart, data.data), 100);
        }
        // Add table for small datasets
        else if (data.data && data.data.length > 0 && data.data.length <= 15 && !data.chart) {
            contentHtml += this.createTable(data.data);
        }

        // SQL toggle
        if (data.sql) {
            const sqlId = 'sql-' + Date.now();
            contentHtml += `
        <button class="sql-toggle" onclick="document.getElementById('${sqlId}').classList.toggle('visible')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          View SQL Query
        </button>
        <div class="sql-code" id="${sqlId}">${this.escapeHtml(data.sql)}</div>
      `;
        }

        msgEl.innerHTML = `<div class="message-content">${contentHtml}</div>`;
        this.messages.appendChild(msgEl);
        this.scrollToBottom();
    }

    createTable(data) {
        if (!data || data.length === 0) return '';

        const cols = Object.keys(data[0]);
        let html = '<div class="message-table"><table><thead><tr>';

        cols.forEach(col => {
            html += `<th>${this.escapeHtml(col)}</th>`;
        });

        html += '</tr></thead><tbody>';

        data.slice(0, 15).forEach(row => {
            html += '<tr>';
            cols.forEach(col => {
                html += `<td>${this.escapeHtml(String(row[col] || ''))}</td>`;
            });
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

        const labels = data.map(row => String(row[labelColumn] || ''));
        const datasets = dataColumns.map((col, i) => ({
            label: col,
            data: data.map(row => row[col]),
            backgroundColor: type === 'pie' || type === 'doughnut' ?
                this.getColors(data.length) : this.getColors(1, i)[0],
            borderColor: type === 'line' ? this.getColors(1, i)[0] : undefined,
            borderWidth: type === 'line' ? 3 : 1,
            fill: type === 'line' ? false : undefined
        }));

        this.charts[canvasId] = new Chart(ctx, {
            type: type === 'pie' || type === 'doughnut' ? type : (type === 'line' ? 'line' : 'bar'),
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: { size: 12, family: 'Inter' }
                        }
                    }
                },
                scales: type !== 'pie' && type !== 'doughnut' ? {
                    y: { beginAtZero: true, grid: { color: '#E5E5E5' } },
                    x: { grid: { display: false } }
                } : undefined
            }
        });
    }

    getColors(count, index = 0) {
        const palette = [
            '#19C37D', '#667eea', '#F59E0B', '#EF4444', '#8B5CF6',
            '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
        ];

        if (count > 1) {
            return palette.slice(0, count);
        }
        return [palette[index % palette.length]];
    }

    addTyping() {
        const id = 'typing-' + Date.now();
        const msgEl = document.createElement('div');
        msgEl.id = id;
        msgEl.className = 'message assistant';
        msgEl.innerHTML = `
      <div class="message-content">
        <div class="typing">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
        this.messages.appendChild(msgEl);
        this.scrollToBottom();
        return id;
    }

    removeTyping(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.messages.scrollTop = this.messages.scrollHeight;
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
