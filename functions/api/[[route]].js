/**
 * Armenian OSINT Analytics — Cloudflare Pages Functions
 * All /api/* routes handled by Hono running on CF Workers runtime
 * Database: D1 (SQLite)  Auth: Web Crypto (PBKDF2 + HMAC-SHA256 JWT)
 *
 * Data layer: unified data_points + entities tables (replaces statistics/facts/market_data/companies)
 * AI pipeline: 3-step (introspect live catalog → plan → execute or research)
 * Query cache: SHA-256 hash + slug deduplication across all users
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
// IP FILTER
// ─────────────────────────────────────────────────────────────

function ipToInt(ip) { return ip.split('.').reduce((acc, o) => (acc << 8) + (+o), 0) >>> 0 }

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
async function appLog(DB, { level = 'info', source = 'api', message, metadata, userId = null }) {
    try {
        await DB.prepare(
            'INSERT INTO app_logs (level, source, message, metadata, user_id) VALUES (?,?,?,?,?)'
        ).bind(level, source, message, metadata ? JSON.stringify(metadata) : null, userId ?? null).run()
    } catch { /* non-fatal */ }
}

// ─────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────

async function checkRateLimit(DB, key, { windowMs = 60_000, max = 60 }) {
    const cutoff = new Date(Date.now() - windowMs).toISOString()
    try {
        await DB.prepare('DELETE FROM rate_limit_log WHERE key = ? AND hit_at < ?').bind(key, cutoff).run()
        const row = await DB.prepare('SELECT COUNT(*) AS n FROM rate_limit_log WHERE key = ?').bind(key).first()
        if ((row?.n ?? 0) >= max) return false
        await DB.prepare('INSERT INTO rate_limit_log (key) VALUES (?)').bind(key).run()
    } catch { /* non-fatal */ }
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
        if (deny.some(r => ipInCidr(ip, r.ip_or_cidr))) return c.json({ success: false, error: 'Access denied' }, 403)
        if (allow.length > 0 && !allow.some(r => ipInCidr(ip, r.ip_or_cidr))) return c.json({ success: false, error: 'Access denied' }, 403)
    } catch { /* table may not exist yet */ }
    return next()
}

app.use('*', ipFilter)

// ─────────────────────────────────────────────────────────────
// STATIC SCHEMA + LIVE CATALOG BUILDER
// ─────────────────────────────────────────────────────────────

const STATIC_SCHEMA = `
SQLite database — all data is about Armenia.

=== PRIMARY DATA TABLE ===
data_points(id, domain, category, subcategory, entity, attribute, value_text, value_num, unit, location, period, source_name, source_url, confidence, created_at, updated_at)
  domain: 'demographics','economy','business','health','environment','infrastructure','social','geography','politics','labor','education','technology','banking','general'
  entity: the subject (e.g. 'Armenia', 'Yerevan', 'Araratsotn', 'Marlboro', a company name)
  attribute: what is measured (e.g. 'Population, total', 'GDP (current USD)', 'market_share_pct')
  location: country or city/region (default 'Armenia')
  period: year string '2023' or '2023-Q1', empty string for timeless facts
  confidence: 'high' (official API), 'medium' (publication), 'low' (web-scraped), 'ai_inferred'

=== ENTITIES TABLE (companies, brands, NGOs, government bodies) ===
entities(id, name, type, domain, industry, description, city, country, website, founded_year, employee_count, revenue_amd, source, ai_extracted, created_at)
  type: 'company','brand','organization','government_body','ngo','university','media_outlet','political_party'

=== NEWS ===
news_articles(id, title, summary, source, source_url, published_date, category, sentiment, language, ai_processed, created_at)
  category: 'technology','economy','politics','sports','culture','health','general'
  sentiment: 'positive','neutral','negative'
news_entities(news_id, entity_id) -- links articles to entities

=== EXCHANGE RATES ===
exchange_rates(id, base, target, rate, date, source, created_at)
  base is always 'AMD'. Targets: 'USD','EUR','RUB','GBP','CNY','GEL','IRR','AED','CHF','JPY','CAD','AUD'

Rules: SELECT only · LIMIT 50 max · SQLite syntax · Use JOINs when relevant
NEVER query: users, audit_log, rate_limit_log, ip_rules, user_totp, threat_cache, anomaly_events, scraper_jobs, chat_history, rate_limits, query_cache
`

// Builds schema + appends live data catalog so AI knows exact values that exist
async function buildDynamicSchema(DB) {
    try {
        // What domains/attributes exist
        const { results: catalog } = await DB.prepare(`
            SELECT domain, attribute, unit,
                   MIN(period) as from_yr, MAX(period) as to_yr,
                   COUNT(DISTINCT location) as n_locs,
                   COUNT(*) as n_rows
            FROM data_points
            GROUP BY domain, attribute
            ORDER BY domain, attribute
            LIMIT 300
        `).all()

        // What locations have data
        const { results: locs } = await DB.prepare(
            `SELECT DISTINCT location FROM data_points WHERE location != 'Armenia' ORDER BY location LIMIT 30`
        ).all()

        // Domain row counts
        const { results: domainCounts } = await DB.prepare(
            `SELECT domain, COUNT(*) as n FROM data_points GROUP BY domain ORDER BY n DESC`
        ).all()

        let schema = STATIC_SCHEMA + '\n=== LIVE DATA CATALOG (data_points) ===\n'
        schema += `Total rows: ${domainCounts.reduce((s, d) => s + d.n, 0)}\n`
        schema += domainCounts.map(d => `  ${d.domain}: ${d.n} rows`).join('\n') + '\n'

        let prevDomain = ''
        for (const row of catalog) {
            if (row.domain !== prevDomain) { schema += `\n[${row.domain}]\n`; prevDomain = row.domain }
            const locNote = row.n_locs > 1 ? ` [${row.n_locs} locations]` : ''
            schema += `  "${row.attribute}" (${row.unit || 'no unit'}) ${row.from_yr || ''}–${row.to_yr || ''}${locNote}\n`
        }

        if (locs.length) {
            schema += `\nLocations with data beyond 'Armenia': ${locs.map(l => l.location).join(', ')}\n`
        }

        return schema
    } catch (e) {
        console.error('buildDynamicSchema:', e.message)
        return STATIC_SCHEMA
    }
}

// ─────────────────────────────────────────────────────────────
// QUERY CACHE HELPERS
// ─────────────────────────────────────────────────────────────

