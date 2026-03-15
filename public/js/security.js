/**
 * Armenian OSINT — Security Dashboard
 * Handles: Audit log, IP rules, 2FA setup, Domain/Breach/Exposure intel, Anomaly alerts
 */
class SecurityManager {
    constructor(tabManager) {
        this.tm = tabManager
        this.activeSection = 'overview'
    }

    render() {
        const container = document.getElementById('security-container')
        if (!container) return
        container.innerHTML = `
            <div class="sec-layout">
                <nav class="sec-nav">
                    <button class="sec-nav-btn active" data-sec="overview">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        Overview
                    </button>
                    <button class="sec-nav-btn" data-sec="audit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        Audit Log
                    </button>
                    <button class="sec-nav-btn" data-sec="intel">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Threat Intel
                    </button>
                    <button class="sec-nav-btn" data-sec="iprules">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        IP Rules
                    </button>
                    <button class="sec-nav-btn" data-sec="totp">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                        Two-Factor Auth
                    </button>
                </nav>
                <div class="sec-content" id="sec-content">
                    <div class="sec-loading">Loading…</div>
                </div>
            </div>`

        container.querySelectorAll('.sec-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.sec-nav-btn').forEach(b => b.classList.remove('active'))
                btn.classList.add('active')
                this.activeSection = btn.dataset.sec
                this.loadSection(btn.dataset.sec)
            })
        })

        this.loadSection('overview')
    }

    async loadSection(section) {
        const content = document.getElementById('sec-content')
        if (!content) return
        content.innerHTML = '<div class="sec-loading">Loading…</div>'
        switch (section) {
            case 'overview': await this.renderOverview(content); break
            case 'audit':    await this.renderAuditLog(content); break
            case 'intel':    this.renderIntel(content); break
            case 'iprules':  await this.renderIPRules(content); break
            case 'totp':     await this.renderTOTP(content); break
        }
    }

    // ── OVERVIEW ────────────────────────────────────────────
    async renderOverview(el) {
        let anomalies = { events: [], signals: { brute_force: [], scraper_failures: [], sqli_attempts: [] } }
        try {
            const res = await this.tm.authedFetch('/api/security/anomalies')
            const data = await res.json()
            if (data.success) anomalies = data
        } catch { }

        const { events, signals } = anomalies
        const unresolved = events.filter(e => !e.resolved)

        el.innerHTML = `
            <div class="sec-overview">
                <h2 class="sec-title">Security Overview</h2>
                <div class="sec-stats-grid">
                    <div class="sec-stat ${unresolved.length > 0 ? 'sec-stat-warn' : 'sec-stat-ok'}">
                        <div class="sec-stat-val">${unresolved.length}</div>
                        <div class="sec-stat-label">Active Alerts</div>
                    </div>
                    <div class="sec-stat ${signals.brute_force.length > 0 ? 'sec-stat-danger' : 'sec-stat-ok'}">
                        <div class="sec-stat-val">${signals.brute_force.length}</div>
                        <div class="sec-stat-label">Brute Force IPs</div>
                    </div>
                    <div class="sec-stat ${signals.sqli_attempts.length > 0 ? 'sec-stat-danger' : 'sec-stat-ok'}">
                        <div class="sec-stat-val">${signals.sqli_attempts.length}</div>
                        <div class="sec-stat-label">SQLi Attempts (1h)</div>
                    </div>
                    <div class="sec-stat ${signals.scraper_failures.length > 0 ? 'sec-stat-warn' : 'sec-stat-ok'}">
                        <div class="sec-stat-val">${signals.scraper_failures.length}</div>
                        <div class="sec-stat-label">Scraper Failures</div>
                    </div>
                </div>

                <div class="sec-section">
                    <h3 class="sec-subtitle">Active Anomaly Events</h3>
                    ${unresolved.length === 0
                        ? '<p class="sec-empty">No active anomalies — system is healthy ✓</p>'
                        : unresolved.map(e => `
                            <div class="anomaly-card sev-${e.severity}">
                                <div class="anomaly-header">
                                    <span class="anomaly-type">${e.event_type.replace(/_/g, ' ')}</span>
                                    <span class="sev-badge sev-${e.severity}">${e.severity}</span>
                                </div>
                                <div class="anomaly-target">${this.esc(e.target || '')}</div>
                                <div class="anomaly-time">${new Date(e.created_at).toLocaleString()}</div>
                                <button class="resolve-btn" data-id="${e.id}">Mark Resolved</button>
                            </div>`).join('')
                    }
                </div>

                ${signals.scraper_failures.length > 0 ? `
                <div class="sec-section">
                    <h3 class="sec-subtitle">Recent Scraper Failures (24h)</h3>
                    ${signals.scraper_failures.map(f => `
                        <div class="alert-row">
                            <span class="alert-source">${this.esc(f.source_name)}</span>
                            <span class="alert-msg">${this.esc(f.error_message || 'Unknown error')}</span>
                            <span class="alert-time">${new Date(f.created_at).toLocaleString()}</span>
                        </div>`).join('')}
                </div>` : ''}
            </div>`

        el.querySelectorAll('.resolve-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await this.tm.authedFetch(`/api/security/anomalies/${btn.dataset.id}/resolve`, { method: 'POST' })
                this.loadSection('overview')
            })
        })
    }

    // ── AUDIT LOG ────────────────────────────────────────────
    async renderAuditLog(el) {
        el.innerHTML = `
            <div class="sec-audit">
                <div class="sec-audit-toolbar">
                    <h2 class="sec-title">Audit Log</h2>
                    <div class="audit-filters">
                        <select id="audit-action-filter" class="graph-select">
                            <option value="">All actions</option>
                            ${['login','failed_login','register','query','sql_exec','2fa_enabled','2fa_disabled','domain_check','breach_check','sqli_attempt','totp_failed'].map(a => `<option value="${a}">${a}</option>`).join('')}
                        </select>
                        <select id="audit-severity-filter" class="graph-select">
                            <option value="">All severities</option>
                            <option value="info">info</option>
                            <option value="warn">warn</option>
                            <option value="critical">critical</option>
                        </select>
                        <button id="audit-load-btn" class="btn-primary" style="font-size:12px;padding:6px 12px;">Load</button>
                    </div>
                </div>
                <div id="audit-table-wrap">
                    <p class="sec-empty">Select filters and click Load.</p>
                </div>
            </div>`

        el.querySelector('#audit-load-btn').addEventListener('click', () => this.loadAuditData(el))
        this.loadAuditData(el)
    }

    async loadAuditData(el) {
        const action = el.querySelector('#audit-action-filter').value
        const severity = el.querySelector('#audit-severity-filter').value
        let url = '/api/security/audit-log?limit=150'
        if (action) url += `&action=${action}`
        if (severity) url += `&severity=${severity}`
        const wrap = el.querySelector('#audit-table-wrap')
        wrap.innerHTML = '<p class="sec-empty">Loading…</p>'
        try {
            const res = await this.tm.authedFetch(url)
            const data = await res.json()
            if (!data.success) { wrap.innerHTML = `<p class="sec-empty">${data.error || 'Failed to load'}</p>`; return }
            if (!data.logs.length) { wrap.innerHTML = '<p class="sec-empty">No log entries found.</p>'; return }
            wrap.innerHTML = `
                <div class="audit-table-scroll">
                    <table class="sec-table">
                        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>IP</th><th>Severity</th><th>Details</th></tr></thead>
                        <tbody>${data.logs.map(l => `
                            <tr class="sev-row-${l.severity}">
                                <td class="td-time">${new Date(l.created_at).toLocaleString()}</td>
                                <td>${this.esc(l.email || String(l.user_id || '-'))}</td>
                                <td><code class="action-badge">${this.esc(l.action)}</code></td>
                                <td class="td-ip">${this.esc(l.ip || '-')}</td>
                                <td><span class="sev-badge sev-${l.severity}">${l.severity}</span></td>
                                <td class="td-meta">${l.metadata ? this.esc(l.metadata.slice(0, 80)) : '-'}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`
        } catch { wrap.innerHTML = '<p class="sec-empty">Admin access required.</p>' }
    }

    // ── THREAT INTEL ─────────────────────────────────────────
    renderIntel(el) {
        el.innerHTML = `
            <div class="sec-intel">
                <h2 class="sec-title">Threat Intelligence</h2>

                <div class="intel-card">
                    <h3 class="sec-subtitle">Domain Reputation <span class="badge-vt">VirusTotal</span></h3>
                    <p class="sec-desc">Check if a domain is flagged as malicious by 90+ security engines.</p>
                    <div class="intel-input-row">
                        <input id="vt-domain-input" class="intel-input" placeholder="e.g. example.com" type="text">
                        <button id="vt-check-btn" class="btn-primary" style="font-size:12px">Check Domain</button>
                    </div>
                    <div id="vt-result"></div>
                </div>

                <div class="intel-card">
                    <h3 class="sec-subtitle">Data Breach Check <span class="badge-hibp">HIBP</span></h3>
                    <p class="sec-desc">Check if an email address appears in known data breaches.</p>
                    <div class="intel-input-row">
                        <input id="hibp-email-input" class="intel-input" placeholder="user@company.am" type="email">
                        <button id="hibp-check-btn" class="btn-primary" style="font-size:12px">Check Email</button>
                    </div>
                    <div id="hibp-result"></div>
                </div>

                <div class="intel-card">
                    <h3 class="sec-subtitle">Online Exposure Score</h3>
                    <p class="sec-desc">Combined risk score: breaches + paste exposure + domain reputation.</p>
                    <div class="intel-input-row">
                        <input id="exp-email-input" class="intel-input" placeholder="user@company.am" type="email">
                        <button id="exp-check-btn" class="btn-primary" style="font-size:12px">Scan Exposure</button>
                    </div>
                    <div id="exp-result"></div>
                </div>
            </div>`

        el.querySelector('#vt-check-btn').addEventListener('click', async () => {
            const domain = el.querySelector('#vt-domain-input').value.trim()
            if (!domain) return
            const res = document.getElementById('vt-result')
            res.innerHTML = '<div class="intel-loading">Checking…</div>'
            try {
                const r = await this.tm.authedFetch(`/api/security/intel/domain/${encodeURIComponent(domain)}`)
                const d = await r.json()
                if (!d.success) { res.innerHTML = `<div class="intel-error">${this.esc(d.error)}</div>`; return }
                const { data: vt } = d
                const level = vt.malicious > 5 ? 'critical' : vt.malicious > 0 ? 'high' : vt.suspicious > 0 ? 'medium' : 'low'
                res.innerHTML = `
                    <div class="intel-result">
                        <div class="risk-score-wrap">
                            <div class="risk-score sev-${level}">${vt.risk_score}<span style="font-size:14px">/100</span></div>
                            <div>
                                <div class="risk-level sev-${level}">${level.toUpperCase()} RISK</div>
                                <div class="risk-domain">${this.esc(vt.domain)}</div>
                            </div>
                        </div>
                        <div class="vt-stats">
                            <span class="vt-stat danger">🔴 Malicious: ${vt.malicious}</span>
                            <span class="vt-stat warn">🟡 Suspicious: ${vt.suspicious}</span>
                            <span class="vt-stat ok">🟢 Harmless: ${vt.harmless}</span>
                            <span class="vt-stat">⚪ Undetected: ${vt.undetected}</span>
                        </div>
                        ${Object.keys(vt.categories).length > 0 ? `<div class="vt-cats">Categories: ${Object.values(vt.categories).map(v => `<span class="cat-tag">${this.esc(v)}</span>`).join('')}</div>` : ''}
                        ${d.cached ? '<div class="cache-note">Cached result (≤1h)</div>' : ''}
                    </div>`
            } catch { res.innerHTML = '<div class="intel-error">Check failed. VirusTotal API key may not be configured.</div>' }
        })

        el.querySelector('#hibp-check-btn').addEventListener('click', async () => {
            const email = el.querySelector('#hibp-email-input').value.trim()
            if (!email) return
            const res = document.getElementById('hibp-result')
            res.innerHTML = '<div class="intel-loading">Checking…</div>'
            try {
                const r = await this.tm.authedFetch(`/api/security/intel/breach/${encodeURIComponent(email)}`)
                const d = await r.json()
                if (!d.success) { res.innerHTML = `<div class="intel-error">${this.esc(d.error)}</div>`; return }
                const { data: hibp } = d
                res.innerHTML = `
                    <div class="intel-result">
                        <div class="breach-count ${hibp.breach_count > 0 ? 'breach-found' : 'breach-clean'}">
                            ${hibp.breach_count > 0
                                ? `⚠️ Found in ${hibp.breach_count} breach${hibp.breach_count !== 1 ? 'es' : ''}`
                                : '✅ No breaches found'}
                        </div>
                        ${hibp.breaches?.length > 0 ? `
                        <div class="breach-list">
                            ${hibp.breaches.map(b => `
                                <div class="breach-item">
                                    <strong>${this.esc(b.name)}</strong>
                                    <span class="breach-domain">${this.esc(b.domain)}</span>
                                    <span class="breach-date">${b.date || ''}</span>
                                    <div class="breach-classes">${(b.classes || []).slice(0,5).map(c => `<span class="cat-tag">${this.esc(c)}</span>`).join('')}</div>
                                </div>`).join('')}
                        </div>` : ''}
                    </div>`
            } catch { res.innerHTML = '<div class="intel-error">Check failed. HIBP API key may not be configured.</div>' }
        })

        el.querySelector('#exp-check-btn').addEventListener('click', async () => {
            const email = el.querySelector('#exp-email-input').value.trim()
            if (!email) return
            const res = document.getElementById('exp-result')
            res.innerHTML = '<div class="intel-loading">Scanning…</div>'
            try {
                const r = await this.tm.authedFetch(`/api/security/intel/exposure/${encodeURIComponent(email)}`)
                const d = await r.json()
                if (!d.success) { res.innerHTML = `<div class="intel-error">${this.esc(d.error)}</div>`; return }
                const { data: exp } = d
                const levelColor = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed' }
                res.innerHTML = `
                    <div class="intel-result">
                        <div class="exposure-meter">
                            <div class="exp-bar-wrap">
                                <div class="exp-bar" style="width:${exp.risk_score}%;background:${levelColor[exp.risk_level]}"></div>
                            </div>
                            <div class="exp-score-row">
                                <strong style="color:${levelColor[exp.risk_level]}">${exp.risk_level.toUpperCase()} RISK</strong>
                                <span>${exp.risk_score}/100</span>
                            </div>
                        </div>
                        <div class="exp-signals">
                            <div class="exp-signal">📧 Breaches: <strong>${exp.breach_count}</strong></div>
                            <div class="exp-signal">📋 Paste sites: <strong>${exp.paste_count}</strong></div>
                            <div class="exp-signal">🌐 Domain malicious hits: <strong>${exp.domain_malicious}</strong></div>
                        </div>
                    </div>`
            } catch { res.innerHTML = '<div class="intel-error">Exposure scan failed.</div>' }
        })
    }

    // ── IP RULES ─────────────────────────────────────────────
    async renderIPRules(el) {
        el.innerHTML = `
            <div class="sec-iprules">
                <h2 class="sec-title">IP Allowlist / Denylist</h2>
                <p class="sec-desc">Control access by IP address or CIDR range. Deny rules take priority over allow rules.</p>

                <div class="iprules-form">
                    <input id="ip-input" class="intel-input" placeholder="1.2.3.4 or 192.168.0.0/24" style="flex:2">
                    <select id="ip-type" class="graph-select">
                        <option value="deny">Deny</option>
                        <option value="allow">Allow</option>
                    </select>
                    <input id="ip-note" class="intel-input" placeholder="Reason (optional)" style="flex:2">
                    <button id="ip-add-btn" class="btn-primary" style="font-size:12px">Add Rule</button>
                </div>
                <div id="ip-msg"></div>

                <div id="ip-rules-table"><p class="sec-empty">Loading rules…</p></div>
            </div>`

        el.querySelector('#ip-add-btn').addEventListener('click', async () => {
            const ip_or_cidr = el.querySelector('#ip-input').value.trim()
            const rule_type = el.querySelector('#ip-type').value
            const note = el.querySelector('#ip-note').value.trim()
            if (!ip_or_cidr) return
            const msg = el.querySelector('#ip-msg')
            try {
                const res = await this.tm.authedFetch('/api/security/ip-rules', {
                    method: 'POST',
                    body: JSON.stringify({ ip_or_cidr, rule_type, note })
                })
                const d = await res.json()
                msg.innerHTML = d.success
                    ? '<span style="color:#10b981">Rule added successfully.</span>'
                    : `<span style="color:#ef4444">${this.esc(d.error)}</span>`
                if (d.success) { el.querySelector('#ip-input').value = ''; el.querySelector('#ip-note').value = '' }
                this.loadIPRulesTable(el)
            } catch { msg.innerHTML = '<span style="color:#ef4444">Admin access required.</span>' }
        })

        this.loadIPRulesTable(el)
    }

    async loadIPRulesTable(el) {
        const wrap = el.querySelector('#ip-rules-table')
        try {
            const res = await this.tm.authedFetch('/api/security/ip-rules')
            const data = await res.json()
            if (!data.success || !data.rules.length) { wrap.innerHTML = '<p class="sec-empty">No IP rules configured.</p>'; return }
            wrap.innerHTML = `
                <table class="sec-table" style="margin-top:12px">
                    <thead><tr><th>IP / CIDR</th><th>Type</th><th>Note</th><th>Created</th><th></th></tr></thead>
                    <tbody>${data.rules.map(r => `
                        <tr>
                            <td><code>${this.esc(r.ip_or_cidr)}</code></td>
                            <td><span class="rule-badge rule-${r.rule_type}">${r.rule_type}</span></td>
                            <td>${this.esc(r.note || '-')}</td>
                            <td class="td-time">${new Date(r.created_at).toLocaleDateString()}</td>
                            <td><button class="del-rule-btn" data-id="${r.id}" title="Delete">✕</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>`
            wrap.querySelectorAll('.del-rule-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await this.tm.authedFetch(`/api/security/ip-rules/${btn.dataset.id}`, { method: 'DELETE' })
                    this.loadIPRulesTable(el)
                })
            })
        } catch { wrap.innerHTML = '<p class="sec-empty">Admin access required to manage IP rules.</p>' }
    }

    // ── 2FA SETUP ────────────────────────────────────────────
    async renderTOTP(el) {
        let totpEnabled = false
        try {
            const res = await this.tm.authedFetch('/api/auth/me')
            const data = await res.json()
            totpEnabled = data.user?.totp_enabled ?? false
        } catch { }

        el.innerHTML = `
            <div class="sec-totp">
                <h2 class="sec-title">Two-Factor Authentication</h2>
                <p class="sec-desc">Protect your account with a time-based one-time password (TOTP) using any authenticator app.</p>

                <div class="totp-status-card ${totpEnabled ? 'totp-on' : 'totp-off'}">
                    <div class="totp-status-icon">${totpEnabled ? '🔒' : '🔓'}</div>
                    <div>
                        <div class="totp-status-text">${totpEnabled ? '2FA is ENABLED' : '2FA is DISABLED'}</div>
                        <div class="totp-status-sub">${totpEnabled ? 'Your account is protected with TOTP.' : 'Enable 2FA to add an extra layer of security.'}</div>
                    </div>
                </div>

                ${totpEnabled ? `
                <div class="totp-disable-section">
                    <p class="sec-desc">Enter your current authenticator code to disable 2FA:</p>
                    <div class="intel-input-row">
                        <input id="disable-totp-code" class="intel-input" placeholder="000000" maxlength="6" style="letter-spacing:0.15em;text-align:center;font-size:18px;max-width:160px">
                        <button id="disable-totp-btn" class="btn-danger" style="font-size:12px">Disable 2FA</button>
                    </div>
                    <div id="totp-msg"></div>
                </div>` : `
                <div id="totp-setup-section">
                    <button id="start-totp-btn" class="btn-primary" style="margin-top:8px">Generate 2FA Secret</button>
                    <div id="totp-qr-section" style="display:none">
                        <div class="totp-steps">
                            <div class="totp-step"><span class="step-num">1</span> Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</div>
                            <div style="text-align:center;margin:16px 0">
                                <img id="totp-qr-img" style="border-radius:8px;border:4px solid white;box-shadow:0 2px 12px rgba(0,0,0,.1)" alt="QR Code">
                                <div class="totp-secret-wrap">Manual key: <code id="totp-secret-text"></code></div>
                            </div>
                            <div class="totp-step"><span class="step-num">2</span> Enter the 6-digit code to confirm and enable 2FA</div>
                            <div class="intel-input-row" style="justify-content:center;margin-top:8px">
                                <input id="enable-totp-code" class="intel-input" placeholder="000000" maxlength="6" style="letter-spacing:0.15em;text-align:center;font-size:18px;max-width:160px">
                                <button id="enable-totp-btn" class="btn-primary" style="font-size:12px">Enable 2FA</button>
                            </div>
                        </div>
                    </div>
                    <div id="totp-msg"></div>
                </div>`}

                <div class="totp-apps">
                    <p class="sec-desc" style="margin-top:20px">Compatible authenticator apps:</p>
                    <div class="app-list">
                        <span class="app-chip">Google Authenticator</span>
                        <span class="app-chip">Authy</span>
                        <span class="app-chip">Microsoft Authenticator</span>
                        <span class="app-chip">1Password</span>
                        <span class="app-chip">Bitwarden</span>
                    </div>
                </div>
            </div>`

        if (!totpEnabled) {
            el.querySelector('#start-totp-btn').addEventListener('click', async () => {
                try {
                    const res = await this.tm.authedFetch('/api/auth/2fa/setup', { method: 'POST' })
                    const data = await res.json()
                    if (!data.success) throw new Error(data.error)
                    el.querySelector('#totp-qr-img').src = data.qr
                    el.querySelector('#totp-secret-text').textContent = data.secret
                    el.querySelector('#totp-qr-section').style.display = ''
                    el.querySelector('#start-totp-btn').style.display = 'none'
                } catch (e) { el.querySelector('#totp-msg').innerHTML = `<span style="color:#ef4444">${e.message}</span>` }
            })

            el.querySelector('#enable-totp-btn').addEventListener('click', async () => {
                const code = el.querySelector('#enable-totp-code').value.trim()
                if (code.length !== 6) return
                try {
                    const res = await this.tm.authedFetch('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) })
                    const data = await res.json()
                    el.querySelector('#totp-msg').innerHTML = data.success
                        ? '<span style="color:#10b981">✓ 2FA enabled! Your account is now protected.</span>'
                        : `<span style="color:#ef4444">${data.error}</span>`
                    if (data.success) setTimeout(() => this.loadSection('totp'), 1500)
                } catch { }
            })
        } else {
            el.querySelector('#disable-totp-btn').addEventListener('click', async () => {
                const code = el.querySelector('#disable-totp-code').value.trim()
                if (code.length !== 6) return
                try {
                    const res = await this.tm.authedFetch('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) })
                    const data = await res.json()
                    el.querySelector('#totp-msg').innerHTML = data.success
                        ? '<span style="color:#10b981">2FA has been disabled.</span>'
                        : `<span style="color:#ef4444">${data.error}</span>`
                    if (data.success) setTimeout(() => this.loadSection('totp'), 1500)
                } catch { }
            })
        }
    }

    esc(str) {
        const d = document.createElement('div')
        d.textContent = String(str ?? '')
        return d.innerHTML
    }
}
