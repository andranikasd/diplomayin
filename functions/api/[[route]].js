/**
 * Armenian OSINT Analytics — Cloudflare Pages Functions
 * All /api/* routes handled by Hono running on CF Workers runtime
 * Database: D1 (SQLite)  Auth: Web Crypto (PBKDF2 + HMAC-SHA256 JWT)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono().basePath('/api')
app.use('*', cors({ origin: '*' }))

// ─────────────────────────────────────────────────────────────
// WEB CRYPTO HELPERS
// ─────────────────────────────────────────────────────────────

function b64url(input) {
    const str = input instanceof ArrayBuffer
        ? String.fromCharCode(...new Uint8Array(input))
        : JSON.stringify(input)
    return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function fromb64url(str) { return atob(str.replace(/-/g, '+').replace(/_/g, '/')) }

async function hashPassword(password) {
    const enc = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256)
    const hex = u8 => [...u8].map(b => b.toString(16).padStart(2, '0')).join('')
    return `${hex(salt)}:${hex(new Uint8Array(bits))}`
}

async function verifyPassword(password, stored) {
    const [saltHex, hashHex] = stored.split(':')
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256)
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('') === hashHex
}

async function signJWT(payload, secret, expiresInSeconds = 7 * 86400) {
    const header = b64url({ alg: 'HS256', typ: 'JWT' })
    const body = b64url({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds })
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`))
    return `${header}.${body}.${b64url(sig)}`
}

async function verifyJWT(token, secret) {
    const [header, body, sigB64] = token.split('.')
    if (!header || !body || !sigB64) throw new Error('Malformed token')
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const sigBytes = Uint8Array.from(fromb64url(sigB64), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`))
    if (!valid) throw new Error('Invalid signature')
    const payload = JSON.parse(fromb64url(body))
    if (payload.exp < Date.now() / 1000) throw new Error('Token expired')
    return payload
}

async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─────────────────────────────────────────────────────────────
// TOTP — RFC6238 (HMAC-SHA1, 30s window, 6 digits)
// ─────────────────────────────────────────────────────────────

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(str) {
    const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '')
    const bytes = []
    let bits = 0, value = 0
    for (const c of clean) {
        value = (value << 5) | B32.indexOf(c); bits += 5
        if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8 }
    }
    return new Uint8Array(bytes)
}

function base32Encode(bytes) {
    let bits = 0, value = 0, out = ''
    for (const b of bytes) {
        value = (value << 8) | b; bits += 8
        while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31]
    return out
}

async function totpCode(secret, offset = 0) {
    const T = Math.floor(Date.now() / 30000) + offset
    const buf = new ArrayBuffer(8)
    new DataView(buf).setUint32(4, T, false)
    const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf))
    const off = mac[19] & 0xf
    const code = ((mac[off] & 0x7f) << 24 | mac[off + 1] << 16 | mac[off + 2] << 8 | mac[off + 3]) % 1_000_000
    return String(code).padStart(6, '0')
}

async function verifyTOTP(secret, token) {
    for (const d of [-1, 0, 1]) {
        if (await totpCode(secret, d) === token) return true
    }
    return false
}

function totpUri(secret, email, issuer = 'Armenian OSINT') {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

// ─────────────────────────────────────────────────────────────
// SQL INJECTION DETECTION
// ─────────────────────────────────────────────────────────────

const SQLI_PATTERNS = [
    { type: 'tautology',  re: /'\s*or\s*'?1'?\s*=\s*'?1|'\s*or\s+\w+\s*=\s*\w+|\bor\b\s+1\s*=\s*1|\band\b\s+1\s*=\s*1/i },
    { type: 'comment',    re: /--\s*$|\/\*[\s\S]*?\*\//m },
    { type: 'union',      re: /union\s+(all\s+)?select/i },
    { type: 'stacked',    re: /;\s*(select|insert|update|delete|drop|create|alter|exec)/i },
    { type: 'blind_time', re: /sleep\s*\(\s*\d+\s*\)|benchmark\s*\(|waitfor\s+delay|pg_sleep/i },
    { type: 'oob',        re: /load_file\s*\(|into\s+outfile|into\s+dumpfile|xp_cmdshell/i },
    { type: 'encoding',   re: /char\s*\(\s*\d+|0x[0-9a-f]{4,}/i },
]

function detectSQLi(input) {
    const findings = SQLI_PATTERNS.filter(p => p.re.test(input))
    return { isInjection: findings.length > 0, findings: findings.map(f => f.type) }
}

// ─────────────────────────────────────────────────────────────
// IP FILTER (allowlist / denylist with CIDR support)
// ─────────────────────────────────────────────────────────────

function ipToInt(ip) {
    return ip.split('.').reduce((acc, o) => (acc << 8) + (+o), 0) >>> 0
}

function ipInCidr(ip, cidr) {
    if (!cidr.includes('/')) return ip === cidr
    const [base, bits] = cidr.split('/')
    const mask = (~((1 << (32 - +bits)) - 1)) >>> 0
    return (ipToInt(ip) & mask) === (ipToInt(base) & mask)
}

// ─────────────────────────────────────────────────────────────
// AUDIT LOG HELPER
// ─────────────────────────────────────────────────────────────

async function audit(DB, { userId, action, ip, ua, metadata, severity = 'info' }) {
    try {
        await DB.prepare(
            'INSERT INTO audit_log (user_id, action, ip, user_agent, metadata, severity) VALUES (?,?,?,?,?,?)'
        ).bind(userId ?? null, action, ip ?? null, ua ?? null, metadata ? JSON.stringify(metadata) : null, severity).run()
    } catch { /* non-fatal */ }
}

// ─────────────────────────────────────────────────────────────
// RATE LIMITING (sliding window, stored in D1)
// ─────────────────────────────────────────────────────────────

