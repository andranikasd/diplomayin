/**
 * Armenian OSINT Analytics — Tab Manager
 * Handles all UI: chat, SQL editor, security, graph, session history
 */
class TabManager {
    constructor() {
        this.token     = localStorage.getItem('auth_token')
        this.sessionId = this._newSessionId()
        this.charts    = {}
        this._graph    = null
        this._graphLoaded = false
        this._securityManager = null

        if (!this.token) { window.location.href = '/login'; return }

        this._init()
        this._loadUserInfo()
    }

    _newSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)
    }

    // ── Auth helpers ─────────────────────────────────────────────
    _headers() {
        return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` }
    }

    async _fetch(url, opts = {}) {
        const res = await fetch(url, { ...opts, headers: { ...this._headers(), ...(opts.headers || {}) } })
        if (res.status === 401) { this._logout(); throw new Error('Unauthorized') }
        return res
    }

    _logout() {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        window.location.href = '/login'
    }

    // ── Init ─────────────────────────────────────────────────────
    _init() {
        this._setupNav()
        this._setupChat()
        this._setupSQLEditor()
        this._setupSidebar()
        this._setupLogout()

        // Security tab
        if (typeof SecurityManager !== 'undefined') {
            this._securityManager = new SecurityManager(this)
        }

        // Switch to last active tab
        const lastTab = localStorage.getItem('activeTab') || 'chat'
        this._switchTab(lastTab)

        // Load chat history
        this._loadSessions()
    }

    async _loadUserInfo() {
        let user = null
        try { user = JSON.parse(localStorage.getItem('auth_user') || '') } catch { /**/ }
        if (!user) {
            try {
                const res  = await this._fetch('/api/auth/me')
                const data = await res.json()
                if (data.success) { user = data.user; localStorage.setItem('auth_user', JSON.stringify(user)) }
            } catch { /**/ }
        }
        if (!user) return

        const name = user.full_name || user.email.split('@')[0]
        const init = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        const el = id => document.getElementById(id)
        if (el('user-avatar')) el('user-avatar').textContent = init
        if (el('user-name'))   el('user-name').textContent   = name
        if (el('user-email'))  el('user-email').textContent  = user.email
    }

    // ── Session history ──────────────────────────────────────────
    async _loadSessions() {
        const el = document.getElementById('chat-history')
        if (!el) return
        try {
            const res  = await this._fetch('/api/chat/sessions')
            const data = await res.json()
            if (!data.success || !data.sessions?.length) {
                el.innerHTML = '<p class="empty-history">No previous chats</p>'
                return
            }
            el.innerHTML = data.sessions.map(s => {
                const title = this._esc((s.title || 'Untitled').slice(0, 50))
                const date  = s.last_message ? new Date(s.last_message).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : ''
                return `<div class="history-item" data-session="${this._esc(s.session_id)}" title="${title}">
                    <span class="history-item-text">${title}</span>
                    <span class="history-item-date">${date}</span>
                </div>`
            }).join('')
            el.querySelectorAll('.history-item').forEach(item =>
                item.addEventListener('click', () => this._openSession(item.dataset.session))
            )
        } catch { /**/ }
    }

    async _openSession(sessionId) {
        this.sessionId = sessionId
        this._msgs.innerHTML = ''
        if (this._welcome) this._welcome.style.display = 'none'
        try {
            const res  = await this._fetch(`/api/chat/history/${sessionId}`)
            const data = await res.json()
            if (data.success && data.history?.length) {
                data.history.forEach(h => {
                    this._addMsg('user', h.user_message)
                    if (h.assistant_response) {
                        const el = document.createElement('div')
                        el.className = 'message assistant'
                        el.innerHTML = `<div class="message-content">
                            <div class="message-role"><span class="message-role-dot"></span>OSINT Assistant</div>
                            <div class="message-text">${this._esc(h.assistant_response)}</div>
                        </div>`
                        this._msgs.appendChild(el)
                    }
                })
                this._scrollBottom()
            }
        } catch { /**/ }
        this._switchTab('chat')
    }

    // ── Navigation ───────────────────────────────────────────────
    _setupNav() {
        document.querySelectorAll('.nav-item[data-tab]').forEach(btn =>
            btn.addEventListener('click', () => this._switchTab(btn.dataset.tab))
        )
    }

    _switchTab(tab) {
        // Update nav buttons
        document.querySelectorAll('.nav-item[data-tab]').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.tab === tab)
        )
        // Update content panels
        document.querySelectorAll('.tab-content').forEach(c =>
            c.classList.toggle('active', c.id === `${tab}-tab`)
        )
        localStorage.setItem('activeTab', tab)

        // Tab-specific actions
        if (tab === 'security' && this._securityManager) {
            this._securityManager.render()
        }
        if (tab === 'graph') {
            this._initGraph()
            if (this._graph) this._graph.restart()
        } else if (this._graph) {
            this._graph.stop()
        }
    }

    _setupSidebar() {
        const toggle  = document.getElementById('sidebar-toggle')
        const sidebar = document.getElementById('sidebar')
        toggle?.addEventListener('click', () => sidebar?.classList.toggle('open'))
        // Close on outside click (mobile)
        document.addEventListener('click', (e) => {
            if (sidebar?.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
                sidebar.classList.remove('open')
            }
        })
    }

    _setupLogout() {
        document.getElementById('logout-btn')?.addEventListener('click', () => this._logout())
    }

    // ── Chat ─────────────────────────────────────────────────────
    _setupChat() {
        this._msgs    = document.getElementById('messages')
        this._input   = document.getElementById('message-input')
        this._sendBtn = document.getElementById('send-btn')
        this._welcome = document.getElementById('welcome')

        this._input?.addEventListener('input', () => {
            this._input.style.height = 'auto'
            this._input.style.height = Math.min(this._input.scrollHeight, 160) + 'px'
        })
        this._input?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send() }
        })
        this._sendBtn?.addEventListener('click', () => this._send())
        document.getElementById('new-chat-btn')?.addEventListener('click', () => this._newChat())
        document.querySelectorAll('.suggestion').forEach(btn =>
            btn.addEventListener('click', () => { this._input.value = btn.dataset.query; this._send() })
        )
    }

    _newChat() {
        this.sessionId = this._newSessionId()
        this._msgs.innerHTML = ''
        if (this._welcome) this._welcome.style.display = ''
        this._input.value = ''
        this._input.style.height = 'auto'
        this._switchTab('chat')
    }

    async _send() {
        const text = this._input?.value.trim()
        if (!text) return

        if (this._welcome) this._welcome.style.display = 'none'
        this._addMsg('user', text)
        this._input.value = ''
        this._input.style.height = 'auto'
        this._input.disabled = true
        this._sendBtn.disabled = true

        const typingId = this._addTyping()

        try {
            const res  = await this._fetch('/api/chat', {
                method: 'POST',
                body:   JSON.stringify({ message: text, sessionId: this.sessionId })
            })
            const data = await res.json()
            this._removeTyping(typingId)

            if (data.success) {
                this._addAssistantMsg(data)
                // Refresh session history after successful message
                this._loadSessions()
            } else {
                this._addMsg('assistant', data.response || data.error || 'An error occurred.')
            }
        } catch (err) {
            this._removeTyping(typingId)
            if (err.message !== 'Unauthorized') {
                this._addMsg('assistant', 'Failed to connect to server. Please check your connection.')
            }
        } finally {
            this._input.disabled = false
            this._sendBtn.disabled = false
            this._input.focus()
        }
    }

    _addMsg(role, content) {
        const el  = document.createElement('div')
        el.className = `message ${role}`
        const label = role === 'user' ? 'You' : 'OSINT Assistant'
        el.innerHTML = `<div class="message-content">
            <div class="message-role"><span class="message-role-dot"></span>${label}</div>
            <div class="message-text">${this._esc(content)}</div>
        </div>`
        this._msgs.appendChild(el)
        this._scrollBottom()
        return el
    }

    _addAssistantMsg(data) {
        const el  = document.createElement('div')
        el.className = 'message assistant'

        let inner = `<div class="message-role"><span class="message-role-dot"></span>OSINT Assistant</div>
                     <div class="message-text">${this._esc(data.response)}</div>`

        if (data.chart && data.data?.length) {
            const cid = 'chart-' + Date.now()
            inner += `<div class="message-chart"><canvas id="${cid}"></canvas></div>`
            setTimeout(() => this._renderChart(cid, data.chart, data.data), 100)
        } else if (data.data?.length && data.data.length <= 30 && !data.chart) {
            inner += this._renderTable(data.data)
        }

        if (data.sql) {
            const sid = 'sql-' + Date.now()
            inner += `<button class="sql-toggle" onclick="document.getElementById('${sid}').classList.toggle('visible')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>View SQL</button>
                <div class="sql-code" id="${sid}">${this._esc(data.sql)}</div>`
        }

        if (data.provider) {
            inner += `<span class="provider-badge">via ${data.provider}${data.model ? ' · ' + data.model : ''}</span>`
        }

        el.innerHTML = `<div class="message-content">${inner}</div>`
        this._msgs.appendChild(el)
        this._scrollBottom()
    }

    _renderTable(rows) {
        if (!rows?.length) return ''
        const cols = Object.keys(rows[0])
        let h = '<div class="message-table"><table><thead><tr>'
        cols.forEach(c => { h += `<th>${this._esc(c)}</th>` })
        h += '</tr></thead><tbody>'
        rows.slice(0, 30).forEach(row => {
            h += '<tr>'
            cols.forEach(c => { h += `<td>${this._esc(String(row[c] ?? ''))}</td>` })
            h += '</tr>'
        })
        h += '</tbody></table></div>'
        return h
    }

    _renderChart(canvasId, cfg, data) {
        const canvas = document.getElementById(canvasId)
        if (!canvas || typeof Chart === 'undefined') return
        const { type, labelColumn, dataColumns } = cfg
        const palette = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16']
        const labels   = data.map(r => r[labelColumn])
        const isPie    = type === 'pie' || type === 'doughnut'
        const datasets = dataColumns.map((col, i) => ({
            label:           col,
            data:            data.map(r => r[col]),
            backgroundColor: isPie ? palette.slice(0, data.length) : palette[i % palette.length],
            borderColor:     type === 'line' ? palette[i % palette.length] : undefined,
            borderWidth:     type === 'line' ? 2 : 0,
            borderRadius:    type === 'bar'  ? 4 : 0,
        }))
        this.charts[canvasId] = new Chart(canvas.getContext('2d'), {
            type: isPie ? type : (type === 'line' ? 'line' : 'bar'),
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, color: '#8892b0' } }
                },
                scales: isPie ? undefined : {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8892b0' } },
                    x: { grid: { display: false }, ticks: { color: '#8892b0' } }
                }
            }
        })
    }

    _addTyping() {
        const id = 'typing-' + Date.now()
        const el = document.createElement('div')
        el.id = id; el.className = 'message assistant'
        el.innerHTML = `<div class="message-content">
            <div class="message-role"><span class="message-role-dot"></span>OSINT Assistant</div>
            <div class="typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
        </div>`
        this._msgs.appendChild(el)
        this._scrollBottom()
        return id
    }
    _removeTyping(id) { document.getElementById(id)?.remove() }
    _scrollBottom()   { if (this._msgs) this._msgs.scrollTop = this._msgs.scrollHeight }

    // ── SQL Editor ───────────────────────────────────────────────
    _setupSQLEditor() {
        this._sqlEd   = document.getElementById('sql-editor')
        this._lineNos = document.getElementById('line-numbers')
        this._runBtn  = document.getElementById('run-sql-btn')
        this._sqlRes  = document.getElementById('sql-results')

        this._sqlEd?.addEventListener('input',  () => this._updateLineNos())
        this._sqlEd?.addEventListener('scroll', () => { if (this._lineNos) this._lineNos.scrollTop = this._sqlEd.scrollTop })
        this._runBtn?.addEventListener('click',  () => this._runSQL())
        this._sqlEd?.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this._runSQL() } })
        document.getElementById('clear-sql-btn')?.addEventListener('click', () => {
            this._sqlEd.value = ''
            this._updateLineNos()
            this._resetSQLPlaceholder()
        })
        this._updateLineNos()
    }

    _updateLineNos() {
        if (!this._sqlEd || !this._lineNos) return
        const n = this._sqlEd.value.split('\n').length
        this._lineNos.innerHTML = Array.from({ length: n }, (_, i) => i + 1).join('\n')
    }

    _resetSQLPlaceholder() {
        this._sqlRes.innerHTML = `<div class="results-placeholder">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            <p>Run a query to see results</p>
            <p class="results-hint">Ctrl+Enter to execute</p>
        </div>`
    }

    async _runSQL() {
        const sql = this._sqlEd?.value.trim()
        if (!sql) return
        this._runBtn.disabled = true
        this._runBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin" style="animation:spin 1s linear infinite"><path d="M12 2a10 10 0 1 0 10 10" stroke-linecap="round"/></svg> Running…`
        try {
            const res  = await this._fetch('/api/sql/execute', { method: 'POST', body: JSON.stringify({ sql }) })
            const data = await res.json()
            if (data.success) {
                this._showSQLResults(data.results, data.executionTime)
            } else {
                this._sqlRes.innerHTML = `<div class="error-message"><strong>Error:</strong><br>${this._esc(data.error)}</div>`
            }
        } catch (err) {
            if (err.message !== 'Unauthorized') {
                this._sqlRes.innerHTML = `<div class="error-message"><strong>Error:</strong><br>${this._esc(err.message)}</div>`
            }
        } finally {
            this._runBtn.disabled = false
            this._runBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Run Query`
        }
    }

    _showSQLResults(rows, ms) {
        if (!rows?.length) {
            this._sqlRes.innerHTML = `<div class="results-header"><div class="results-info">Returned <strong>0 rows</strong>${ms ? ` in ${ms}ms` : ''}</div></div>
                <div class="results-placeholder" style="height:auto;padding:32px"><p>Query returned no results</p></div>`
            return
        }
        const cols = Object.keys(rows[0])
        let h = `<div class="results-header"><div class="results-info">Returned <strong>${rows.length} row${rows.length !== 1 ? 's' : ''}</strong>${ms ? ` in ${ms}ms` : ''}</div></div>
            <div class="results-table-wrapper"><table class="results-table">
            <thead><tr>${cols.map(c => `<th>${this._esc(c)}</th>`).join('')}</tr></thead><tbody>`
        rows.forEach(row => {
            h += '<tr>' + cols.map(c => `<td>${this._esc(String(row[c] ?? ''))}</td>`).join('') + '</tr>'
        })
        h += '</tbody></table></div>'
        this._sqlRes.innerHTML = h
    }

    // ── Graph ────────────────────────────────────────────────────
    async _initGraph() {
        if (this._graphLoaded) return
        const svgEl = document.getElementById('network-svg')
        if (!svgEl || typeof NetworkGraph === 'undefined') return
        this._graph = new NetworkGraph(svgEl)

        try {
            const res  = await this._fetch('/api/data/graph')
            const data = await res.json()
            if (!data.success) return
            this._graph.load(data.nodes, data.edges)
            this._graph.buildLegend()
            const info = document.getElementById('graph-info')
            if (info) info.textContent = `${data.nodes.length} companies · ${data.edges.length} connections`
        } catch { /**/ }

        document.getElementById('graph-reset-btn')?.addEventListener('click', () => this._graph?.resetLayout())
        document.getElementById('graph-filter')?.addEventListener('change', e => this._graph?.applyFilter(e.target.value))
        this._graphLoaded = true
    }

    // ── Utility ──────────────────────────────────────────────────
    _esc(text) {
        const d = document.createElement('div')
        d.textContent = String(text ?? '')
        return d.innerHTML
    }
}

// ── Compat shims for SecurityManager (uses old method names) ─────
TabManager.prototype.authedFetch  = function(url, opts) { return this._fetch(url, opts) }
TabManager.prototype.getAuthHeaders = function() { return this._headers() }
TabManager.prototype.escapeHtml   = function(t) { return this._esc(t) }

document.addEventListener('DOMContentLoaded', () => { new TabManager() })
