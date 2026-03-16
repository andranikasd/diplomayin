/**
 * Armenian OSINT Analytics — Tab Manager
 * Handles all UI: chat, SQL editor, security, admin
 */
class TabManager {
    constructor() {
        this.token     = localStorage.getItem('auth_token')
        this.sessionId = this._newSessionId()
        this.charts    = {}
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

        if (typeof SecurityManager !== 'undefined') {
            this._securityManager = new SecurityManager(this)
        }

        const lastTab = localStorage.getItem('activeTab') || 'chat'
        this._switchTab(lastTab)
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

        // Show admin tab only for admin role
        if (user.role === 'admin') {
            const adminNav = document.getElementById('admin-nav-item')
            if (adminNav) adminNav.style.display = ''
        }
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
        document.querySelectorAll('.nav-item[data-tab]').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.tab === tab)
        )
        document.querySelectorAll('.tab-content').forEach(c =>
            c.classList.toggle('active', c.id === `${tab}-tab`)
        )
        localStorage.setItem('activeTab', tab)

        if (tab === 'security' && this._securityManager) {
            this._securityManager.render()
        }
        if (tab === 'admin') {
            this._initAdminTab()
        }
    }

    _setupSidebar() {
        const toggle  = document.getElementById('sidebar-toggle')
        const sidebar = document.getElementById('sidebar')
        toggle?.addEventListener('click', () => sidebar?.classList.toggle('open'))
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

        if (data.data?.length && data.data.length <= 30) {
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

        if (data.researched) {
            inner += `<span class="research-badge">Web researched &amp; stored</span>`
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
            if (this._sqlEd) this._sqlEd.value = ''
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
        if (!this._sqlRes) return
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
        this._runBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M12 2a10 10 0 1 0 10 10" stroke-linecap="round"/></svg> Running…`
        try {
            const res  = await this._fetch('/api/sql/execute', { method: 'POST', body: JSON.stringify({ sql }) })
            const data = await res.json()
            if (data.success) {
                this._showSQLResults(data.results, data.executionTime, this._sqlRes)
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

    _showSQLResults(rows, ms, container) {
        const el = container || this._sqlRes
        if (!rows?.length) {
            el.innerHTML = `<div class="results-header"><div class="results-info">Returned <strong>0 rows</strong>${ms ? ` in ${ms}ms` : ''}</div></div>
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
        el.innerHTML = h
    }

    // ── Admin Tab ────────────────────────────────────────────────
    _initAdminTab() {
        if (this._adminInited) return
        this._adminInited = true

        // Sub-tab switching
        document.querySelectorAll('.admin-tab-btn').forEach(btn =>
            btn.addEventListener('click', () => this._switchAdminSection(btn.dataset.section))
        )

        // Load overview on first open
        this._loadAdminStats()

        // Scraper logs
        document.getElementById('refresh-scraper-logs')?.addEventListener('click', () => this._loadScraperLogs())
        document.getElementById('scraper-status-filter')?.addEventListener('change', () => this._loadScraperLogs())

        // Audit logs
        document.getElementById('refresh-audit-logs')?.addEventListener('click', () => this._loadAuditLogs())
        document.getElementById('audit-severity-filter')?.addEventListener('change', () => this._loadAuditLogs())

        // Users
        document.getElementById('create-user-btn')?.addEventListener('click', () => {
            const form = document.getElementById('create-user-form')
            if (form) form.style.display = form.style.display === 'none' ? '' : 'none'
        })
        document.getElementById('cancel-create-user')?.addEventListener('click', () => {
            const form = document.getElementById('create-user-form')
            if (form) form.style.display = 'none'
        })
        document.getElementById('submit-create-user')?.addEventListener('click', () => this._createUser())

        // Admin SQL
        const adminEd  = document.getElementById('admin-sql-editor')
        const adminLns = document.getElementById('admin-line-numbers')
        adminEd?.addEventListener('input', () => {
            const n = adminEd.value.split('\n').length
            if (adminLns) adminLns.innerHTML = Array.from({ length: n }, (_, i) => i + 1).join('\n')
        })
        adminEd?.addEventListener('scroll', () => { if (adminLns) adminLns.scrollTop = adminEd.scrollTop })
        adminEd?.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this._runAdminSQL() } })
        document.getElementById('run-admin-sql')?.addEventListener('click', () => this._runAdminSQL())
        document.getElementById('clear-admin-sql')?.addEventListener('click', () => {
            if (adminEd) adminEd.value = ''
            if (adminLns) adminLns.innerHTML = '1'
            const res = document.getElementById('admin-sql-results')
            if (res) res.innerHTML = ''
        })

        // Cache
        document.getElementById('refresh-cache')?.addEventListener('click', () => this._loadCacheEntries())

        // Data management
        document.getElementById('trigger-scrape-btn')?.addEventListener('click', () => this._triggerScrape())
        document.getElementById('trigger-research-btn')?.addEventListener('click', () => this._triggerResearch())
    }

    _switchAdminSection(section) {
        document.querySelectorAll('.admin-tab-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.section === section)
        )
        document.querySelectorAll('.admin-section').forEach(s =>
            s.classList.toggle('active', s.id === `admin-section-${section}`)
        )
        // Lazy-load sections
        if (section === 'scraper-logs')  this._loadScraperLogs()
        if (section === 'audit-logs')    this._loadAuditLogs()
        if (section === 'users')         this._loadAdminUsers()
        if (section === 'cache')         this._loadCacheEntries()
    }

    async _loadAdminStats() {
        try {
            const res  = await this._fetch('/api/admin/stats')
            const data = await res.json()
            if (!data.success) return
            const s = data.stats
            const el = id => document.getElementById(id)
            if (el('stat-dp'))       el('stat-dp').textContent       = s.data_points?.toLocaleString() || '0'
            if (el('stat-entities')) el('stat-entities').textContent = s.entities?.toLocaleString() || '0'
            if (el('stat-news'))     el('stat-news').textContent     = s.news_articles?.toLocaleString() || '0'
            if (el('stat-cache'))    el('stat-cache').textContent    = s.query_cache?.total || '0'
            if (el('stat-hits'))     el('stat-hits').textContent     = s.query_cache?.total_hits || '0'
            if (el('stat-users'))    el('stat-users').textContent    = s.users?.total || '0'

            const domainGrid = document.getElementById('admin-domain-grid')
            if (domainGrid && data.domain_breakdown?.length) {
                domainGrid.innerHTML = data.domain_breakdown.map(d =>
                    `<div class="domain-chip"><span class="domain-name">${this._esc(d.domain)}</span><span class="domain-count">${d.n.toLocaleString()}</span></div>`
                ).join('')
            }
        } catch { /**/ }
    }

    async _loadScraperLogs() {
        const container = document.getElementById('scraper-logs-table')
        if (!container) return
        const status = document.getElementById('scraper-status-filter')?.value || ''
        try {
            const url = `/api/admin/logs/scraper?limit=100${status ? `&status=${status}` : ''}`
            const res  = await this._fetch(url)
            const data = await res.json()
            if (!data.success) { container.innerHTML = '<p class="admin-empty">Failed to load logs.</p>'; return }
            if (!data.logs?.length) { container.innerHTML = '<p class="admin-empty">No scraper logs yet.</p>'; return }
            container.innerHTML = this._buildTable(data.logs, ['source','status','items_scraped','error_msg','started_at','finished_at'])
        } catch { container.innerHTML = '<p class="admin-empty">Error loading logs.</p>' }
    }

    async _loadAuditLogs() {
        const container = document.getElementById('audit-logs-table')
        if (!container) return
        const severity = document.getElementById('audit-severity-filter')?.value || ''
        try {
            const url = `/api/admin/logs/audit?limit=100${severity ? `&severity=${severity}` : ''}`
            const res  = await this._fetch(url)
            const data = await res.json()
            if (!data.success) { container.innerHTML = '<p class="admin-empty">Failed to load audit logs.</p>'; return }
            if (!data.logs?.length) { container.innerHTML = '<p class="admin-empty">No audit logs yet.</p>'; return }
            container.innerHTML = this._buildTable(data.logs, ['email','action','severity','ip','created_at'])
        } catch { container.innerHTML = '<p class="admin-empty">Error loading audit logs.</p>' }
    }

    async _loadAdminUsers() {
        const container = document.getElementById('users-table')
        if (!container) return
        try {
            const res  = await this._fetch('/api/admin/users')
            const data = await res.json()
            if (!data.success || !data.users?.length) { container.innerHTML = '<p class="admin-empty">No users found.</p>'; return }
            let h = `<div class="results-table-wrapper"><table class="results-table"><thead><tr>
                <th>Email</th><th>Name</th><th>Role</th><th>Active</th><th>Last Login</th><th>Actions</th>
            </tr></thead><tbody>`
            data.users.forEach(u => {
                h += `<tr>
                    <td>${this._esc(u.email)}</td>
                    <td>${this._esc(u.full_name || '')}</td>
                    <td><span class="role-badge role-${this._esc(u.role)}">${this._esc(u.role)}</span></td>
                    <td>${u.is_active ? '✓' : '✗'}</td>
                    <td>${u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}</td>
                    <td class="admin-user-actions">
                        <button class="btn-xs" onclick="window._tm._toggleUserRole(${u.id}, '${this._esc(u.role)}')">Toggle Role</button>
                        <button class="btn-xs btn-xs-warn" onclick="window._tm._toggleUserActive(${u.id}, ${u.is_active})">
                            ${u.is_active ? 'Disable' : 'Enable'}
                        </button>
                    </td>
                </tr>`
            })
            h += '</tbody></table></div>'
            container.innerHTML = h
        } catch { container.innerHTML = '<p class="admin-empty">Error loading users.</p>' }
    }

    async _createUser() {
        const email    = document.getElementById('new-user-email')?.value.trim()
        const password = document.getElementById('new-user-password')?.value
        const name     = document.getElementById('new-user-name')?.value.trim()
        const role     = document.getElementById('new-user-role')?.value || 'user'
        if (!email || !password) { alert('Email and password are required.'); return }
        try {
            const res  = await this._fetch('/api/admin/users', { method: 'POST', body: JSON.stringify({ email, password, full_name: name, role }) })
            const data = await res.json()
            if (data.success) {
                document.getElementById('create-user-form').style.display = 'none'
                this._loadAdminUsers()
            } else {
                alert(data.error || 'Failed to create user.')
            }
        } catch { alert('Error creating user.') }
    }

    async _toggleUserRole(id, currentRole) {
        const newRole = currentRole === 'admin' ? 'user' : 'admin'
        if (!confirm(`Change role to "${newRole}"?`)) return
        try {
            await this._fetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) })
            this._loadAdminUsers()
        } catch { alert('Error updating role.') }
    }

    async _toggleUserActive(id, currentActive) {
        const msg = currentActive ? 'Disable this user?' : 'Enable this user?'
        if (!confirm(msg)) return
        try {
            await this._fetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !currentActive }) })
            this._loadAdminUsers()
        } catch { alert('Error updating user.') }
    }

    async _runAdminSQL() {
        const sql = document.getElementById('admin-sql-editor')?.value.trim()
        if (!sql) return
        const btn = document.getElementById('run-admin-sql')
        const res_el = document.getElementById('admin-sql-results')
        if (btn) { btn.disabled = true; btn.textContent = 'Running…' }
        try {
            const res  = await this._fetch('/api/admin/sql/public', { method: 'POST', body: JSON.stringify({ sql }) })
            const data = await res.json()
            if (data.success) {
                this._showSQLResults(data.results, data.executionTime, res_el)
            } else {
                if (res_el) res_el.innerHTML = `<div class="error-message"><strong>Error:</strong><br>${this._esc(data.error)}</div>`
            }
        } catch (err) {
            if (res_el && err.message !== 'Unauthorized') res_el.innerHTML = `<div class="error-message">${this._esc(err.message)}</div>`
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Run` }
        }
    }

    async _loadCacheEntries() {
        const container = document.getElementById('cache-table')
        if (!container) return
        try {
            const res  = await this._fetch('/api/admin/cache')
            const data = await res.json()
            if (!data.success || !data.cache?.length) { container.innerHTML = '<p class="admin-empty">No cached queries yet.</p>'; return }
            let h = `<div class="results-table-wrapper"><table class="results-table"><thead><tr>
                <th>Query</th><th>Hits</th><th>Researched</th><th>Domain</th><th>Results</th><th>Last Hit</th><th></th>
            </tr></thead><tbody>`
            data.cache.forEach(c => {
                h += `<tr>
                    <td title="${this._esc(c.original_query)}">${this._esc((c.original_query || '').slice(0, 60))}</td>
                    <td>${c.hit_count}</td>
                    <td>${c.researched ? '✓' : ''}</td>
                    <td>${this._esc(c.data_domain || '')}</td>
                    <td>${c.result_count}</td>
                    <td>${c.last_hit_at ? new Date(c.last_hit_at).toLocaleDateString() : '—'}</td>
                    <td><button class="btn-xs btn-xs-warn" onclick="window._tm._deleteCacheEntry(${c.id})">Delete</button></td>
                </tr>`
            })
            h += '</tbody></table></div>'
            container.innerHTML = h
        } catch { container.innerHTML = '<p class="admin-empty">Error loading cache.</p>' }
    }

    async _deleteCacheEntry(id) {
        if (!confirm('Delete this cache entry?')) return
        try {
            await this._fetch(`/api/admin/cache/${id}`, { method: 'DELETE' })
            this._loadCacheEntries()
        } catch { alert('Error deleting cache entry.') }
    }

    async _triggerScrape() {
        const btn = document.getElementById('trigger-scrape-btn')
        const res_el = document.getElementById('scrape-result')
        if (btn) { btn.disabled = true; btn.textContent = 'Running…' }
        if (res_el) res_el.textContent = ''
        try {
            const res  = await this._fetch('/api/admin/scrape', { method: 'POST' })
            const data = await res.json()
            if (res_el) res_el.textContent = data.success
                ? `Done: ${data.result?.news_new ?? 0} news, ${data.result?.stats_new ?? 0} stats`
                : `Error: ${data.error}`
        } catch (e) {
            if (res_el) res_el.textContent = `Error: ${e.message}`
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Run Scraper' }
        }
    }

    async _triggerResearch() {
        const question = document.getElementById('research-topic-input')?.value.trim()
        if (!question) { alert('Enter a topic to research.'); return }
        const btn = document.getElementById('trigger-research-btn')
        const res_el = document.getElementById('research-result')
        if (btn) { btn.disabled = true; btn.textContent = 'Researching…' }
        if (res_el) res_el.textContent = ''
        try {
            const res  = await this._fetch('/api/admin/research', { method: 'POST', body: JSON.stringify({ question }) })
            const data = await res.json()
            if (res_el) res_el.textContent = data.success
                ? `Stored ${data.rowsFound} data points (domain: ${data.domain})`
                : `No data found: ${data.message || ''}`
        } catch (e) {
            if (res_el) res_el.textContent = `Error: ${e.message}`
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Research' }
        }
    }

    // ── Utility: generic table builder ───────────────────────────
    _buildTable(rows, cols) {
        if (!rows?.length) return '<p class="admin-empty">No results.</p>'
        const useCols = cols || Object.keys(rows[0])
        let h = `<div class="results-table-wrapper"><table class="results-table"><thead><tr>
            ${useCols.map(c => `<th>${this._esc(c)}</th>`).join('')}</tr></thead><tbody>`
        rows.forEach(row => {
            h += '<tr>' + useCols.map(c => `<td>${this._esc(String(row[c] ?? ''))}</td>`).join('') + '</tr>'
        })
        h += '</tbody></table></div>'
        return h
    }

    _esc(text) {
        const d = document.createElement('div')
        d.textContent = String(text ?? '')
        return d.innerHTML
    }
}

// Expose instance globally for inline onclick handlers in admin tab
document.addEventListener('DOMContentLoaded', () => { window._tm = new TabManager() })

// Compat shims for SecurityManager
TabManager.prototype.authedFetch    = function(url, opts) { return this._fetch(url, opts) }
TabManager.prototype.getAuthHeaders = function() { return this._headers() }
TabManager.prototype.escapeHtml     = function(t) { return this._esc(t) }