async function checkRateLimit(DB, key, { windowMs = 60_000, max = 60 }) {
    const cutoff = new Date(Date.now() - windowMs).toISOString()
    try {
        await DB.prepare('DELETE FROM rate_limit_log WHERE key = ? AND hit_at < ?').bind(key, cutoff).run()
        const row = await DB.prepare('SELECT COUNT(*) AS n FROM rate_limit_log WHERE key = ?').bind(key).first()
        if ((row?.n ?? 0) >= max) return false
        await DB.prepare('INSERT INTO rate_limit_log (key) VALUES (?)').bind(key).run()
    } catch { /* non-fatal, allow through */ }
    return true
}

// ─────────────────────────────────────────────────────────────
// MIDDLEWARE HELPERS
// ─────────────────────────────────────────────────────────────

function getSecret(env) { return env.JWT_SECRET || 'armenian-osint-change-in-production' }
function getIp(c) { return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown' }
function getUa(c) { return c.req.header('User-Agent') ?? '' }

async function requireAuth(c, next) {
    const auth = c.req.header('Authorization')
    if (!auth?.startsWith('Bearer ')) return c.json({ success: false, error: 'Authentication required' }, 401)
    try {
        const payload = await verifyJWT(auth.slice(7), getSecret(c.env))
        if (payload.temp) return c.json({ success: false, error: 'Complete 2FA first' }, 401)
        c.set('user', payload)
        return next()
    } catch {
        return c.json({ success: false, error: 'Invalid or expired token' }, 401)
    }
}

async function requireAdmin(c, next) {
    return requireAuth(c, async () => {
        if (c.get('user')?.role !== 'admin') return c.json({ success: false, error: 'Admin required' }, 403)
        return next()
    })
}

async function ipFilter(c, next) {
    const ip = getIp(c)
    c.set('clientIp', ip)
    c.set('userAgent', getUa(c))
    try {
        const { results } = await c.env.DB.prepare('SELECT rule_type, ip_or_cidr FROM ip_rules').all()
        const deny = results.filter(r => r.rule_type === 'deny')
        const allow = results.filter(r => r.rule_type === 'allow')
        if (deny.some(r => ipInCidr(ip, r.ip_or_cidr))) {
            return c.json({ success: false, error: 'Access denied' }, 403)
        }
        if (allow.length > 0 && !allow.some(r => ipInCidr(ip, r.ip_or_cidr))) {
            return c.json({ success: false, error: 'Access denied' }, 403)
        }
    } catch { /* table may not exist yet */ }
    return next()
}

app.use('*', ipFilter)

// ─────────────────────────────────────────────────────────────
// NLP → SQL
// ─────────────────────────────────────────────────────────────

function nlpToSQL(question) {
    const q = question.toLowerCase()
    if (q.match(/chart|pie|graph|visual|breakdown|distribution/)) {
        if (q.includes('industri') || q.includes('sector'))
            return "SELECT industry AS label, COUNT(*) AS value FROM companies WHERE industry IS NOT NULL GROUP BY industry ORDER BY value DESC LIMIT 15"
        if (q.includes('news') || q.includes('categor'))
            return "SELECT category AS label, COUNT(*) AS value FROM news_articles WHERE category IS NOT NULL GROUP BY category ORDER BY value DESC LIMIT 10"
        if (q.includes('region') || q.includes('city'))
            return "SELECT region AS label, AVG(value) AS value FROM statistics WHERE region IS NOT NULL GROUP BY region ORDER BY value DESC LIMIT 15"
    }
    if (q.match(/compan|business|firm/)) {
        if (q.match(/top|revenue|biggest|largest/))
            return "SELECT name, industry, revenue_estimate, employee_count, city FROM companies WHERE revenue_estimate IS NOT NULL ORDER BY revenue_estimate DESC LIMIT 10"
        if (q.match(/industri|sector/))
            return "SELECT industry, COUNT(*) AS company_count, AVG(revenue_estimate) AS avg_revenue FROM companies WHERE industry IS NOT NULL GROUP BY industry ORDER BY company_count DESC"
        if (q.match(/employee|staff|size/))
            return "SELECT name, industry, employee_count, city FROM companies WHERE employee_count IS NOT NULL ORDER BY employee_count DESC LIMIT 20"
        if (q.match(/tech|it\b|software/))
            return "SELECT name, website, employee_count, city FROM companies WHERE industry LIKE '%tech%' OR industry LIKE '%IT%' OR industry LIKE '%software%' ORDER BY employee_count DESC LIMIT 20"
        return "SELECT name, industry, city, employee_count, revenue_estimate FROM companies ORDER BY created_at DESC LIMIT 20"
    }
    if (q.match(/news|article|headline/)) {
        const cats = { tech: 'technology', econom: 'economy', politi: 'politics', sport: 'sports', cultur: 'culture', health: 'health' }
        for (const [key, cat] of Object.entries(cats)) {
            if (q.includes(key)) return `SELECT title, summary, source, category, published_date FROM news_articles WHERE category = '${cat}' ORDER BY published_date DESC LIMIT 20`
        }
        return "SELECT title, summary, source, category, published_date FROM news_articles ORDER BY published_date DESC LIMIT 20"
    }
    if (q.match(/statistic|gdp|population|econom|indicator|unemploy|inflation/)) {
        if (q.match(/city|region|yerevan|gyumri/))
            return "SELECT region, indicator, value, unit, period FROM statistics WHERE region IS NOT NULL ORDER BY period DESC LIMIT 30"
        if (q.match(/gdp|gross/))
            return "SELECT indicator, value, unit, period, region FROM statistics WHERE indicator LIKE '%GDP%' ORDER BY period DESC LIMIT 20"
        return "SELECT category, indicator, value, unit, period, region FROM statistics ORDER BY created_at DESC LIMIT 30"
    }
    if (q.match(/social|follower|instagram|facebook/))
        return "SELECT c.name, sm.platform, sm.followers_count, sm.engagement_rate FROM companies c JOIN social_metrics sm ON c.id = sm.company_id ORDER BY sm.followers_count DESC LIMIT 20"
    if (q.match(/trend|market|growth/))
        return "SELECT industry, trend_name, trend_score, description FROM market_trends ORDER BY trend_score DESC LIMIT 20"
    if (q.match(/contact|person|ceo|founder/))
        return "SELECT ct.first_name, ct.last_name, ct.position, c.name AS company FROM contacts ct LEFT JOIN companies c ON ct.company_id = c.id LIMIT 20"
    return `SELECT 'companies' AS table_name, COUNT(*) AS total_rows FROM companies
            UNION ALL SELECT 'news_articles', COUNT(*) FROM news_articles
            UNION ALL SELECT 'statistics', COUNT(*) FROM statistics`
}

function buildResponse(question, results) {
    const n = results.length
    const q = question.toLowerCase()
    if (n === 0) return `No data found for your query. Try asking about companies, news, or statistics.`
    if (q.match(/compan|business/)) return `Found ${n} compan${n === 1 ? 'y' : 'ies'} in the Armenian market database:`
    if (q.match(/news|article/)) return `Here are ${n} recent Armenian news article${n === 1 ? '' : 's'}:`
    if (q.match(/statistic|gdp|population/)) return `Retrieved ${n} statistical indicator${n === 1 ? '' : 's'} from Armenian sources:`
    if (q.match(/trend/)) return `Found ${n} market trend${n === 1 ? '' : 's'} in Armenia:`
    return `Found ${n} result${n === 1 ? '' : 's'} for your query:`
}

function detectChart(results) {
    if (!results || results.length < 2) return null
    const cols = Object.keys(results[0])
    const labelCols = ['label', 'name', 'industry', 'category', 'region', 'platform', 'type', 'table_name']
    const valueCols = ['value', 'count', 'total_rows', 'company_count', 'revenue_estimate', 'followers_count', 'trend_score', 'avg_revenue']
    const labelCol = cols.find(c => labelCols.includes(c))
    const valueCol = cols.find(c => valueCols.includes(c))
    if (!labelCol || !valueCol) return null
    const isPie = results.length <= 10 && cols.length === 2
    return { type: isPie ? 'pie' : 'bar', labelColumn: labelCol, dataColumns: [valueCol] }
}

// ─────────────────────────────────────────────────────────────
// ROUTES — HEALTH
// ─────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ success: true, status: 'healthy', timestamp: new Date().toISOString(), runtime: 'cloudflare-workers' }))

// ─────────────────────────────────────────────────────────────
// ROUTES — AUTH
// ─────────────────────────────────────────────────────────────

app.post('/auth/register', async (c) => {
    const { DB } = c.env
    const ip = getIp(c), ua = getUa(c)
    const { email, password, full_name } = await c.req.json()
    if (!email || !password) return c.json({ success: false, error: 'Email and password are required' }, 400)
    if (password.length < 6) return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400)
    try {
        const existing = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first()
        if (existing) return c.json({ success: false, error: 'Email already registered' }, 409)
        const hash = await hashPassword(password)
        const user = await DB.prepare(
            'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?) RETURNING id, email, full_name, role'
        ).bind(email.toLowerCase(), hash, full_name || null).first()
        const token = await signJWT({ id: user.id, email: user.email, role: user.role }, getSecret(c.env))
        await audit(DB, { userId: user.id, action: 'register', ip, ua })
        return c.json({ success: true, token, user }, 201)
    } catch (e) {
        console.error('Register:', e)
        return c.json({ success: false, error: 'Registration failed' }, 500)
    }
})

