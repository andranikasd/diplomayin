/**
 * Armenian OSINT Scraper — Cloudflare Worker
 * Runs every 6 hours via Cron Trigger
 * Uses native fetch (no puppeteer, no axios needed)
 * Stores results directly in D1
 */

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
]

let uaIdx = 0
function nextUA() { return USER_AGENTS[uaIdx++ % USER_AGENTS.length] }

async function fetchPage(url) {
    const origin = new URL(url).origin
    const res = await fetch(url, {
        headers: {
            'User-Agent': nextUA(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Referer': origin + '/',
            'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
        cf: { cacheTtl: 0, cacheEverything: false }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res.text()
}

// Minimal HTML link/text extractor (no cheerio in CF Workers)
function extractLinks(html, baseUrl) {
    const links = []
    const origin = new URL(baseUrl).origin
    // Match <a href="...">text</a> patterns
    const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let match
    while ((match = pattern.exec(html)) !== null) {
        let href = match[1].trim()
        const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue
        if (!href.startsWith('http')) href = href.startsWith('/') ? origin + href : baseUrl + '/' + href
        if (text.length > 5) links.push({ href, text })
    }
    return links
}

function extractMeta(html, prop) {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
    return m ? m[1].trim() : null
}

async function createJob(DB, jobType, sourceName, sourceUrl) {
    const result = await DB.prepare(
        "INSERT INTO scraper_jobs (job_type, source_name, source_url, status) VALUES (?, ?, ?, 'pending') RETURNING id"
    ).bind(jobType, sourceName, sourceUrl).first()
    return result.id
}

async function finishJob(DB, jobId, status, itemsScraped, error = null) {
    const ts = status === 'running' ? ', started_at = CURRENT_TIMESTAMP' : ', completed_at = CURRENT_TIMESTAMP'
    await DB.prepare(
        `UPDATE scraper_jobs SET status = ?, items_scraped = ?, error_message = ?${ts} WHERE id = ?`
    ).bind(status, itemsScraped, error, jobId).run()
}

async function saveArticle(DB, article) {
    try {
        await DB.prepare(`
            INSERT INTO news_articles (title, summary, source, source_url, published_date, category, sentiment, language)
            VALUES (?, ?, ?, ?, ?, ?, 'neutral', 'en')
            ON CONFLICT(source_url) DO NOTHING
        `).bind(
            article.title.slice(0, 490),
            article.summary || null,
            article.source,
            article.url,
            article.date || new Date().toISOString(),
            article.category || 'general'
        ).run()
        return true
    } catch { return false }
}

function guessCategory(url = '', text = '') {
    const s = (url + ' ' + text).toLowerCase()
    if (s.match(/tech|it\b|software|digital|startup/)) return 'technology'
    if (s.match(/econom|financ|business|market|trade/)) return 'economy'
    if (s.match(/politi|govern|parliament|election|minister/)) return 'politics'
    if (s.match(/sport|football|tennis|olympic/)) return 'sports'
    if (s.match(/cultur|art|music|film|festival/)) return 'culture'
    if (s.match(/health|medic|hospital|covid/)) return 'health'
    if (s.match(/world|international|global|foreign/)) return 'world'
    return 'general'
}

// ── news.am scraper ──────────────────────────────────────────

async function scrapeNewsAm(DB) {
    const SOURCE = 'News.am'
    const URL = 'https://news.am/eng/'
    const jobId = await createJob(DB, 'news', SOURCE, URL)
    await finishJob(DB, jobId, 'running', 0)

    try {
        const html = await fetchPage(URL)
        const links = extractLinks(html, URL)
        let count = 0

        // Filter to article URLs (news.am uses /news/NNNN pattern)
        const articles = links.filter(l => l.href.match(/news\.am\/eng\/news\/\d+/)).slice(0, 20)

        for (const { href, text } of articles) {
            if (text.length < 10) continue
            const category = guessCategory(href, text)
            // Try to get OG description for summary
            let summary = null
            try {
                const articleHtml = await fetchPage(href)
                summary = extractMeta(articleHtml, 'og:description') || extractMeta(articleHtml, 'description')
                await new Promise(r => setTimeout(r, 800))
            } catch {}

            const saved = await saveArticle(DB, { title: text, summary, source: SOURCE, url: href, category })
            if (saved) count++
        }

        await finishJob(DB, jobId, 'completed', count)
        console.log(`✅ news.am: ${count} articles saved`)
        return count
    } catch (e) {
        await finishJob(DB, jobId, 'failed', 0, e.message)
        console.error(`❌ news.am: ${e.message}`)
        return 0
    }
}

// ── Armenpress scraper ───────────────────────────────────────

async function scrapeArmenpress(DB) {
    const SOURCE = 'Armenpress'
    const URL = 'https://armenpress.am/eng/news/'
    const jobId = await createJob(DB, 'news', SOURCE, URL)
    await finishJob(DB, jobId, 'running', 0)

    try {
        const html = await fetchPage(URL)
        const links = extractLinks(html, URL)
        let count = 0

        const articles = links.filter(l => l.href.match(/armenpress\.am\/eng\/news\/\d+/)).slice(0, 20)

        for (const { href, text } of articles) {
            if (text.length < 10) continue
            const category = guessCategory(href, text)
            let summary = null
            try {
                const articleHtml = await fetchPage(href)
                summary = extractMeta(articleHtml, 'og:description') || extractMeta(articleHtml, 'description')
                await new Promise(r => setTimeout(r, 800))
            } catch {}

            const saved = await saveArticle(DB, { title: text, summary, source: SOURCE, url: href, category })
            if (saved) count++
        }

        await finishJob(DB, jobId, 'completed', count)
        console.log(`✅ Armenpress: ${count} articles saved`)
        return count
    } catch (e) {
        await finishJob(DB, jobId, 'failed', 0, e.message)
        console.error(`❌ Armenpress: ${e.message}`)
        return 0
    }
}

// ── Armstat RSS scraper (uses their RSS feed — more reliable) ─

async function scrapeArmstatRSS(DB) {
    const SOURCE = 'armstat.am'
    const URL = 'https://www.armstat.am/en/?nid=82'
    const jobId = await createJob(DB, 'statistics', SOURCE, URL)
    await finishJob(DB, jobId, 'running', 0)

    try {
        const html = await fetchPage(URL)
        // Parse table rows from armstat
        const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
        let count = 0
        let match
        while ((match = rowPattern.exec(html)) !== null) {
            const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
                m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
            )
            if (cells.length >= 2 && cells[0] && cells[1] && !isNaN(parseFloat(cells[1].replace(/[^0-9.-]/g, '')))) {
                const indicator = cells[0].slice(0, 250)
                const value = parseFloat(cells[1].replace(/[^0-9.-]/g, '')) || null
                const unit = cells[1].match(/%|USD|AMD|EUR|mln|bln|thousand/i)?.[0] || null
                const period = cells[2] || new Date().getFullYear().toString()

                try {
                    await DB.prepare(
                        'INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
                    ).bind('economy', indicator, value, unit, period, SOURCE, URL).run()
                    count++
                } catch {}
            }
        }

        await finishJob(DB, jobId, 'completed', count)
        console.log(`✅ armstat.am: ${count} stats saved`)
        return count
    } catch (e) {
        await finishJob(DB, jobId, 'failed', 0, e.message)
        console.error(`❌ armstat.am: ${e.message}`)
        return 0
    }
}

// ── Main Worker handler ──────────────────────────────────────

export default {
    // Cron trigger (scheduled)
    async scheduled(_event, env, ctx) {
        console.log('🕐 Cron scrape started:', new Date().toISOString())
        ctx.waitUntil(Promise.allSettled([
            scrapeNewsAm(env.DB),
            scrapeArmenpress(env.DB),
            scrapeArmstatRSS(env.DB),
        ]).then(results => {
            console.log('✅ Cron scrape complete:', results.map(r => r.value || r.reason?.message))
        }))
    },

    // HTTP trigger (manual run via fetch)
    async fetch(request, env) {
        const url = new URL(request.url)
        if (url.pathname === '/scrape' && request.method === 'POST') {
            const results = await Promise.allSettled([
                scrapeNewsAm(env.DB),
                scrapeArmenpress(env.DB),
            ])
            return Response.json({
                success: true,
                results: results.map(r => ({ status: r.status, value: r.value, error: r.reason?.message }))
            })
        }
        return new Response('Armenian OSINT Scraper Worker — POST /scrape to run manually', { status: 200 })
    }
}
