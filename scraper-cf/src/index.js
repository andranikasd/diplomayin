/**
 * Armenian OSINT Scraper — Cloudflare Worker
 * Uses RSS feeds (not blocked by sites unlike direct HTML scraping)
 * Cron trigger: every 6 hours
 */

const SOURCES = [
    // news.am English RSS
    { name: 'News.am',      url: 'https://news.am/rss/news.xml',                   type: 'news' },
    // Armenpress English RSS
    { name: 'Armenpress',   url: 'https://armenpress.am/eng/rss.xml',              type: 'news' },
    // Azatutyun (RFE/RL Armenian service — English RSS, not blocked)
    { name: 'Azatutyun',    url: 'https://www.azatutyun.am/api/zmqyiuomqiuoqe',   type: 'news' },
    // EVN Report — Armenian analysis & news
    { name: 'EVN Report',   url: 'https://evnreport.com/feed/',                    type: 'news' },
    // JAMnews Armenia
    { name: 'JAMnews',      url: 'https://jam-news.net/feed/?lang=en',             type: 'news' },
]

function randomUA() {
    const uas = [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Feedly/1.0 (+http://www.feedly.com/fetcher.html; like FeedFetcher-Google)',
    ]
    return uas[Math.floor(Math.random() * uas.length)]
}

async function fetchRSS(url) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': randomUA(),
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        redirect: 'follow',
        cf: { cacheTtl: 0 }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
}

// Minimal RSS/Atom parser — no DOM parser in CF Workers
function parseRSS(xml) {
    const items = []
    // Match <item> or <entry> blocks
    const itemRx = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi
    let m
    while ((m = itemRx.exec(xml)) !== null) {
        const block = m[1]
        const title   = stripTags(getTag(block, 'title'))
        const link    = getTag(block, 'link') || getAttr(block, 'link', 'href')
        const summary = stripTags(getTag(block, 'description') || getTag(block, 'summary') || getTag(block, 'content:encoded') || '')
        const pubDate = getTag(block, 'pubDate') || getTag(block, 'published') || getTag(block, 'updated') || ''
        if (title && link) {
            items.push({
                title:   title.slice(0, 490),
                url:     link.trim(),
                summary: summary.slice(0, 800) || null,
                date:    pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            })
        }
    }
    return items
}

function getTag(xml, tag) {
    const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
        || xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
    return m ? m[1].trim() : ''
}

function getAttr(xml, tag, attr) {
    const m = xml.match(new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["']`, 'i'))
    return m ? m[1].trim() : ''
}

function stripTags(s) {
    return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

function guessCategory(text = '') {
    const s = text.toLowerCase()
    if (s.match(/tech|it\b|software|digital|startup|ai\b|cyber/)) return 'technology'
    if (s.match(/econom|financ|business|market|trade|gdp|bank/))   return 'economy'
    if (s.match(/politi|govern|parliament|election|minister/))      return 'politics'
    if (s.match(/sport|football|tennis|olympic/))                   return 'sports'
    if (s.match(/cultur|art|music|film|festival/))                  return 'culture'
    if (s.match(/health|medic|hospital|covid|pharma/))              return 'health'
    return 'general'
}

async function createJob(DB, type, source, url) {
    const r = await DB.prepare(
        "INSERT INTO scraper_jobs (job_type, source_name, source_url, status) VALUES (?,?,?,'pending') RETURNING id"
    ).bind(type, source, url).first()
    return r.id
}

async function finishJob(DB, id, status, count, err = null) {
    const col = status === 'running' ? 'started_at' : 'completed_at'
    await DB.prepare(
        `UPDATE scraper_jobs SET status=?, items_scraped=?, error_message=?, ${col}=CURRENT_TIMESTAMP WHERE id=?`
    ).bind(status, count, err, id).run()
}

async function scrapeSource(DB, source) {
    const jobId = await createJob(DB, source.type, source.name, source.url)
    await finishJob(DB, jobId, 'running', 0)

    try {
        const xml   = await fetchRSS(source.url)
        const items = parseRSS(xml).slice(0, 25)
        let count = 0

        for (const item of items) {
            const category = guessCategory(item.title + ' ' + (item.summary || ''))
            try {
                const r = await DB.prepare(`
                    INSERT INTO news_articles (title, summary, source, source_url, published_date, category, sentiment, language)
                    VALUES (?,?,?,?,?,'${category}','neutral','en')
                    ON CONFLICT(source_url) DO NOTHING
                `).bind(item.title, item.summary, source.name, item.url, item.date).run()
                if (r.meta?.changes > 0) count++
            } catch { /* skip invalid row */ }
        }

        await finishJob(DB, jobId, 'completed', count)
        console.log(`✅ ${source.name}: ${count} new articles (${items.length} fetched)`)
        return count
    } catch (e) {
        await finishJob(DB, jobId, 'failed', 0, e.message)
        console.error(`❌ ${source.name}: ${e.message}`)
        return 0
    }
}

export default {
    async scheduled(_ev, env, ctx) {
        console.log('🕐 Cron scrape:', new Date().toISOString())
        ctx.waitUntil(
            Promise.allSettled(SOURCES.map(s => scrapeSource(env.DB, s)))
                .then(results => console.log('✅ Done:', results.map(r => r.value ?? r.reason?.message)))
        )
    },

    async fetch(request, env) {
        const { pathname } = new URL(request.url)
        if (pathname === '/scrape' && request.method === 'POST') {
            const results = await Promise.allSettled(SOURCES.map(s => scrapeSource(env.DB, s)))
            const summary = results.map((r, i) => ({
                source: SOURCES[i].name,
                status: r.status,
                articles: r.value ?? 0,
                error: r.reason?.message,
            }))
            const total = summary.reduce((n, s) => n + (s.articles || 0), 0)
            return Response.json({ success: true, total_new: total, sources: summary })
        }
        return new Response('Armenian OSINT Scraper — POST /scrape to run manually', { status: 200 })
    }
}