app.post('/auth/login', async (c) => {
    const { DB } = c.env
    const ip = getIp(c), ua = getUa(c)
    const { email, password } = await c.req.json()
    if (!email || !password) return c.json({ success: false, error: 'Email and password are required' }, 400)

    // Rate limit: 10 attempts per 15 min per IP
    const allowed = await checkRateLimit(DB, `login:${ip}`, { windowMs: 900_000, max: 10 })
    if (!allowed) return c.json({ success: false, error: 'Too many login attempts. Try again later.' }, 429)

    try {
        const user = await DB.prepare(
            'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = ?'
        ).bind(email.toLowerCase()).first()

        if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
            await audit(DB, { userId: user?.id, action: 'failed_login', ip, ua, metadata: { email }, severity: 'warn' })
            return c.json({ success: false, error: 'Invalid email or password' }, 401)
        }

        // Check 2FA
        const totp = await DB.prepare('SELECT secret_b32, enabled FROM user_totp WHERE user_id = ?').bind(user.id).first()
        if (totp?.enabled) {
            const partialToken = await signJWT({ id: user.id, temp: true }, getSecret(c.env), 300)
            return c.json({ success: true, requires_2fa: true, partial_token: partialToken })
        }

        await DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()
        const token = await signJWT({ id: user.id, email: user.email, role: user.role }, getSecret(c.env))
        await audit(DB, { userId: user.id, action: 'login', ip, ua })
        return c.json({ success: true, token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } })
    } catch (e) {
        console.error('Login:', e)
        return c.json({ success: false, error: 'Login failed' }, 500)
    }
})

