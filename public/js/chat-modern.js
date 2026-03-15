// Modern Chat UI with inline charts and natural responses
class ModernChat {
    constructor() {
        this.messagesArea = document.getElementById('messages-area');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.sessionId = this.generateSessionId();
        this.charts = {};

        this.init();
    }

    init() {
        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = (this.messageInput.scrollHeight) + 'px';
        });

        // Send on Enter (Shift+Enter for newline)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send button click
        this.sendButton.addEventListener('click', () => this.sendMessage());

        // Example query buttons
        document.querySelectorAll('.example-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                this.messageInput.value = query;
                this.sendMessage();
            });
        });

        // Check database status
        this.checkHealth();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async checkHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            const dbStatus = document.getElementById('db-status');
            const dot = dbStatus.querySelector('.status-dot');

            if (data.database === 'connected') {
                dot.classList.remove('disconnected');
            } else {
                dot.classList.add('disconnected');
            }
        } catch (error) {
            const dot = document.getElementById('db-status').querySelector('.status-dot');
            dot.classList.add('disconnected');
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Disable input
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;

        // Show user message
        this.addUserMessage(message);

        // Clear input
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        // Show typing indicator
        const typingId = this.addTypingIndicator();

        try {
            // Send to API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();

            // Remove typing indicator
            this.removeTypingIndicator(typingId);

            if (data.success) {
                this.addAssistantMessage(data);
            } else {
                this.addErrorMessage(data.response || data.error || 'An error occurred');
            }
        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.addErrorMessage('Failed to connect to server');
        } finally {
            // Re-enable input
            this.messageInput.disabled = false;
            this.sendButton.disabled = false;
            this.messageInput.focus();
        }
    }

    addUserMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message user-message';
        messageEl.innerHTML = `
      <div class="message-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4 .48 10 4.48 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-bubble">${this.escapeHtml(text)}</div>
      </div>
    `;
        this.messagesArea.appendChild(messageEl);
        this.scrollToBottom();
    }

    addAssistantMessage(data) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant-message';

        let contentHtml = `<div class="message-bubble">${this.escapeHtml(data.response)}</div>`;

        // Add chart if available
        if (data.chart && data.data && data.data.length > 0) {
            const chartId = 'chart-' + Date.now();
            contentHtml += `
        <div class="message-chart">
          <canvas id="${chartId}"></canvas>
        </div>
      `;

            // Create chart after DOM insertion
            setTimeout(() => {
                this.createChart(chartId, data.chart, data.data);
            }, 100);
        }

        // Add data table for small result sets (< 20 rows)
        else if (data.data && data.data.length > 0 && data.data.length <= 20 && !data.chart) {
            contentHtml += this.createDataTable(data.data);
        }

        // Add SQL details (collapsible)
        if (data.sql) {
            const sqlId = 'sql-' + Date.now();
            contentHtml += `
        <div class="sql-details">
          <button class="sql-toggle" onclick="document.getElementById('${sqlId}').classList.toggle('visible')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="9 18 15 12 9 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            View SQL Query
          </button>
          <div class="sql-code" id="${sqlId}">${this.escapeHtml(data.sql)}</div>
        </div>
      `;
        }

        messageEl.innerHTML = `
      <div class="message-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <path d="M12 6v6l4 2" stroke-width="2"/>
        </svg>
      </div>
      <div class="message-content">
        ${contentHtml}
      </div>
    `;

        this.messagesArea.appendChild(messageEl);
        this.scrollToBottom();
    }

    createDataTable(data) {
        if (!data || data.length === 0) return '';

        const columns = Object.keys(data[0]);
        let html = '<div class="message-table"><table>';

        // Header
        html += '<thead><tr>';
        columns.forEach(col => {
            html += `<th>${this.escapeHtml(col)}</th>`;
        });
        html += '</tr></thead>';

        // Body
        html += '<tbody>';
        data.slice(0, 20).forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
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

        // Prepare chart data
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
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: type !== 'pie' && type !== 'doughnut' ? {
                    y: {
                        beginAtZero: true
                    }
                } : undefined
            }
        });
    }

    getChartColors(type, count, datasetIndex) {
        const colors = [
            '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
        ];

        if (type === 'pie' || type === 'doughnut') {
            return colors.slice(0, count);
        }

        return colors[datasetIndex % colors.length];
    }

    getLineColor(index) {
        const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
        return colors[index % colors.length];
    }

    addTypingIndicator() {
        const id = 'typing-' + Date.now();
        const messageEl = document.createElement('div');
        messageEl.id = id;
        messageEl.className = 'message assistant-message';
        messageEl.innerHTML = `
      <div class="message-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <path d="M12 6v6l4 2" stroke-width="2"/>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-bubble">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
    `;
        this.messagesArea.appendChild(messageEl);
        this.scrollToBottom();
        return id;
    }

    removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    addErrorMessage(error) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant-message';
        messageEl.innerHTML = `
      <div class="message-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <path d="M12 6v6l4 2" stroke-width="2"/>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-bubble">${this.escapeHtml(error)}</div>
      </div>
    `;
        this.messagesArea.appendChild(messageEl);
        this.scrollToBottom();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
    }
}

// Initialize chat when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ModernChat();
});
