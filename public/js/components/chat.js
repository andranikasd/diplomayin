// Chat Component
class ChatComponent {
    constructor() {
        this.messagesContainer = document.getElementById('chat-messages');
        this.input = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-button');
        this.sessionId = this.getOrCreateSessionId();

        this.setupEventListeners();
        this.loadHistory();
    }

    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = this.generateSessionId();
            localStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    setupEventListeners() {
        // Auto-resize textarea
        this.input.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = this.input.scrollHeight + 'px';
            this.sendButton.disabled = !this.input.value.trim();
        });

        // Send on Enter (Shift+Enter for new line)
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send button click
        this.sendButton.addEventListener('click', () => this.sendMessage());

        // Example queries
        document.querySelectorAll('.example-query').forEach(el => {
            el.addEventListener('click', () => {
                const query = el.getAttribute('data-query');
                this.input.value = query;
                this.sendButton.disabled = false;
                this.sendMessage();
            });
        });
    }

    async loadHistory() {
        try {
            const response = await fetch(`/api/chat/history/${this.sessionId}`);
            const data = await response.json();

            if (data.success && data.history.length > 0) {
                // Clear welcome message
                this.messagesContainer.innerHTML = '';

                // Render history
                data.history.forEach(item => {
                    this.addUserMessage(item.user_message, false);
                    if (item.sql_error) {
                        this.addErrorMessage(item.sql_error);
                    } else {
                        this.addAssistantMessage(item.generated_sql, item.result_count);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    async sendMessage() {
        const message = this.input.value.trim();
        if (!message) return;

        // Add user message to UI
        this.addUserMessage(message);

        // Clear input
        this.input.value = '';
        this.input.style.height = 'auto';
        this.sendButton.disabled = true;

        // Show loading
        this.showLoading();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, sessionId: this.sessionId })
            });

            const data = await response.json();
            this.hideLoading();

            if (data.success) {
                this.addAssistantMessage(data.sql, data.resultCount, data);
            } else {
                this.addErrorMessage(data.error);
            }
        } catch (error) {
            this.hideLoading();
            this.addErrorMessage('Failed to process your message. Please try again.');
            console.error('Error:', error);
        }
    }

    addUserMessage(text, removeWelcome = true) {
        if (removeWelcome) {
            const welcome = this.messagesContainer.querySelector('.welcome-message');
            if (welcome) welcome.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = 'message user';
        messageEl.innerHTML = `
      <div class="message-avatar">👤</div>
      <div class="message-content">
        <div class="message-text">${this.escapeHtml(text)}</div>
      </div>
    `;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    addAssistantMessage(sql, resultCount, fullData = null) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant';

        let content = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="sql-query">${this.escapeHtml(sql)}</div>
        <div class="result-summary">✓ Found ${resultCount} result${resultCount !== 1 ? 's' : ''}</div>
    `;

        if (fullData && resultCount > 0) {
            content += `
        <button class="view-results-btn" onclick="window.resultsComponent.showResults(${this.escapeHtml(JSON.stringify(fullData))})">
          View Results & Charts
        </button>
      `;
        }

        content += `</div>`;
        messageEl.innerHTML = content;

        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    addErrorMessage(error) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant';
        messageEl.innerHTML = `
      <div class="message-avatar">⚠️</div>
      <div class="message-content">
        <div class="message-text" style="border-color: var(--error);">
          <strong>Error:</strong> ${this.escapeHtml(error)}
        </div>
      </div>
    `;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('active');
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.chatComponent = new ChatComponent();
    });
} else {
    window.chatComponent = new ChatComponent();
}