function normalizeQuery(q) {
    return q.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function querySlug(q) {
    return normalizeQuery(q).replace(/\s+/g, '_').slice(0, 100)
}

async function cacheCheck(DB, question) {
    const norm = normalizeQuery(question)
    const hash = await sha256Hex(norm)
    const slug = querySlug(question)

    // Exact hash match
    try {
        const exact = await DB.prepare(
            'SELECT * FROM query_cache WHERE hash = ?'
        ).bind(hash).first()
        if (exact) {
            await DB.prepare(
                'UPDATE query_cache SET hit_count=hit_count+1, last_hit_at=CURRENT_TIMESTAMP WHERE hash=?'
            ).bind(hash).run()
            return { hit: 'exact', entry: exact, hash, slug }
        }
    } catch { /* table may not exist */ }

    // Fuzzy slug overlap (>60% keywords in common)
    try {
        const words = norm.split(' ').filter(w => w.length > 3)
        if (words.length > 1) {
            const { results: candidates } = await DB.prepare(
                'SELECT * FROM query_cache WHERE researched=1 LIMIT 50'
            ).all()
            for (const c of candidates) {
                const cWords = c.slug.split('_').filter(w => w.length > 3)
                const common = words.filter(w => cWords.includes(w)).length
                const score  = common / Math.max(words.length, cWords.length)
                if (score >= 0.6) {
                    await DB.prepare(
                        'UPDATE query_cache SET hit_count=hit_count+1, last_hit_at=CURRENT_TIMESTAMP WHERE id=?'
                    ).bind(c.id).run()
                    return { hit: 'fuzzy', entry: c, hash, slug }
                }
            }
        }
    } catch { /* non-fatal */ }

    return { hit: 'none', entry: null, hash, slug }
}

async function cacheStore(DB, { hash, slug, original_query, sql_generated, data_domain, result_count, researched }) {
    try {
        await DB.prepare(`
            INSERT INTO query_cache (hash, slug, original_query, sql_generated, data_domain, result_count, researched, hit_count, last_hit_at)
            VALUES (?,?,?,?,?,?,?,1,CURRENT_TIMESTAMP)
            ON CONFLICT(hash) DO UPDATE SET
              sql_generated=excluded.sql_generated, result_count=excluded.result_count,
              researched=MAX(researched, excluded.researched),
              hit_count=hit_count+1, last_hit_at=CURRENT_TIMESTAMP
        `).bind(hash, slug, original_query, sql_generated || null, data_domain || null, result_count || 0, researched ? 1 : 0).run()
    } catch { /* non-fatal */ }
}

// ─────────────────────────────────────────────────────────────
// ON-DEMAND RESEARCH (Brave Search + Jina Reader + AI extract)
// ─────────────────────────────────────────────────────────────

async function braveSearch(query, apiKey) {
    try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
        })
        if (!res.ok) { console.warn(`Brave ${res.status}`); return [] }
        const data = await res.json()
        return (data.web?.results || []).map(r => ({ title: r.title, url: r.url, description: r.description || '' }))
    } catch (e) { console.warn('Brave search:', e.message); return [] }
}

async function fetchJina(pageUrl) {
    try {
        const res = await fetch(`https://r.jina.ai/${pageUrl}`, {
            headers: { 'Accept': 'text/plain', 'X-Timeout': '10' },
        })
        if (!res.ok) return ''
        return (await res.text()).slice(0, 5000)
    } catch { return '' }
}

async function aiExtractDataPoints(question, corpus, apiKey) {
    const system = `Armenian market intelligence analyst. Extract structured data from the provided web content.
Return JSON:
{
  "domain": "one of: demographics|economy|business|health|environment|labor|education|technology|banking|social|politics|geography",
  "category": "sub-topic slug e.g. cigarette_brands",
  "rows": [
    { "entity": "name", "attribute": "metric_name", "value_text": "text", "value_num": 123.4, "unit": "%", "location": "Armenia or city", "period": "2024", "confidence": "high|medium|low" }
  ],
  "source_name": "Publication or site name",
  "not_found": false
}
Rules: entity = thing measured; attribute = metric; location = "Armenia" if national; period = year string; not_found=true if no relevant data; ONLY valid JSON.`
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: `Question: ${question}\n\nWeb content:\n${corpus}` },
                ],
                max_tokens: 1500, temperature: 0,
            }),
        })
        const data = await res.json()
        const raw = data.choices?.[0]?.message?.content?.trim() || '{}'
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
        return JSON.parse(cleaned)
    } catch (e) { console.error('aiExtract:', e.message); return { not_found: true } }
}

async function storeDataPoints(DB, domain, category, rows, sourceName, sourceUrl) {
    let count = 0
    for (const row of rows) {
        try {
            const r = await DB.prepare(`
                INSERT OR IGNORE INTO data_points
                  (domain, category, entity, attribute, value_text, value_num, unit, location, period, source_name, source_url, confidence)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            `).bind(
                domain || 'general',
                category || null,
                row.entity || '',
                row.attribute || 'value',
                row.value_text || null,
                typeof row.value_num === 'number' ? row.value_num : null,
                row.unit || null,
                row.location || 'Armenia',
                row.period || String(new Date().getFullYear()),
                row.source_name || sourceName || '',
                sourceUrl || null,
                ['high','medium','low','ai_inferred'].includes(row.confidence) ? row.confidence : 'medium',
            ).run()
            if (r.meta?.changes > 0) count++
        } catch { /* duplicate */ }
    }
    return count
}

// Full research pipeline — returns { rows, fromCache, domain, category } or null
async function researchQuestion(question, DB, openaiKey, braveKey) {
    // Step 1: Brave search
    const searchResults = await braveSearch(`${question} Armenia`, braveKey)
    if (!searchResults.length) return null

    // Step 2: Fetch top 3 pages via Jina (free)
    const pages = await Promise.all(searchResults.slice(0, 3).map(r => fetchJina(r.url)))
    const corpus = searchResults.slice(0, 3).map((r, i) =>
        `[${r.title}] ${r.url}\n${r.description}\n${pages[i] || ''}`
    ).join('\n\n---\n\n')

    if (!corpus.trim()) return null

    // Step 3: AI extracts structured rows
    const extracted = await aiExtractDataPoints(question, corpus, openaiKey)
    if (extracted.not_found || !extracted.rows?.length) return null

    // Step 4: Store into data_points
    await storeDataPoints(DB, extracted.domain, extracted.category, extracted.rows, extracted.source_name, searchResults[0]?.url)

    return { rows: extracted.rows, fromCache: false, domain: extracted.domain, category: extracted.category }
}

