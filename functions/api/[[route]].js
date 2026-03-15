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
// WEB CRYPTO HELPERS (no bcryptjs / jsonwebtoken needed)
// ─────────────────────────────────────────────────────────────

function b64url(input) {
    const str = input instanceof ArrayBuffer
        ? String.fromCharCode(...new Uint8Array(input))
        : JSON.stringify(input)
    return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function fromb64url(str) {
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
}

async function hashPassword(password) {
    const enc = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256
    )
    const toHex = (u8) => [...u8].map(b => b.toString(16).padStart(2, '0')).join('')
    return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`
}

async function verifyPassword(password, stored) {
    const [saltHex, hashHex] = stored.split(':')
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256
    )
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('') === hashHex
}

async function signJWT(payload, secret) {
    const header = b64url({ alg: 'HS256', typ: 'JWT' })
    const body = b64url({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7 * 86400 })
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

// ─────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────

function getSecret(env) {
    return env.JWT_SECRET || 'armenian-osint-change-in-production'
}

async function requireAuth(c, next) {
    const auth = c.req.header('Authorization')
    if (!auth?.startsWith('Bearer ')) return c.json({ success: false, error: 'Authentication required' }, 401)
    try {
        c.set('user', await verifyJWT(auth.slice(7), getSecret(c.env)))
        return next()
    } catch {
        return c.json({ success: false, error: 'Invalid or expired token' }, 401)
    }
}

// ─────────────────────────────────────────────────────────────
// NLP → SQL (SQLite/D1 compatible — uses LIKE not ILIKE)
// ─────────────────────────────────────────────────────────────

function nlpToSQL(question) {
    const q = question.toLowerCase()

    // Chart/visualization requests
    if (q.match(/chart|pie|graph|visual|breakdown|by brand|distribution/)) {
        if (q.includes('industri') || q.includes('sector')) {
            return "SELECT industry AS label, COUNT(*) AS value FROM companies WHERE industry IS NOT NULL GROUP BY industry ORDER BY value DESC LIMIT 15"
        }
        if (q.includes('news') || q.includes('categor')) {
            return "SELECT category AS label, COUNT(*) AS value FROM news_articles WHERE category IS NOT NULL GROUP BY category ORDER BY value DESC LIMIT 10"
        }
        if (q.includes('region') || q.includes('city')) {
            return "SELECT region AS label, AVG(value) AS value FROM statistics WHERE region IS NOT NULL GROUP BY region ORDER BY value DESC LIMIT 15"
        }
        if (q.includes('platform') || q.includes('social')) {
            return "SELECT platform AS label, SUM(followers_count) AS value FROM social_metrics GROUP BY platform ORDER BY value DESC"
        }
    }

    // Company queries
    if (q.match(/compan|business|firm|enterprise/)) {
        if (q.match(/top|revenue|biggest|largest|richest/)) {
            return "SELECT name, industry, revenue_estimate, employee_count, city FROM companies WHERE revenue_estimate IS NOT NULL ORDER BY revenue_estimate DESC LIMIT 10"
        }
        if (q.match(/industri|sector/)) {
            return "SELECT industry, COUNT(*) AS company_count, AVG(revenue_estimate) AS avg_revenue FROM companies WHERE industry IS NOT NULL GROUP BY industry ORDER BY company_count DESC LIMIT 20"
        }
        if (q.match(/employee|staff|worker|size/)) {
            return "SELECT name, industry, employee_count, city FROM companies WHERE employee_count IS NOT NULL ORDER BY employee_count DESC LIMIT 20"
        }
        if (q.match(/tech|it|software|digital/)) {
            return "SELECT name, website, employee_count, city FROM companies WHERE industry LIKE '%tech%' OR industry LIKE '%IT%' OR industry LIKE '%software%' ORDER BY employee_count DESC LIMIT 20"
        }
        return "SELECT name, industry, city, employee_count, revenue_estimate FROM companies ORDER BY created_at DESC LIMIT 20"
    }

    // News queries
    if (q.match(/news|article|headline|press|report/)) {
        const catMap = { tech: 'technology', econom: 'economy', financ: 'economy', politi: 'politics', sport: 'sports', cultur: 'culture', health: 'health', world: 'world' }
        for (const [key, cat] of Object.entries(catMap)) {
            if (q.includes(key)) return `SELECT title, summary, source, category, published_date FROM news_articles WHERE category = '${cat}' ORDER BY published_date DESC LIMIT 20`
        }
        return "SELECT title, summary, source, category, published_date FROM news_articles ORDER BY published_date DESC LIMIT 20"
    }

    // Statistics / demographics
    if (q.match(/statistic|gdp|population|econom|indicator|unemploy|inflation|trade/)) {
        if (q.match(/city|region|yerevan|gyumri|vanadzor/)) {
            return "SELECT region, indicator, value, unit, period FROM statistics WHERE region IS NOT NULL ORDER BY period DESC LIMIT 30"
        }
        if (q.match(/gdp|gross/)) {
            return "SELECT indicator, value, unit, period, region FROM statistics WHERE indicator LIKE '%GDP%' ORDER BY period DESC LIMIT 20"
        }
        return "SELECT category, indicator, value, unit, period, region FROM statistics ORDER BY created_at DESC LIMIT 30"
    }

    // Social media
    if (q.match(/social|follower|instagram|facebook|linkedin|twitter|engag/)) {
        return "SELECT c.name, sm.platform, sm.followers_count, sm.engagement_rate, sm.snapshot_date FROM companies c JOIN social_metrics sm ON c.id = sm.company_id ORDER BY sm.followers_count DESC LIMIT 20"
    }

    // Market trends
    if (q.match(/trend|market|growth|opportunit/)) {
        return "SELECT industry, trend_name, trend_score, description, start_date FROM market_trends ORDER BY trend_score DESC LIMIT 20"
    }

    // Contacts / people
    if (q.match(/contact|person|people|ceo|founder|executive/)) {
        return "SELECT ct.first_name, ct.last_name, ct.position, c.name AS company, ct.email FROM contacts ct LEFT JOIN companies c ON ct.company_id = c.id ORDER BY ct.created_at DESC LIMIT 20"
    }

    // Default: database overview
    return `SELECT 'companies' AS table_name, COUNT(*) AS total_rows FROM companies
            UNION ALL SELECT 'news_articles', COUNT(*) FROM news_articles
            UNION ALL SELECT 'statistics', COUNT(*) FROM statistics
            UNION ALL SELECT 'contacts', COUNT(*) FROM contacts`
}

function buildResponse(question, results) {
    const n = results.length
    const q = question.toLowerCase()
    if (n === 0) return `No data found for "${question}". The scrapers may not have collected this data yet — try asking about companies, news, or statistics.`
    if (q.match(/compan|business/)) return `Found ${n} compan${n === 1 ? 'y' : 'ies'} in the Armenian market database:`
    if (q.match(/news|article/)) return `Here are ${n} recent Armenian news article${n === 1 ? '' : 's'}:`
    if (q.match(/statistic|gdp|population/)) return `Retrieved ${n} statistical indicator${n === 1 ? '' : 's'} from Armenian sources:`
    if (q.match(/social|follower/)) return `Social media metrics for ${n} Armenian compan${n === 1 ? 'y' : 'ies'}:`
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
// ROUTES
// ─────────────────────────────────────────────────────────────

// Health
app.get('/health', (c) => c.json({ success: true, status: 'healthy', timestamp: new Date().toISOString(), runtime: 'cloudflare-workers' }))

// ── AUTH ──────────────────────────────────────────────────────

app.post('/auth/register', async (c) => {
    const { DB } = c.env
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
        return c.json({ success: true, token, user }, 201)
    } catch (e) {
        console.error('Register:', e)
        return c.json({ success: false, error: 'Registration failed' }, 500)
    }
})

app.post('/auth/login', async (c) => {
    const { DB } = c.env
    const { email, password } = await c.req.json()
    if (!email || !password) return c.json({ success: false, error: 'Email and password are required' }, 400)
    try {
        const user = await DB.prepare(
            'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = ?'
        ).bind(email.toLowerCase()).first()
        if (!user || !user.is_active) return c.json({ success: false, error: 'Invalid email or password' }, 401)
        if (!(await verifyPassword(password, user.password_hash))) return c.json({ success: false, error: 'Invalid email or password' }, 401)
        await DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()
        const token = await signJWT({ id: user.id, email: user.email, role: user.role }, getSecret(c.env))
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
    return c.json({ success: true, user })
}))

// ── CHAT ──────────────────────────────────────────────────────

app.post('/chat', (c) => requireAuth(c, async () => {
    const { DB, OPENAI_API_KEY } = c.env
    const { message, sessionId = crypto.randomUUID() } = await c.req.json()
    if (!message) return c.json({ error: 'Message is required' }, 400)

    const sql = nlpToSQL(message)
    let results = []
    try {
        const { results: rows } = await DB.prepare(sql).all()
        results = rows || []
    } catch (e) { console.error('SQL exec:', e) }

    let response = buildResponse(message, results)

    // Optional: enhance response with OpenAI if key is set and we have data
    if (OPENAI_API_KEY && results.length > 0) {
        try {
            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are a concise Armenian market analytics assistant. Answer in 2-3 sentences based on the data.' },
                        { role: 'user', content: `Question: ${message}\nData (${results.length} rows): ${JSON.stringify(results.slice(0, 8))}\nAnswer briefly and naturally.` }
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
    ).bind(sessionId, c.get('user').id, message, sql, results.length, response).run()

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
        `SELECT session_id,
            COUNT(*) as message_count,
            MIN(created_at) as first_message,
            MAX(created_at) as last_message,
            (SELECT user_message FROM chat_history h2
             WHERE h2.session_id = chat_history.session_id
             ORDER BY created_at ASC LIMIT 1) as title
         FROM chat_history WHERE user_id = ?
         GROUP BY session_id ORDER BY MAX(created_at) DESC LIMIT 50`
    ).bind(c.get('user').id).all()
    return c.json({ success: true, sessions: results })
}))

// ── SQL EDITOR ────────────────────────────────────────────────

app.post('/sql/execute', (c) => requireAuth(c, async () => {
    const { sql } = await c.req.json()
    if (!sql?.trim()) return c.json({ success: false, error: 'SQL is required' }, 400)
    const upper = sql.trim().toUpperCase()
    const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'REPLACE', 'PRAGMA']
    if (blocked.some(k => upper.startsWith(k) || upper.includes(` ${k} `))) {
        return c.json({ success: false, error: 'Only SELECT queries are allowed' }, 400)
    }
    try {
        const start = Date.now()
        const { results } = await c.env.DB.prepare(sql).all()
        return c.json({ success: true, results: results || [], executionTime: Date.now() - start })
    } catch (e) {
        return c.json({ success: false, error: e.message }, 400)
    }
}))

// ── DATA ──────────────────────────────────────────────────────

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
        summary: {
            companies: companies?.n || 0,
            news_articles: news?.n || 0,
            statistics: stats?.n || 0,
            scraper_jobs_completed: jobs?.n || 0
        },
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

// ─────────────────────────────────────────────────────────────
// Export for CF Pages
// ─────────────────────────────────────────────────────────────
export const onRequest = (ctx) => app.fetch(ctx.request, ctx.env)