app.get('/auth/me', (c) => requireAuth(c, async () => {
    const user = await c.env.DB.prepare(
        'SELECT id, email, full_name, role, last_login_at, created_at FROM users WHERE id = ?'
    ).bind(c.get('user').id).first()
    if (!user) return c.json({ success: false, error: 'User not found' }, 404)
    const totp = await c.env.DB.prepare('SELECT enabled FROM user_totp WHERE user_id = ?').bind(user.id).first()
    return c.json({ success: true, user: { ...user, totp_enabled: !!totp?.enabled } })
}))

// ─────────────────────────────────────────────────────────────
// ROUTES — 2FA / TOTP
// ─────────────────────────────────────────────────────────────

// Step 2 of login: validate TOTP with partial token
app.post('/auth/2fa/validate', async (c) => {
    const { DB } = c.env
    const ip = getIp(c), ua = getUa(c)
    const { partial_token, code } = await c.req.json()
    if (!partial_token || !code) return c.json({ success: false, error: 'partial_token and code required' }, 400)
    try {
        const payload = await verifyJWT(partial_token, getSecret(c.env))
        if (!payload.temp) return c.json({ success: false, error: 'Invalid token type' }, 400)

        const totp = await DB.prepare('SELECT secret_b32 FROM user_totp WHERE user_id = ? AND enabled = 1').bind(payload.id).first()
        if (!totp) return c.json({ success: false, error: '2FA not configured' }, 400)

        if (!(await verifyTOTP(totp.secret_b32, code))) {
            await audit(DB, { userId: payload.id, action: 'totp_failed', ip, ua, severity: 'warn' })
            return c.json({ success: false, error: 'Invalid 2FA code' }, 401)
        }

        const user = await DB.prepare('SELECT id, email, full_name, role FROM users WHERE id = ?').bind(payload.id).first()
        await DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(payload.id).run()
        const token = await signJWT({ id: user.id, email: user.email, role: user.role }, getSecret(c.env))
        await audit(DB, { userId: user.id, action: 'login_2fa', ip, ua })
        return c.json({ success: true, token, user })
    } catch {
        return c.json({ success: false, error: 'Invalid or expired token' }, 401)
    }
})