// Generate answer + structured rows directly from AI knowledge (last-resort fallback)
async function aiGenerateFromKnowledge(question, apiKey) {
    const system = `You are an Armenian market intelligence expert with deep knowledge of Armenia's economy, demographics, businesses, society, politics, and geography.
The user's question could not be answered from the database or web research. Use your own knowledge to answer it.

Return ONLY valid JSON:
{
  "answer": "A clear, factual 2-5 sentence answer based on your knowledge. Be specific with numbers/dates where you know them.",
  "domain": "one of: demographics|economy|business|health|environment|labor|education|technology|banking|social|politics|geography|general",
  "category": "sub-topic slug e.g. cigarette_brands or gdp_growth",
  "rows": [
    { "entity": "subject name", "attribute": "metric name", "value_text": "text value", "value_num": null, "unit": "", "location": "Armenia", "period": "2024", "confidence": "ai_inferred" }
  ],
  "not_found": false
}

Rules:
- If you genuinely do not know, set not_found=true and give a short honest answer
- rows[] should capture any specific facts/figures from your answer as structured data (can be empty [])
- value_num: use a number if the value is numeric, else null
- confidence MUST be "ai_inferred" for every row
- period: best-known year/range; use current year if unclear
- ONLY return valid JSON, no markdown`

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: question },
                ],
                max_tokens: 800, temperature: 0.3,
            }),
        })
        const data = await res.json()
        const raw = data.choices?.[0]?.message?.content?.trim() || '{}'
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
        return JSON.parse(cleaned)
    } catch (e) { console.error('aiGenerateFromKnowledge:', e.message); return { not_found: true } }
}


// ─────────────────────────────────────────────────────────────
// 3-STEP AI PIPELINE
// Step 1: introspect live catalog
// Step 2: AI decides — data exists (→ SQL) or missing (→ "needs_research")
// Step 3: execute SQL or trigger research then re-query
// ─────────────────────────────────────────────────────────────

async function aiPlan(question, schema, apiKey) {
    const system = `You are a SQL expert for an Armenian analytics database.

${schema}

Your task:
1. Examine the LIVE DATA CATALOG above
2. Decide if relevant data exists for the user's question
3. If YES: return a precise SQL SELECT query using actual column values from the catalog
4. If NO:  return exactly the string: NEEDS_RESEARCH

Rules for SQL:
- SELECT only, no semicolon, LIMIT 50
- Use data_points for all statistical/demographic/economic/business data
- Use entities for companies/brands/organizations
- Match attribute names EXACTLY as shown in the catalog
- For regional data: WHERE location != 'Armenia'
- For national data: WHERE location = 'Armenia' OR WHERE entity = 'Armenia'

Return ONLY the SQL or ONLY the string NEEDS_RESEARCH — no explanation, no markdown.`

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: question },
                ],
                max_tokens: 500, temperature: 0,
            }),
        })
        const data = await res.json()
        const raw = data.choices?.[0]?.message?.content?.trim() || ''
        return raw.replace(/^```sql\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').replace(/;$/, '').trim()
    } catch (e) {
        console.error('aiPlan:', e.message)
        // DB not available here — caller logs if needed
        return 'NEEDS_RESEARCH'
    }
}

async function aiInterpret(question, sql, results, apiKey, note = '') {
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a concise Armenian market analytics assistant. Interpret query results in 2-4 sentences. Be specific with numbers. If web research was used, mention it briefly.' },
                    { role: 'user', content: `${note}Question: ${question}\nSQL: ${sql}\nResults (first 15): ${JSON.stringify(results.slice(0, 15))}\nTotal: ${results.length}` },
                ],
                max_tokens: 350, temperature: 0.4,
            }),
        })
        const data = await res.json()
        return data.choices?.[0]?.message?.content?.trim() || null
    } catch { return null }
}

function isSafeSQL(sql) {
    if (!sql || sql === 'NEEDS_RESEARCH') return false
    const upper = sql.trim().toUpperCase()
    if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) return false
    const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'REPLACE', 'PRAGMA', 'ATTACH']
    if (blocked.some(k => new RegExp(`\\b${k}\\b`).test(upper))) return false
    // Block internal tables (data tables are allowed)
    if (/\b(users|audit_log|rate_limit_log|ip_rules|user_totp|threat_cache|anomaly_events|scraper_jobs|chat_history|rate_limits|query_cache)\b/i.test(sql)) return false
    return true
}

// Keyword fallback SQL using data_points + entities
function nlpToSQL(question) {
    const q = question.toLowerCase()

    if (q.match(/compan|business|firm|brand|startup/)) {
        if (q.match(/top|revenue|biggest|largest/))
            return "SELECT name, type, industry, revenue_amd, employee_count, city FROM entities WHERE revenue_amd IS NOT NULL ORDER BY revenue_amd DESC LIMIT 10"
        if (q.match(/tech|it\b|software/))
            return "SELECT name, type, industry, employee_count, city FROM entities WHERE industry LIKE '%tech%' OR industry LIKE '%IT%' OR industry LIKE '%software%' ORDER BY employee_count DESC LIMIT 20"
        return "SELECT name, type, industry, city, employee_count FROM entities ORDER BY created_at DESC LIMIT 20"
    }
    if (q.match(/news|article|headline/)) {
        const cats = { tech: 'technology', econom: 'economy', politi: 'politics', sport: 'sports', cultur: 'culture', health: 'health' }
        for (const [key, cat] of Object.entries(cats)) {
            if (q.includes(key)) return `SELECT title, summary, source, category, published_date FROM news_articles WHERE category = '${cat}' ORDER BY published_date DESC LIMIT 20`
        }
        return "SELECT title, summary, source, category, published_date FROM news_articles ORDER BY published_date DESC LIMIT 20"
    }
    if (q.match(/population|demographic/))
        return "SELECT entity, attribute, value_num, unit, period, location FROM data_points WHERE domain='demographics' ORDER BY period DESC LIMIT 30"
    if (q.match(/gdp|econom|growth/))
        return "SELECT entity, attribute, value_num, unit, period FROM data_points WHERE domain='economy' ORDER BY period DESC LIMIT 30"
    if (q.match(/exchange|rate|amd|usd|eur/))
        return "SELECT base, target, rate, date FROM exchange_rates ORDER BY date DESC LIMIT 20"
    if (q.match(/health|hospital|doctor|physician/))
        return "SELECT attribute, value_num, unit, period FROM data_points WHERE domain='health' ORDER BY period DESC LIMIT 20"
    if (q.match(/labor|employ|unemployment/))
        return "SELECT attribute, value_num, unit, period FROM data_points WHERE domain='labor' ORDER BY period DESC LIMIT 20"

    return `SELECT 'data_points' AS tbl, COUNT(*) AS n FROM data_points
            UNION ALL SELECT 'entities', COUNT(*) FROM entities
            UNION ALL SELECT 'news_articles', COUNT(*) FROM news_articles`
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

app.post('/auth/2fa/setup', (c) => requireAuth(c, async () => {
    const user = c.get('user')
    const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)))
    const uri = totpUri(secret, user.email)
    await c.env.DB.prepare(
        'INSERT INTO user_totp (user_id, secret_b32, enabled) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET secret_b32 = ?, enabled = 0, updated_at = CURRENT_TIMESTAMP'
    ).bind(user.id, secret, secret).run()
    return c.json({ success: true, secret, uri, qr: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(uri)}&size=200x200` })
}))

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
// ROUTES — CHAT (3-step AI pipeline with query cache)
// ─────────────────────────────────────────────────────────────

app.post('/chat', (c) => requireAuth(c, async () => {
    const { DB, OPENAI_API_KEY, BRAVE_API_KEY } = c.env
    const user = c.get('user')
    const ip   = getIp(c)
    const { message, sessionId = crypto.randomUUID() } = await c.req.json()
    if (!message) return c.json({ error: 'Message is required' }, 400)

    const allowed = await checkRateLimit(DB, `chat:${user.id}`, { windowMs: 60_000, max: 60 })
    if (!allowed) return c.json({ success: false, error: 'Too many requests' }, 429)

    const sqli = detectSQLi(message)
    if (sqli.isInjection) {
        await audit(DB, { userId: user.id, action: 'sqli_attempt', ip, metadata: { findings: sqli.findings, message }, severity: 'critical' })
        return c.json({ success: false, response: 'I detected potentially malicious input in your message.' })
    }

    let sql = null
    let sqlSource = 'keyword'
    let results = []
    let researched = false
    let researchDomain = null

    // ── Step 0: Query cache check ────────────────────────────
    const cache = await cacheCheck(DB, message)

    if (cache.hit !== 'none' && cache.entry?.sql_generated) {
        // Cache hit: run the stored SQL directly
        sql = cache.entry.sql_generated
        sqlSource = `cache_${cache.hit}`
        try {
            const { results: rows } = await DB.prepare(sql).all()
            results = rows || []
        } catch { /* cached SQL failed, fall through */ }
    }

    // ── Step 1: Introspect live catalog ──────────────────────
    if (!results.length && OPENAI_API_KEY) {
        try {
            const schema = await buildDynamicSchema(DB)

            // ── Step 2: AI plans — returns SQL or NEEDS_RESEARCH ─
            const plan = await aiPlan(message, schema, OPENAI_API_KEY)

            if (!isSafeSQL(plan)) {
                // ── Step 3a: Research required (NEEDS_RESEARCH, empty plan, or invalid SQL) ─
                if (BRAVE_API_KEY) {
                    try {
                        const res = await researchQuestion(message, DB, OPENAI_API_KEY, BRAVE_API_KEY)
                        if (res?.rows?.length) {
                            researched = true
                            researchDomain = res.domain
                            await appLog(DB, { level: 'info', source: 'research', message: `Web research stored ${res.rows.length} rows for domain: ${res.domain}`, metadata: { question: message, domain: res.domain, rows: res.rows.length }, userId: user.id })
                            // Re-introspect now that data is stored, generate SQL
                            const freshSchema = await buildDynamicSchema(DB)
                            const freshSql = await aiPlan(message, freshSchema, OPENAI_API_KEY)
                            if (isSafeSQL(freshSql)) {
                                sql = freshSql
                                sqlSource = 'ai_research'
                                const { results: rows } = await DB.prepare(sql).all()
                                results = rows?.length ? rows : res.rows
                            } else {
                                results = res.rows
                                sqlSource = 'research_direct'
                            }
                        }
                    } catch (e) {
                        console.error('research:', e.message)
                        await appLog(DB, { level: 'error', source: 'research', message: e.message, userId: user.id })
                    }
                }
            } else if (isSafeSQL(plan)) {
                // ── Step 3b: Execute AI-generated SQL ────────────
                sql = plan
                sqlSource = 'ai'
                try {
                    const { results: rows } = await DB.prepare(sql).all()
                    results = rows || []

                    // If DB returned nothing, still try research
                    if (!results.length && BRAVE_API_KEY) {
                        try {
                            const res = await researchQuestion(message, DB, OPENAI_API_KEY, BRAVE_API_KEY)
                            if (res?.rows?.length) {
                                researched = true
                                researchDomain = res.domain
                                const freshSchema = await buildDynamicSchema(DB)
                                const freshSql = await aiPlan(message, freshSchema, OPENAI_API_KEY)
                                if (isSafeSQL(freshSql)) {
                                    const { results: freshRows } = await DB.prepare(freshSql).all()
                                    if (freshRows.length) { results = freshRows; sql = freshSql; sqlSource = 'ai_research' }
                                }
                                if (!results.length) results = res.rows
                            }
                        } catch (e) {
                        console.error('research fallback:', e.message)
                        await appLog(DB, { level: 'warn', source: 'research', message: 'Research fallback failed: ' + e.message, userId: user.id })
                    }
                    }
                } catch {
                    // AI SQL failed — fallback to keyword
                    sql = nlpToSQL(message)
                    sqlSource = 'keyword_fallback'
                    try { const { results: rows } = await DB.prepare(sql).all(); results = rows || [] } catch { /* give up */ }
                }
            }
        } catch (e) {
            console.error('AI pipeline:', e.message)
            await appLog(DB, { level: 'error', source: 'ai', message: 'AI pipeline error: ' + e.message, userId: user.id })
        }
    }

    // ── Keyword fallback if nothing worked ───────────────────
    if (!results.length && !sql) {
        sql = nlpToSQL(message)
        sqlSource = 'keyword'
        try { const { results: rows } = await DB.prepare(sql).all(); results = rows || [] } catch { /* give up */ }
    }

    // ── AI knowledge fallback — always give an answer ─────────
    let aiKnowledgeAnswer = null
    if (!results.length && OPENAI_API_KEY) {
        try {
            const generated = await aiGenerateFromKnowledge(message, OPENAI_API_KEY)
            if (generated && !generated.not_found) {
                aiKnowledgeAnswer = generated.answer || null
                if (generated.rows?.length) {
                    await storeDataPoints(DB, generated.domain, generated.category, generated.rows, 'AI Knowledge Base', null)
                    results = generated.rows
                    researchDomain = generated.domain
                    sqlSource = 'ai_knowledge'
                    // Generate SQL now that data is in DB — so cache stores a real query for next time
                    try {
                        const freshSchema = await buildDynamicSchema(DB)
                        const freshSql = await aiPlan(message, freshSchema, OPENAI_API_KEY)
                        if (isSafeSQL(freshSql)) {
                            const { results: freshRows } = await DB.prepare(freshSql).all()
                            if (freshRows?.length) { results = freshRows; sql = freshSql }
                        }
                    } catch { /* non-fatal — use stored rows */ }
                }
                researched = true
                await appLog(DB, { level: 'info', source: 'ai', message: `AI knowledge used for: "${message.slice(0, 120)}"`, metadata: { domain: generated.domain, rows: generated.rows?.length ?? 0 }, userId: user.id })
            }
        } catch (e) {
            console.error('aiKnowledge:', e.message)
            await appLog(DB, { level: 'warn', source: 'ai', message: 'AI knowledge fallback failed: ' + e.message, userId: user.id })
        }
    }

    // ── AI interprets results ────────────────────────────────
    let response = results.length
        ? `Found ${results.length} result${results.length === 1 ? '' : 's'} for your query.`
        : aiKnowledgeAnswer
        || 'I searched the database and web but could not find reliable data for this topic about Armenia.'

    if (OPENAI_API_KEY && results.length) {
        try {
            const note = researched ? '[Note: Data was fetched from the web and/or generated from AI knowledge and stored for future queries.]\n' : ''
            const interpreted = await aiInterpret(message, sql || '', results, OPENAI_API_KEY, note)
            if (interpreted) response = interpreted
        } catch (e) { console.error('aiInterpret:', e.message) }
    } else if (aiKnowledgeAnswer && !results.length) {
        response = aiKnowledgeAnswer
    }

    // ── Store in query cache ─────────────────────────────────
    if (cache.hit === 'none') {
        await cacheStore(DB, {
            hash: cache.hash,
            slug: cache.slug,
            original_query: message,
            sql_generated: sql,
            data_domain: researchDomain,
            result_count: results.length,
            researched,
        })
    }

    await DB.prepare(
        'INSERT INTO chat_history (session_id, user_id, user_message, generated_sql, result_count, assistant_response) VALUES (?,?,?,?,?,?)'
    ).bind(sessionId, user.id, message, sql, results.length, response).run()
    await audit(DB, { userId: user.id, action: 'query', ip, metadata: { sessionId, resultCount: results.length, sqlSource, researched } })

    return c.json({
        success: true, message, response,
        data: results, dataCount: results.length,
        sql, sqlSource, researched,
        sessionId,
    })
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
// ROUTES — ON-DEMAND RESEARCH
// ─────────────────────────────────────────────────────────────

app.post('/research', (c) => requireAuth(c, async () => {
    const { DB, OPENAI_API_KEY, BRAVE_API_KEY } = c.env
    const user = c.get('user')
    const ip = getIp(c)

    if (!BRAVE_API_KEY) return c.json({ success: false, error: 'BRAVE_API_KEY not configured' }, 503)
    if (!OPENAI_API_KEY) return c.json({ success: false, error: 'OPENAI_API_KEY not configured' }, 503)

    const { question } = await c.req.json()
    if (!question?.trim()) return c.json({ success: false, error: 'question is required' }, 400)

    const allowed = await checkRateLimit(DB, `research:${user.id}`, { windowMs: 60_000, max: 5 })
    if (!allowed) return c.json({ success: false, error: 'Too many research requests. Max 5/minute.' }, 429)

    const result = await researchQuestion(question, DB, OPENAI_API_KEY, BRAVE_API_KEY)

    await audit(DB, {
        userId: user.id, action: 'research', ip,
        metadata: { question, rowsFound: result?.rows?.length ?? 0, domain: result?.domain }
    })

    if (!result) return c.json({ success: false, message: 'No data found for this question.' })

    return c.json({
        success: true, question,
        domain: result.domain, category: result.category,
        rowsFound: result.rows.length,
        data: result.rows,
        message: `Researched and stored ${result.rows.length} data points (domain: ${result.domain}).`,
    })
}))

// ─────────────────────────────────────────────────────────────
// ROUTES — SQL EDITOR (restricted to data tables)
// ─────────────────────────────────────────────────────────────

app.post('/sql/execute', (c) => requireAuth(c, async () => {
    const user = c.get('user')
    const ip = getIp(c)
    const { sql } = await c.req.json()
    if (!sql?.trim()) return c.json({ success: false, error: 'SQL is required' }, 400)

    const allowed = await checkRateLimit(c.env.DB, `sql:${user.id}`, { windowMs: 60_000, max: 20 })
    if (!allowed) return c.json({ success: false, error: 'Too many requests' }, 429)

    const sqli = detectSQLi(sql)
    if (sqli.isInjection) {
        await audit(c.env.DB, { userId: user.id, action: 'sqli_attempt', ip, metadata: { findings: sqli.findings }, severity: 'critical' })
        return c.json({ success: false, error: 'Potentially malicious SQL detected' }, 400)
    }

    const upper = sql.trim().toUpperCase()
    const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'REPLACE', 'PRAGMA']
    if (blocked.some(k => upper.startsWith(k) || upper.includes(` ${k} `)))
        return c.json({ success: false, error: 'Only SELECT queries are allowed' }, 400)

    // Block internal/system tables — data tables (data_points, entities, news_*, exchange_rates) are queryable
    const PRIVATE = ['users', 'sessions', 'audit_log', 'ip_rules', 'anomalies', 'totp_secrets', 'rate_limits', 'scraper_jobs', 'chat_history', 'threat_cache', 'anomaly_events', 'rate_limit_log', 'user_totp', 'query_cache']
    const mentionedPrivate = PRIVATE.filter(t => new RegExp(`(?<![\\w])${t}(?![\\w])`, 'i').test(sql))
    if (mentionedPrivate.length > 0) {
        await audit(c.env.DB, { userId: user.id, action: 'sql_blocked_private_table', ip, metadata: { tables: mentionedPrivate, sql: sql.slice(0, 200) }, severity: 'high' })
        return c.json({ success: false, error: `Access denied: [${mentionedPrivate.join(', ')}] are restricted. Queryable: data_points, entities, news_articles, exchange_rates.` }, 403)
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
// ROUTES — DATA SUMMARY
// ─────────────────────────────────────────────────────────────

app.get('/data/summary', (c) => requireAuth(c, async () => {
    const DB = c.env.DB
    const [dpRow, entRow, newsRow, jobsRow] = await Promise.all([
        DB.prepare('SELECT COUNT(*) AS n FROM data_points').first(),
        DB.prepare('SELECT COUNT(*) AS n FROM entities').first(),
        DB.prepare('SELECT COUNT(*) AS n FROM news_articles').first(),
        DB.prepare("SELECT COUNT(*) AS n FROM scraper_jobs WHERE status='completed'").first(),
    ])
    const { results: domainBreakdown } = await DB.prepare(
        'SELECT domain, COUNT(*) as n FROM data_points GROUP BY domain ORDER BY n DESC'
    ).all()
    const { results: recentNews } = await DB.prepare(
        'SELECT title, source, published_date FROM news_articles ORDER BY published_date DESC LIMIT 5'
    ).all()
    return c.json({
        success: true,
        summary: {
            data_points: dpRow?.n || 0,
            entities: entRow?.n || 0,
            news_articles: newsRow?.n || 0,
            scraper_jobs_completed: jobsRow?.n || 0,
        },
        domainBreakdown: domainBreakdown || [],
        recentNews: recentNews || [],
    })
}))

app.get('/data/entities', (c) => requireAuth(c, async () => {
    const type = c.req.query('type')
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const { results } = type
        ? await c.env.DB.prepare('SELECT * FROM entities WHERE type = ? ORDER BY name LIMIT ?').bind(type, limit).all()
        : await c.env.DB.prepare('SELECT * FROM entities ORDER BY created_at DESC LIMIT ?').bind(limit).all()
    return c.json({ success: true, entities: results })
}))

app.get('/data/datapoints', (c) => requireAuth(c, async () => {
    const domain = c.req.query('domain')
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const { results } = domain
        ? await c.env.DB.prepare('SELECT * FROM data_points WHERE domain = ? ORDER BY created_at DESC LIMIT ?').bind(domain, limit).all()
        : await c.env.DB.prepare('SELECT * FROM data_points ORDER BY created_at DESC LIMIT ?').bind(limit).all()
    return c.json({ success: true, data_points: results })
}))

// ─────────────────────────────────────────────────────────────
// ROUTES — SECURITY (admin + self-serve)
// ─────────────────────────────────────────────────────────────

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

app.get('/security/ip-rules', (c) => requireAdmin(c, async () => {
    const { results } = await c.env.DB.prepare('SELECT * FROM ip_rules ORDER BY created_at DESC').all()
    return c.json({ success: true, rules: results })
}))

app.post('/security/ip-rules', (c) => requireAdmin(c, async () => {
    const { ip_or_cidr, rule_type, note } = await c.req.json()
    if (!ip_or_cidr || !['allow', 'deny'].includes(rule_type))
        return c.json({ success: false, error: 'ip_or_cidr and rule_type (allow|deny) required' }, 400)
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

app.get('/security/anomalies', (c) => requireAuth(c, async () => {
    const DB = c.env.DB
    const w15m = new Date(Date.now() - 15 * 60_000).toISOString()
    const w1h  = new Date(Date.now() - 60 * 60_000).toISOString()
    const w24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString()

    const { results: bf } = await DB.prepare(
        "SELECT ip, COUNT(*) AS n FROM audit_log WHERE action='failed_login' AND created_at > ? GROUP BY ip HAVING n > 5"
    ).bind(w15m).all()
    const { results: sf } = await DB.prepare(
        "SELECT source_name, error_message, started_at FROM scraper_jobs WHERE status='failed' AND started_at > ? ORDER BY started_at DESC LIMIT 10"
    ).bind(w24h).all()
    const { results: sqli } = await DB.prepare(
        "SELECT user_id, metadata, created_at FROM audit_log WHERE action='sqli_attempt' AND created_at > ? ORDER BY created_at DESC"
    ).bind(w1h).all()

    const inserts = []
    for (const row of bf) inserts.push(DB.prepare(
        "INSERT OR IGNORE INTO anomaly_events (event_type, target, details, severity) VALUES ('brute_force', ?, ?, 'high')"
    ).bind(row.ip, JSON.stringify(row)))
    for (const row of sqli) inserts.push(DB.prepare(
        "INSERT OR IGNORE INTO anomaly_events (event_type, target, details, severity) VALUES ('sqli_attempt', ?, ?, 'critical')"
    ).bind(String(row.user_id), JSON.stringify(row)))
    if (inserts.length) await DB.batch(inserts)

    const { results: events } = await DB.prepare(
        'SELECT * FROM anomaly_events WHERE resolved = 0 ORDER BY created_at DESC LIMIT 50'
    ).all()
    return c.json({ success: true, events, signals: { brute_force: bf, scraper_failures: sf, sqli_attempts: sqli } })
}))

app.post('/security/anomalies/:id/resolve', (c) => requireAdmin(c, async () => {
    await c.env.DB.prepare('UPDATE anomaly_events SET resolved = 1 WHERE id = ?').bind(c.req.param('id')).run()
    return c.json({ success: true })
}))

// ─────────────────────────────────────────────────────────────
// GOOGLE OAUTH 2.0
// ─────────────────────────────────────────────────────────────

app.get('/auth/google', (c) => {
    const clientId = c.env.GOOGLE_CLIENT_ID
    if (!clientId) {
        const origin = new URL(c.req.url).origin
        return Response.redirect(`${origin}/login?error=${encodeURIComponent('Google SSO not configured.')}`, 302)
    }
    const origin      = new URL(c.req.url).origin
    const redirectUri = `${origin}/api/auth/google/callback`
    const url         = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('access_type', 'online')
    url.searchParams.set('prompt', 'select_account')
    return Response.redirect(url.toString(), 302)
})

app.get('/auth/google/callback', async (c) => {
    const origin       = new URL(c.req.url).origin
    const clientId     = c.env.GOOGLE_CLIENT_ID
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET
    const code         = c.req.query('code')
    const errParam     = c.req.query('error')

    if (errParam || !code) return Response.redirect(`${origin}/login?error=${encodeURIComponent('Google login was cancelled.')}`, 302)
    if (!clientId || !clientSecret) return Response.redirect(`${origin}/login?error=${encodeURIComponent('Google OAuth not configured.')}`, 302)

    const redirectUri = `${origin}/api/auth/google/callback`
    let tokens
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
        })
        tokens = await tokenRes.json()
        if (!tokens.access_token) throw new Error('No access token')
    } catch {
        return Response.redirect(`${origin}/login?error=${encodeURIComponent('Failed to exchange Google token.')}`, 302)
    }

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
        let user = await DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
        if (!user) {
            user = await DB.prepare(
                'INSERT INTO users (email, full_name, password_hash, role, is_active) VALUES (?,?,?,?,1) RETURNING *'
            ).bind(email, googleUser.name || email.split('@')[0], 'google-oauth', 'analyst').first()
        }
        if (!user.is_active) return Response.redirect(`${origin}/login?error=${encodeURIComponent('Account is disabled.')}`, 302)
        await DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()
        await audit(DB, { userId: user.id, action: 'google_login', ip: getIp(c) })
        const token = await signJWT({ id: user.id, email: user.email, role: user.role }, getSecret(c.env))
        return Response.redirect(`${origin}/login?token=${token}`, 302)
    } catch {
        return Response.redirect(`${origin}/login?error=${encodeURIComponent('Authentication failed.')}`, 302)
    }
})

// ─────────────────────────────────────────────────────────────
// ROUTES — ADMIN (requireAdmin middleware on every endpoint)
// ─────────────────────────────────────────────────────────────

// ── User management ──────────────────────────────────────────
app.get('/admin/users', (c) => requireAdmin(c, async () => {
    const { results } = await c.env.DB.prepare(
        'SELECT id, email, full_name, role, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC'
    ).all()
    return c.json({ success: true, users: results })
}))

app.post('/admin/users', (c) => requireAdmin(c, async () => {
    const actor = c.get('user')
    const { email, password, full_name, role = 'user' } = await c.req.json()
    if (!email || !password || password.length < 8) return c.json({ success: false, error: 'email and password (min 8 chars) required' }, 400)
    if (!['user', 'admin'].includes(role)) return c.json({ success: false, error: 'role must be user or admin' }, 400)
    try {
        const hash = await hashPassword(password)
        const user = await c.env.DB.prepare(
            'INSERT INTO users (email, full_name, password_hash, role) VALUES (?,?,?,?) RETURNING id, email, full_name, role'
        ).bind(email.toLowerCase(), full_name || email, hash, role).first()
        await audit(c.env.DB, { userId: actor.id, action: 'admin_create_user', ip: getIp(c), metadata: { targetEmail: email, role }, severity: 'medium' })
        return c.json({ success: true, user }, 201)
    } catch (e) {
        if (e.message?.includes('UNIQUE')) return c.json({ success: false, error: 'Email already exists' }, 409)
        throw e
    }
}))

app.patch('/admin/users/:id', (c) => requireAdmin(c, async () => {
    const actor = c.get('user')
    const { id } = c.req.param()
    const { role, is_active } = await c.req.json()
    if (Number(id) === actor.id) return c.json({ success: false, error: 'Cannot modify your own account' }, 400)
    const fields = [], binds = []
    if (role !== undefined) {
        if (!['user', 'admin'].includes(role)) return c.json({ success: false, error: 'role must be user or admin' }, 400)
        fields.push('role = ?'); binds.push(role)
    }
    if (is_active !== undefined) { fields.push('is_active = ?'); binds.push(is_active ? 1 : 0) }
    if (!fields.length) return c.json({ success: false, error: 'Nothing to update' }, 400)
    binds.push(id)
    await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run()
    await audit(c.env.DB, { userId: actor.id, action: 'admin_update_user', ip: getIp(c), metadata: { targetId: id, role, is_active }, severity: 'medium' })
    return c.json({ success: true })
}))

// ── Observability ────────────────────────────────────────────
app.get('/admin/stats', (c) => requireAdmin(c, async () => {
    const DB = c.env.DB
    const [dp, ent, news, qc, jobs, users] = await Promise.all([
        DB.prepare('SELECT COUNT(*) AS n FROM data_points').first(),
        DB.prepare('SELECT COUNT(*) AS n FROM entities').first(),
        DB.prepare('SELECT COUNT(*) AS n FROM news_articles').first(),
        DB.prepare('SELECT COUNT(*) AS n, SUM(hit_count) AS hits, SUM(researched) AS researched FROM query_cache').first(),
        DB.prepare("SELECT status, COUNT(*) AS n FROM scraper_jobs GROUP BY status").all(),
        DB.prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN role=\'admin\' THEN 1 ELSE 0 END) AS admins FROM users').first(),
    ])
    const { results: domainCounts } = await DB.prepare(
        'SELECT domain, COUNT(*) as n FROM data_points GROUP BY domain ORDER BY n DESC'
    ).all()
    const lastScrape = await DB.prepare(
        "SELECT source_name, completed_at FROM scraper_jobs WHERE status='completed' ORDER BY completed_at DESC LIMIT 1"
    ).first()
    return c.json({
        success: true,
        stats: {
            data_points: dp?.n || 0,
            entities: ent?.n || 0,
            news_articles: news?.n || 0,
            query_cache: { total: qc?.n || 0, total_hits: qc?.hits || 0, researched: qc?.researched || 0 },
            scraper_jobs: jobs.results || [],
            users: { total: users?.n || 0, admins: users?.admins || 0 },
            last_scrape: lastScrape || null,
        },
        domain_breakdown: domainCounts || [],
    })
}))

app.get('/admin/logs/scraper', (c) => requireAdmin(c, async () => {
    const limit  = Math.min(parseInt(c.req.query('limit') || '100'), 500)
    const status = c.req.query('status')
    let sql = 'SELECT * FROM scraper_jobs'
    const binds = []
    if (status) { sql += ' WHERE status = ?'; binds.push(status) }
    sql += ' ORDER BY started_at DESC LIMIT ?'
    binds.push(limit)
    const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
    return c.json({ success: true, logs: results })
}))

app.get('/admin/logs/app', (c) => requireAdmin(c, async () => {
    const limit  = Math.min(parseInt(c.req.query('limit') || '200'), 1000)
    const level  = c.req.query('level')
    const source = c.req.query('source')
    let sql = 'SELECT al.*, u.email FROM app_logs al LEFT JOIN users u ON al.user_id = u.id'
    const binds = []
    const where = []
    if (level)  { where.push('al.level = ?');  binds.push(level) }
    if (source) { where.push('al.source = ?'); binds.push(source) }
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY al.created_at DESC LIMIT ?'
    binds.push(limit)
    const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
    return c.json({ success: true, logs: results })
}))


app.get('/admin/logs/audit', (c) => requireAdmin(c, async () => {
    const limit    = Math.min(parseInt(c.req.query('limit') || '100'), 500)
    const action   = c.req.query('action')
    const severity = c.req.query('severity')
    const userId   = c.req.query('user_id')
    let sql = 'SELECT al.*, u.email FROM audit_log al LEFT JOIN users u ON al.user_id = u.id'
    const binds = []
    const where = []
    if (action)   { where.push('al.action = ?'); binds.push(action) }
    if (severity) { where.push('al.severity = ?'); binds.push(severity) }
    if (userId)   { where.push('al.user_id = ?'); binds.push(userId) }
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY al.created_at DESC LIMIT ?'
    binds.push(limit)
    const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
    return c.json({ success: true, logs: results })
}))

// ── Unrestricted SQL editors (both DB access, all tables allowed) ─
app.post('/admin/sql/public', (c) => requireAdmin(c, async () => {
    const actor = c.get('user')
    const { sql } = await c.req.json()
    if (!sql?.trim()) return c.json({ success: false, error: 'SQL is required' }, 400)

    const upper = sql.trim().toUpperCase()
    // Only allow read operations in the editor for safety; admin can still run writes
    // by removing this check — but we keep SELECT-only as default guard
    const allowed = ['SELECT', 'WITH', 'EXPLAIN', 'PRAGMA']
    if (!allowed.some(k => upper.startsWith(k)))
        return c.json({ success: false, error: 'Only SELECT/EXPLAIN/PRAGMA queries allowed in the SQL editor' }, 400)

    try {
        const start = Date.now()
        const { results } = await c.env.DB.prepare(sql).all()
        await audit(c.env.DB, { userId: actor.id, action: 'admin_sql_public', ip: getIp(c), metadata: { sql: sql.slice(0, 300) }, severity: 'admin' })
        return c.json({ success: true, results: results || [], executionTime: Date.now() - start })
    } catch (e) {
        return c.json({ success: false, error: e.message }, 400)
    }
}))

// ── Query cache management ───────────────────────────────────
app.get('/admin/cache', (c) => requireAdmin(c, async () => {
    const { results } = await c.env.DB.prepare(
        'SELECT id, slug, original_query, result_count, hit_count, researched, data_domain, last_hit_at, created_at FROM query_cache ORDER BY hit_count DESC LIMIT 100'
    ).all()
    return c.json({ success: true, cache: results })
}))

app.delete('/admin/cache/:id', (c) => requireAdmin(c, async () => {
    await c.env.DB.prepare('DELETE FROM query_cache WHERE id = ?').bind(c.req.param('id')).run()
    await audit(c.env.DB, { userId: c.get('user').id, action: 'admin_cache_delete', ip: getIp(c), metadata: { id: c.req.param('id') }, severity: 'medium' })
    return c.json({ success: true })
}))

// ── Data management ──────────────────────────────────────────
app.post('/admin/scrape', (c) => requireAdmin(c, async () => {
    const scraperUrl = c.env.SCRAPER_URL
    if (!scraperUrl) return c.json({ success: false, error: 'SCRAPER_URL not configured' }, 503)
    try {
        const res = await fetch(`${scraperUrl}/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
        const data = await res.json()
        await audit(c.env.DB, { userId: c.get('user').id, action: 'admin_trigger_scrape', ip: getIp(c), severity: 'medium' })
        return c.json({ success: true, result: data })
    } catch (e) {
        return c.json({ success: false, error: e.message }, 502)
    }
}))

app.post('/admin/research', (c) => requireAdmin(c, async () => {
    const { DB, OPENAI_API_KEY, BRAVE_API_KEY } = c.env
    const { question } = await c.req.json()
    if (!question?.trim()) return c.json({ success: false, error: 'question is required' }, 400)
    if (!BRAVE_API_KEY) return c.json({ success: false, error: 'BRAVE_API_KEY not configured' }, 503)
    if (!OPENAI_API_KEY) return c.json({ success: false, error: 'OPENAI_API_KEY not configured' }, 503)

    const result = await researchQuestion(question, DB, OPENAI_API_KEY, BRAVE_API_KEY)
    await audit(DB, { userId: c.get('user').id, action: 'admin_trigger_research', ip: getIp(c), metadata: { question, rowsFound: result?.rows?.length ?? 0 }, severity: 'medium' })
    if (!result) return c.json({ success: false, message: 'No data found.' })
    return c.json({ success: true, domain: result.domain, rowsFound: result.rows.length, data: result.rows })
}))

// ── Default admin seed (idempotent, reads from env vars) ─────
app.post('/admin/seed', async (c) => {
    const { DB, ADMIN_EMAIL, ADMIN_PASSWORD } = c.env
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return c.json({ success: false, error: 'ADMIN_EMAIL and ADMIN_PASSWORD must be set as secrets' }, 503)
    }
    try {
        const existing = await DB.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").first()
        if (existing) return c.json({ success: true, message: 'Admin already exists, skipped.' })

        const hash = await hashPassword(ADMIN_PASSWORD)
        const user = await DB.prepare(
            "INSERT INTO users (email, full_name, password_hash, role, is_active) VALUES (?,?,?,'admin',1) RETURNING id, email, role"
        ).bind(ADMIN_EMAIL.toLowerCase(), 'Admin', hash).first()
        return c.json({ success: true, message: 'Admin user created.', user: { id: user.id, email: user.email, role: user.role } }, 201)
    } catch (e) {
        if (e.message?.includes('UNIQUE')) return c.json({ success: true, message: 'Admin already exists (email conflict), skipped.' })
        return c.json({ success: false, error: e.message }, 500)
    }
})

// ── Threat Intel (kept from original) ───────────────────────
app.get('/security/intel/domain/:domain', (c) => requireAuth(c, async () => {
    const domain = c.req.param('domain').toLowerCase()
    if (!c.env.VIRUSTOTAL_API_KEY) return c.json({ success: false, error: 'VirusTotal API key not configured' }, 503)
    const cacheKey = await sha256Hex('vt:' + domain)
    const cached = await c.env.DB.prepare(
        "SELECT result, queried_at FROM threat_cache WHERE type='virustotal' AND query_key=?"
    ).bind(cacheKey).first()
    if (cached && Date.now() - new Date(cached.queried_at).getTime() < 3_600_000)
        return c.json({ success: true, cached: true, data: JSON.parse(cached.result) })

    const vt = await fetch(`https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`, {
        headers: { 'x-apikey': c.env.VIRUSTOTAL_API_KEY }
    })
    if (!vt.ok) return c.json({ success: false, error: `VirusTotal returned ${vt.status}` }, 502)
    const vtData = await vt.json()
    const attrs = vtData.data?.attributes ?? {}
    const stats = attrs.last_analysis_stats ?? {}
    const result = {
        domain, malicious: stats.malicious ?? 0, suspicious: stats.suspicious ?? 0,
        harmless: stats.harmless ?? 0, undetected: stats.undetected ?? 0,
        reputation: attrs.reputation ?? 0, categories: attrs.categories ?? {},
        risk_score: Math.min(100, ((stats.malicious ?? 0) * 5 + (stats.suspicious ?? 0) * 2)),
        scanned_at: new Date().toISOString()
    }
    await c.env.DB.prepare(
        "INSERT INTO threat_cache (type, query_key, result) VALUES (?,?,?) ON CONFLICT(type,query_key) DO UPDATE SET result=excluded.result, queried_at=CURRENT_TIMESTAMP"
    ).bind('virustotal', cacheKey, JSON.stringify(result)).run()
    await audit(c.env.DB, { userId: c.get('user').id, action: 'domain_check', ip: getIp(c), metadata: { domain } })
    return c.json({ success: true, cached: false, data: result })
}))

app.get('/security/intel/breach/:email', (c) => requireAuth(c, async () => {
    const email = c.req.param('email').toLowerCase()
    if (!c.env.HIBP_API_KEY) return c.json({ success: false, error: 'HIBP API key not configured' }, 503)
    const cacheKey = await sha256Hex('hibp:' + email)
    const cached = await c.env.DB.prepare(
        "SELECT result, queried_at FROM threat_cache WHERE type='hibp' AND query_key=?"
    ).bind(cacheKey).first()
    if (cached && Date.now() - new Date(cached.queried_at).getTime() < 86_400_000)
        return c.json({ success: true, cached: true, data: JSON.parse(cached.result) })

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
        result = { email, breach_count: data.length, breaches: data.map(b => ({ name: b.Name, domain: b.Domain, date: b.BreachDate, classes: b.DataClasses, verified: b.IsVerified })) }
    }
    await c.env.DB.prepare(
        "INSERT INTO threat_cache (type, query_key, result) VALUES (?,?,?) ON CONFLICT(type,query_key) DO UPDATE SET result=excluded.result, queried_at=CURRENT_TIMESTAMP"
    ).bind('hibp', cacheKey, JSON.stringify(result)).run()
    await audit(c.env.DB, { userId: c.get('user').id, action: 'breach_check', ip: getIp(c) })
    return c.json({ success: true, cached: false, data: result })
}))

// ── First-run setup (no users in DB yet) ────────────────────
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
        return c.json({ success: true, message: 'Admin account created', token, user: { id: result.id, email: result.email, role: result.role } }, 201)
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500)
    }
})

// ─────────────────────────────────────────────────────────────
// Export for CF Pages
// ─────────────────────────────────────────────────────────────
export const onRequest = (ctx) => app.fetch(ctx.request, ctx.env)