// Setup TOTP: generate secret, store (disabled until confirmed)
app.post('/auth/2fa/setup', (c) => requireAuth(c, async () => {
    const user = c.get('user')
    const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)))
    const uri = totpUri(secret, user.email)
    await c.env.DB.prepare(
        'INSERT INTO user_totp (user_id, secret_b32, enabled) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET secret_b32 = ?, enabled = 0, updated_at = CURRENT_TIMESTAMP'
    ).bind(user.id, secret, secret).run()
    return c.json({ success: true, secret, uri, qr: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(uri)}&size=200x200` })
}))

// Enable TOTP: verify code then activate
app.post('/auth/2fa/enable', (c) => requireAuth(c, async () => {
    const { code } = await c.req.json()
    if (!code) return c.json({ success: false, error: 'code required' }, 400)
    const totp = await c.env.DB.prepare('SELECT secret_b32 FROM user_totp WHERE user_id = ?').bind(c.get('user').id).first()
    if (!totp) return c.json({ success: false, error: 'Run /2fa/setup first' }, 400)
    if (!(await verifyTOTP(totp.secret_b32, code))) return c.json({ success: false, error: 'Invalid code' }, 401)
    await c.env.DB.prepare('UPDATE user_totp SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').bind(c.get('user').id).run()
    await audit(c.env.DB, { userId: c.get('user').id, action: '2fa_enabled', ip: getIp(c) })
    return c.json({ success: true, message: '2FA enabled' })
}))

// Disable TOTP
app.post('/auth/2fa/disable', (c) => requireAuth(c, async () => {
    const { code } = await c.req.json()
    if (!code) return c.json({ success: false, error: 'code required' }, 400)
    const totp = await c.env.DB.prepare('SELECT secret_b32 FROM user_totp WHERE user_id = ? AND enabled = 1').bind(c.get('user').id).first()
    if (!totp) return c.json({ success: false, error: '2FA is not enabled' }, 400)
    if (!(await verifyTOTP(totp.secret_b32, code))) return c.json({ success: false, error: 'Invalid code' }, 401)
    await c.env.DB.prepare('DELETE FROM user_totp WHERE user_id = ?').bind(c.get('user').id).run()
    await audit(c.env.DB, { userId: c.get('user').id, action: '2fa_disabled', ip: getIp(c), severity: 'warn' })
    return c.json({ success: true, message: '2FA disabled' })
}))

// ─────────────────────────────────────────────────────────────
// ROUTES — CHAT
// ─────────────────────────────────────────────────────────────

app.post('/chat', (c) => requireAuth(c, async () => {
    const { DB, OPENAI_API_KEY } = c.env
    const user = c.get('user')
    const ip = getIp(c)
    const { message, sessionId = crypto.randomUUID() } = await c.req.json()
    if (!message) return c.json({ error: 'Message is required' }, 400)

    // Rate limit: 60 messages/min per user
    const allowed = await checkRateLimit(DB, `chat:${user.id}`, { windowMs: 60_000, max: 60 })
    if (!allowed) return c.json({ success: false, error: 'Too many requests' }, 429)

    // SQL injection check on user message
    const sqli = detectSQLi(message)
    if (sqli.isInjection) {
        await audit(DB, { userId: user.id, action: 'sqli_attempt', ip, metadata: { findings: sqli.findings, message }, severity: 'critical' })
        return c.json({ success: false, response: "I detected potentially malicious input in your message." })
    }

    const sql = nlpToSQL(message)
    let results = []
    try {
        const { results: rows } = await DB.prepare(sql).all()
        results = rows || []
    } catch (e) { console.error('SQL exec:', e) }

    let response = buildResponse(message, results)
    if (OPENAI_API_KEY && results.length > 0) {
        try {
            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are a concise Armenian market analytics assistant. Answer in 2-3 sentences.' },
                        { role: 'user', content: `Question: ${message}\nData: ${JSON.stringify(results.slice(0, 8))}\nAnswer briefly.` }
                    ],
                    max_tokens: 250, temperature: 0.7
                })
            })
            const ai = await aiRes.json()
            if (ai.choices?.[0]?.message?.content) response = ai.choices[0].message.content
        } catch (e) { console.error('AI:', e) }
    }

    const chart = detectChart(results)
    await DB.prepare(
        'INSERT INTO chat_history (session_id, user_id, user_message, generated_sql, result_count, assistant_response) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(sessionId, user.id, message, sql, results.length, response).run()
    await audit(DB, { userId: user.id, action: 'query', ip, metadata: { sessionId, resultCount: results.length } })

    return c.json({ success: true, message, response, data: results, dataCount: results.length, chart, sql, sessionId })
}))

app.get('/chat/history/:sessionId', (c) => requireAuth(c, async () => {
    const { results } = await c.env.DB.prepare(
        'SELECT id, user_message, generated_sql, result_count, assistant_response, created_at FROM chat_history WHERE session_id = ? ORDER BY created_at ASC'
    ).bind(c.req.param('sessionId')).all()
    return c.json({ success: true, history: results })
}))

app.get('/chat/sessions', (c) => requireAuth(c, async () => {
    const { results } = await c.env.DB.prepare(
        `SELECT session_id, COUNT(*) as message_count,
            MIN(created_at) as first_message, MAX(created_at) as last_message,
            (SELECT user_message FROM chat_history h2
             WHERE h2.session_id = chat_history.session_id ORDER BY created_at ASC LIMIT 1) as title
         FROM chat_history WHERE user_id = ?
         GROUP BY session_id ORDER BY MAX(created_at) DESC LIMIT 50`
    ).bind(c.get('user').id).all()
    return c.json({ success: true, sessions: results })
}))

// ─────────────────────────────────────────────────────────────
// ROUTES — SQL EDITOR
// ─────────────────────────────────────────────────────────────

app.post('/sql/execute', (c) => requireAuth(c, async () => {
    const user = c.get('user')
    const ip = getIp(c)
    const { sql } = await c.req.json()
    if (!sql?.trim()) return c.json({ success: false, error: 'SQL is required' }, 400)

    // Rate limit: 20 queries/min
    const allowed = await checkRateLimit(c.env.DB, `sql:${user.id}`, { windowMs: 60_000, max: 20 })
    if (!allowed) return c.json({ success: false, error: 'Too many requests' }, 429)

    // SQLi detection
    const sqli = detectSQLi(sql)
    if (sqli.isInjection) {
        await audit(c.env.DB, { userId: user.id, action: 'sqli_attempt', ip, metadata: { findings: sqli.findings }, severity: 'critical' })
        return c.json({ success: false, error: 'Potentially malicious SQL detected' }, 400)
    }

    // Blocklist write operations
    const upper = sql.trim().toUpperCase()
    const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'REPLACE', 'PRAGMA']
    if (blocked.some(k => upper.startsWith(k) || upper.includes(` ${k} `))) {
        return c.json({ success: false, error: 'Only SELECT queries are allowed' }, 400)
    }

    // Blocklist private/system tables — only data-platform tables are queryable
    const PRIVATE_TABLES = ['users', 'sessions', 'audit_log', 'ip_rules', 'anomalies', 'totp_secrets', 'rate_limits', 'scraper_jobs']
    const mentionedPrivate = PRIVATE_TABLES.filter(t => {
        // Match whole-word table name (not as a substring of another word)
        const re = new RegExp(`(?<![\\w])${t}(?![\\w])`, 'i')
        return re.test(sql)
    })
    if (mentionedPrivate.length > 0) {
        await audit(c.env.DB, { userId: user.id, action: 'sql_blocked_private_table', ip, metadata: { tables: mentionedPrivate, sql: sql.slice(0, 200) }, severity: 'high' })
        return c.json({ success: false, error: `Access denied: table(s) [${mentionedPrivate.join(', ')}] are restricted. Queryable tables: companies, news_articles, statistics, market_trends.` }, 403)
    }

    try {
        const start = Date.now()
        const { results } = await c.env.DB.prepare(sql).all()
        await audit(c.env.DB, { userId: user.id, action: 'sql_exec', ip, metadata: { sql: sql.slice(0, 200) } })
        return c.json({ success: true, results: results || [], executionTime: Date.now() - start })
    } catch (e) {
        return c.json({ success: false, error: e.message }, 400)
    }
}))

// ─────────────────────────────────────────────────────────────
// ROUTES — DATA
// ─────────────────────────────────────────────────────────────

app.get('/data/summary', (c) => requireAuth(c, async () => {
    const DB = c.env.DB
    const [companies, news, stats, jobs] = await Promise.all([
        DB.prepare('SELECT COUNT(*) AS n FROM companies').first(),
        DB.prepare('SELECT COUNT(*) AS n FROM news_articles').first(),
        DB.prepare('SELECT COUNT(*) AS n FROM statistics').first(),
        DB.prepare("SELECT COUNT(*) AS n FROM scraper_jobs WHERE status = 'completed'").first()
    ])
    const recentNews = await DB.prepare('SELECT title, source, published_date FROM news_articles ORDER BY published_date DESC LIMIT 5').all()
    return c.json({
        success: true,
        summary: { companies: companies?.n || 0, news_articles: news?.n || 0, statistics: stats?.n || 0, scraper_jobs_completed: jobs?.n || 0 },
        recentNews: recentNews.results || []
    })
}))

app.get('/data/companies', (c) => requireAuth(c, async () => {
    const industry = c.req.query('industry')
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const { results } = industry
        ? await c.env.DB.prepare('SELECT * FROM companies WHERE industry LIKE ? ORDER BY name LIMIT ?').bind(`%${industry}%`, limit).all()
        : await c.env.DB.prepare('SELECT * FROM companies ORDER BY created_at DESC LIMIT ?').bind(limit).all()
    return c.json({ success: true, companies: results })
}))

app.get('/data/statistics', (c) => requireAuth(c, async () => {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const { results } = await c.env.DB.prepare('SELECT * FROM statistics ORDER BY created_at DESC LIMIT ?').bind(limit).all()
    return c.json({ success: true, statistics: results })
}))

// Network graph data
app.get('/data/graph', (c) => requireAuth(c, async () => {
    const DB = c.env.DB
    const { results: companies } = await DB.prepare(
        'SELECT id, name, industry, city, employee_count FROM companies ORDER BY employee_count DESC LIMIT 80'
    ).all()

    const nodes = companies.map(co => ({
        id: co.id, name: co.name, group: co.industry || 'Other',
        city: co.city, size: Math.max(8, Math.min(28, Math.sqrt(co.employee_count || 100)))
    }))

    // Build edges: same industry (weight 2) or same city (weight 1)
    const edges = []
    for (let i = 0; i < companies.length; i++) {
        for (let j = i + 1; j < companies.length; j++) {
            const a = companies[i], b = companies[j]
            if (a.industry && a.industry === b.industry) {
                edges.push({ source: a.id, target: b.id, type: 'same_industry', weight: 2 })
            } else if (a.city && a.city === b.city) {
                edges.push({ source: a.id, target: b.id, type: 'same_city', weight: 1 })
            }
        }
    }

    // Also get explicit relationships if they exist
    try {
        const { results: rels } = await DB.prepare('SELECT source_id, target_id, relationship, weight FROM company_relationships').all()
        rels.forEach(r => edges.push({ source: r.source_id, target: r.target_id, type: r.relationship, weight: r.weight }))
    } catch { /* table may not exist yet */ }

    return c.json({ success: true, nodes, edges })
}))

// ─────────────────────────────────────────────────────────────
// ROUTES — SECURITY (admin + self-serve)
// ─────────────────────────────────────────────────────────────

// ── Audit Log ────────────────────────────────────────────────
app.get('/security/audit-log', (c) => requireAdmin(c, async () => {
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500)
    const action = c.req.query('action')
    const severity = c.req.query('severity')
    let sql = 'SELECT al.*, u.email FROM audit_log al LEFT JOIN users u ON al.user_id = u.id'
    const binds = []
    const where = []
    if (action) { where.push('al.action = ?'); binds.push(action) }
    if (severity) { where.push('al.severity = ?'); binds.push(severity) }
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY al.created_at DESC LIMIT ?'
    binds.push(limit)
    const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
    return c.json({ success: true, logs: results })
}))

// ── IP Rules ─────────────────────────────────────────────────
app.get('/security/ip-rules', (c) => requireAdmin(c, async () => {
    const { results } = await c.env.DB.prepare('SELECT * FROM ip_rules ORDER BY created_at DESC').all()
    return c.json({ success: true, rules: results })
}))

app.post('/security/ip-rules', (c) => requireAdmin(c, async () => {
    const { ip_or_cidr, rule_type, note } = await c.req.json()
    if (!ip_or_cidr || !['allow', 'deny'].includes(rule_type)) {
        return c.json({ success: false, error: 'ip_or_cidr and rule_type (allow|deny) required' }, 400)
    }
    try {
        await c.env.DB.prepare(
            'INSERT INTO ip_rules (ip_or_cidr, rule_type, note, created_by) VALUES (?, ?, ?, ?)'
        ).bind(ip_or_cidr, rule_type, note || null, c.get('user').id).run()
        return c.json({ success: true })
    } catch {
        return c.json({ success: false, error: 'Rule already exists or invalid input' }, 409)
    }
}))

app.delete('/security/ip-rules/:id', (c) => requireAdmin(c, async () => {
    await c.env.DB.prepare('DELETE FROM ip_rules WHERE id = ?').bind(c.req.param('id')).run()
    return c.json({ success: true })
}))

// ── Anomaly Detection ─────────────────────────────────────────
app.get('/security/anomalies', (c) => requireAuth(c, async () => {
    const DB = c.env.DB
    const w15m = new Date(Date.now() - 15 * 60_000).toISOString()
    const w1h  = new Date(Date.now() - 60 * 60_000).toISOString()
    const w24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString()

    // Detect brute force: >5 failed logins from same IP in 15min
    const { results: bf } = await DB.prepare(
        "SELECT ip, COUNT(*) AS n FROM audit_log WHERE action='failed_login' AND created_at > ? GROUP BY ip HAVING n > 5"
    ).bind(w15m).all()

    // Scraper failures in last 24h
    const { results: sf } = await DB.prepare(
        "SELECT source_name, error_message, created_at FROM scraper_jobs WHERE status='failed' AND created_at > ? ORDER BY created_at DESC LIMIT 10"
    ).bind(w24h).all()

    // SQL injection attempts in last hour
    const { results: sqli } = await DB.prepare(
        "SELECT user_id, metadata, created_at FROM audit_log WHERE action='sqli_attempt' AND created_at > ? ORDER BY created_at DESC"
    ).bind(w1h).all()

    // Save anomaly events
    const inserts = []
    for (const row of bf) {
        inserts.push(DB.prepare(
            "INSERT OR IGNORE INTO anomaly_events (event_type, target, details, severity) VALUES ('brute_force', ?, ?, 'high')"
        ).bind(row.ip, JSON.stringify(row)))
    }
    for (const row of sqli) {
        inserts.push(DB.prepare(
            "INSERT OR IGNORE INTO anomaly_events (event_type, target, details, severity) VALUES ('sqli_attempt', ?, ?, 'critical')"
        ).bind(String(row.user_id), JSON.stringify(row)))
    }
    if (inserts.length) await DB.batch(inserts)

    // Return unresolved events
    const { results: events } = await DB.prepare(
        'SELECT * FROM anomaly_events WHERE resolved = 0 ORDER BY created_at DESC LIMIT 50'
    ).all()

    return c.json({ success: true, events, signals: { brute_force: bf, scraper_failures: sf, sqli_attempts: sqli } })
}))

app.post('/security/anomalies/:id/resolve', (c) => requireAdmin(c, async () => {
    await c.env.DB.prepare('UPDATE anomaly_events SET resolved = 1 WHERE id = ?').bind(c.req.param('id')).run()
    return c.json({ success: true })
}))

// ── Threat Intel: Domain Reputation (VirusTotal v3) ──────────
app.get('/security/intel/domain/:domain', (c) => requireAuth(c, async () => {
    const domain = c.req.param('domain').toLowerCase()
    if (!c.env.VIRUSTOTAL_API_KEY) return c.json({ success: false, error: 'VirusTotal API key not configured' }, 503)

    const cacheKey = await sha256Hex('vt:' + domain)
    const cached = await c.env.DB.prepare(
        "SELECT result, queried_at FROM threat_cache WHERE type='virustotal' AND query_key=?"
    ).bind(cacheKey).first()
    if (cached) {
        const age = Date.now() - new Date(cached.queried_at).getTime()
        if (age < 3_600_000) return c.json({ success: true, cached: true, data: JSON.parse(cached.result) })
    }

    const vt = await fetch(`https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`, {
        headers: { 'x-apikey': c.env.VIRUSTOTAL_API_KEY }
    })
    if (!vt.ok) return c.json({ success: false, error: `VirusTotal returned ${vt.status}` }, 502)
    const vtData = await vt.json()
    const attrs = vtData.data?.attributes ?? {}
    const stats = attrs.last_analysis_stats ?? {}

    const result = {
        domain,
        malicious: stats.malicious ?? 0,
        suspicious: stats.suspicious ?? 0,
        harmless: stats.harmless ?? 0,
        undetected: stats.undetected ?? 0,
        reputation: attrs.reputation ?? 0,
        categories: attrs.categories ?? {},
        risk_score: Math.min(100, ((stats.malicious ?? 0) * 5 + (stats.suspicious ?? 0) * 2)),
        scanned_at: new Date().toISOString()
    }

    await c.env.DB.prepare(
        "INSERT INTO threat_cache (type, query_key, result) VALUES (?,?,?) ON CONFLICT(type,query_key) DO UPDATE SET result=excluded.result, queried_at=CURRENT_TIMESTAMP"
    ).bind('virustotal', cacheKey, JSON.stringify(result)).run()

    await audit(c.env.DB, { userId: c.get('user').id, action: 'domain_check', ip: getIp(c), metadata: { domain } })
    return c.json({ success: true, cached: false, data: result })
}))

// ── Threat Intel: Breach Check (HaveIBeenPwned v3) ───────────
app.get('/security/intel/breach/:email', (c) => requireAuth(c, async () => {
    const email = c.req.param('email').toLowerCase()
    if (!c.env.HIBP_API_KEY) return c.json({ success: false, error: 'HIBP API key not configured' }, 503)

    const cacheKey = await sha256Hex('hibp:' + email)
    const cached = await c.env.DB.prepare(
        "SELECT result, queried_at FROM threat_cache WHERE type='hibp' AND query_key=?"
    ).bind(cacheKey).first()
    if (cached) {
        const age = Date.now() - new Date(cached.queried_at).getTime()
        if (age < 86_400_000) return c.json({ success: true, cached: true, data: JSON.parse(cached.result) })
    }

    const hibp = await fetch(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
        { headers: { 'hibp-api-key': c.env.HIBP_API_KEY, 'User-Agent': 'ArmenianOSINT/1.0' } }
    )

    let result
    if (hibp.status === 404) {
        result = { email, breach_count: 0, breaches: [] }
    } else if (!hibp.ok) {
        return c.json({ success: false, error: `HIBP returned ${hibp.status}` }, 502)
    } else {
        const data = await hibp.json()
        result = {
            email,
            breach_count: data.length,
            breaches: data.map(b => ({ name: b.Name, domain: b.Domain, date: b.BreachDate, classes: b.DataClasses, verified: b.IsVerified }))
        }
    }

    await c.env.DB.prepare(
        "INSERT INTO threat_cache (type, query_key, result) VALUES (?,?,?) ON CONFLICT(type,query_key) DO UPDATE SET result=excluded.result, queried_at=CURRENT_TIMESTAMP"
    ).bind('hibp', cacheKey, JSON.stringify(result)).run()

    await audit(c.env.DB, { userId: c.get('user').id, action: 'breach_check', ip: getIp(c) })
    return c.json({ success: true, cached: false, data: result })
}))

// ── Online Exposure (combines domain + breach + paste check) ──
app.get('/security/intel/exposure/:email', (c) => requireAuth(c, async () => {
    const email = c.req.param('email').toLowerCase()
    const domain = email.split('@')[1] || ''
    const results = { email, domain, breach_count: 0, paste_count: 0, domain_malicious: 0, risk_score: 0, risk_level: 'low', checks: [] }

    if (c.env.HIBP_API_KEY) {
        try {
            const r = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`,
                { headers: { 'hibp-api-key': c.env.HIBP_API_KEY, 'User-Agent': 'ArmenianOSINT/1.0' } })
            if (r.ok) { const d = await r.json(); results.breach_count = d.length }
            const p = await fetch(`https://haveibeenpwned.com/api/v3/pasteaccount/${encodeURIComponent(email)}`,
                { headers: { 'hibp-api-key': c.env.HIBP_API_KEY, 'User-Agent': 'ArmenianOSINT/1.0' } })
            if (p.ok) { const d = await p.json(); results.paste_count = d.length }
        } catch { /* ignore */ }
    }

    if (c.env.VIRUSTOTAL_API_KEY && domain) {
        try {
            const r = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`,
                { headers: { 'x-apikey': c.env.VIRUSTOTAL_API_KEY } })
            if (r.ok) { const d = await r.json(); results.domain_malicious = d.data?.attributes?.last_analysis_stats?.malicious ?? 0 }
        } catch { /* ignore */ }
    }

    results.risk_score = Math.min(100,
        Math.min(results.breach_count * 15, 60) +
        Math.min(results.paste_count * 10, 20) +
        (results.domain_malicious > 0 ? 20 : 0)
    )
    results.risk_level = results.risk_score >= 70 ? 'critical' : results.risk_score >= 40 ? 'high' : results.risk_score >= 20 ? 'medium' : 'low'

    return c.json({ success: true, data: results })
}))

// ─────────────────────────────────────────────────────────────
// GOOGLE OAUTH 2.0
// ─────────────────────────────────────────────────────────────

// GET /auth/google  →  redirect to Google consent screen
app.get('/auth/google', (c) => {
    const clientId = c.env.GOOGLE_CLIENT_ID
    if (!clientId) {
        const origin = new URL(c.req.url).origin
        return Response.redirect(`${origin}/login?error=${encodeURIComponent('Google SSO not configured. Set GOOGLE_CLIENT_ID secret.')}`, 302)
    }
    const origin      = new URL(c.req.url).origin
    const redirectUri = `${origin}/api/auth/google/callback`
    const url         = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id',     clientId)
    url.searchParams.set('redirect_uri',  redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope',         'openid email profile')
    url.searchParams.set('access_type',   'online')
    url.searchParams.set('prompt',        'select_account')
    return Response.redirect(url.toString(), 302)
})

// GET /auth/google/callback  →  exchange code, find/create user, redirect with JWT
app.get('/auth/google/callback', async (c) => {
    const origin       = new URL(c.req.url).origin
    const clientId     = c.env.GOOGLE_CLIENT_ID
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET
    const code         = c.req.query('code')
    const errParam     = c.req.query('error')

    if (errParam || !code) {
        return Response.redirect(`${origin}/login?error=${encodeURIComponent('Google login was cancelled.')}`, 302)
    }
    if (!clientId || !clientSecret) {
        return Response.redirect(`${origin}/login?error=${encodeURIComponent('Google OAuth not configured.')}`, 302)
    }

    const redirectUri = `${origin}/api/auth/google/callback`

    // Exchange authorization code for tokens
    let tokens
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
        })
        tokens = await tokenRes.json()
        if (!tokens.access_token) throw new Error('No access token')
    } catch (err) {
        return Response.redirect(`${origin}/login?error=${encodeURIComponent('Failed to exchange Google token.')}`, 302)
    }

    // Get user profile from Google
    let googleUser
    try {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        })
        googleUser = await userRes.json()
        if (!googleUser.email) throw new Error('No email')
    } catch {
        return Response.redirect(`${origin}/login?error=${encodeURIComponent('Failed to fetch Google profile.')}`, 302)
    }

    const DB    = c.env.DB
    const email = googleUser.email.toLowerCase()

    try {
        // Find existing user or create new one
        let user = await DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()

        if (!user) {
            const result = await DB.prepare(
                'INSERT INTO users (email, full_name, password_hash, role, is_active) VALUES (?,?,?,?,1) RETURNING *'
            ).bind(email, googleUser.name || email.split('@')[0], 'google-oauth', 'analyst').first()
            user = result
        }

        if (!user.is_active) {
            return Response.redirect(`${origin}/login?error=${encodeURIComponent('Account is disabled.')}`, 302)
        }

        await DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()
        await audit(DB, { userId: user.id, action: 'google_login', ip: c.req.header('CF-Connecting-IP') })

        const token = await signJWT({ id: user.id, email: user.email, role: user.role }, getSecret(c.env))
        return Response.redirect(`${origin}/login?token=${token}`, 302)
    } catch (err) {
        return Response.redirect(`${origin}/login?error=${encodeURIComponent('Authentication failed.')}`, 302)
    }
})

// POST /auth/setup  →  first-run admin setup (only works with 0 users)
app.post('/auth/setup', async (c) => {
    const DB = c.env.DB
    try {
        const row = await DB.prepare('SELECT COUNT(*) AS n FROM users').first()
        if ((row?.n ?? 1) > 0) return c.json({ success: false, error: 'Setup already completed' }, 403)

        const { email, password, full_name } = await c.req.json()
        if (!email || !password || password.length < 8) return c.json({ success: false, error: 'Email and password (min 8 chars) required' }, 400)

        const hash   = await hashPassword(password)
        const result = await DB.prepare(
            'INSERT INTO users (email, full_name, password_hash, role) VALUES (?,?,?,?) RETURNING *'
        ).bind(email.toLowerCase(), full_name || 'Admin', hash, 'admin').first()

        const token = await signJWT({ id: result.id, email: result.email, role: result.role }, getSecret(c.env))
        return c.json({ success: true, message: 'Admin account created', token, user: { id: result.id, email: result.email, role: result.role, full_name: result.full_name } }, 201)
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500)
    }
})

// ─────────────────────────────────────────────────────────────
// Export for CF Pages
// ─────────────────────────────────────────────────────────────
export const onRequest = (ctx) => app.fetch(ctx.request, ctx.env)
