/**
 * Armenian OSINT Scraper — Cloudflare Worker
 *
 * PHASE 1 — COLLECTION  (cron every 6h)
 *   News   : EVN Report, JAMnews, Azatutyun, News.am, Armenpress, Google News (RSS)
 *   Stats  : World Bank API  — 80+ indicators across 9 categories → data_points
 *   Stats  : IMF DataMapper API — 9 macroeconomic series → data_points
 *   FX     : Open Exchange Rates — AMD rates → exchange_rates
 *
 * PHASE 2 — AI ENRICHMENT  (after Phase 1, requires OPENAI_API_KEY)
 *   - Extract entities + sentiment from unprocessed news_articles → entities table
 */

// ─── News RSS sources ─────────────────────────────────────────────
const NEWS_SOURCES = [
    { name: 'EVN Report',                    url: 'https://evnreport.com/feed/' },
    { name: 'JAMnews',                       url: 'https://jam-news.net/feed/?lang=en' },
    { name: 'Armenian Weekly',               url: 'https://armenianweekly.com/feed/' },
    { name: 'CivilNet',                      url: 'https://www.civilnet.am/feed/' },
    { name: 'Hetq',                          url: 'https://hetq.am/feed/' },
    { name: 'Google News - Armenia',         url: 'https://news.google.com/rss/search?q=Armenia+economy&hl=en&gl=AM&ceid=AM:en' },
    { name: 'Google News - Armenia Tech',    url: 'https://news.google.com/rss/search?q=Armenia+technology+startup&hl=en&gl=AM&ceid=AM:en' },
    { name: 'Google News - Armenia Finance', url: 'https://news.google.com/rss/search?q=Armenia+finance+investment&hl=en&gl=AM&ceid=AM:en' },
]

// ─── World Bank indicators → data_points ─────────────────────────
const WB_INDICATORS = [
    // DEMOGRAPHICS
    { code: 'SP.POP.TOTL',       name: 'Population, total',                          unit: 'persons',  cat: 'demographics' },
    { code: 'SP.POP.GROW',       name: 'Population growth rate (annual %)',           unit: '%',        cat: 'demographics' },
    { code: 'SP.URB.TOTL.IN.ZS', name: 'Urban population (% of total)',              unit: '%',        cat: 'demographics' },
    { code: 'SP.RUR.TOTL.ZS',    name: 'Rural population (% of total)',              unit: '%',        cat: 'demographics' },
    { code: 'SP.POP.0014.TO.ZS', name: 'Population ages 0-14 (% of total)',          unit: '%',        cat: 'demographics' },
    { code: 'SP.POP.1564.TO.ZS', name: 'Population ages 15-64 (% of total)',         unit: '%',        cat: 'demographics' },
    { code: 'SP.POP.65UP.TO.ZS', name: 'Population ages 65+ (% of total)',           unit: '%',        cat: 'demographics' },
    { code: 'SM.POP.NETM',       name: 'Net migration',                              unit: 'persons',  cat: 'demographics' },
    { code: 'SP.DYN.CBRT.IN',    name: 'Birth rate (per 1,000 people)',              unit: 'per 1000', cat: 'demographics' },
    { code: 'SP.DYN.CDRT.IN',    name: 'Death rate (per 1,000 people)',              unit: 'per 1000', cat: 'demographics' },
    { code: 'SP.DYN.LE00.IN',    name: 'Life expectancy at birth (years)',           unit: 'years',    cat: 'demographics' },
    { code: 'SP.DYN.IMRT.IN',    name: 'Infant mortality rate (per 1,000 births)',   unit: 'per 1000', cat: 'demographics' },
    { code: 'SP.DYN.TFRT.IN',    name: 'Fertility rate (births per woman)',          unit: 'births',   cat: 'demographics' },
    { code: 'SM.EMI.TERT.ZS',    name: 'Emigration rate of tertiary educated (%)',   unit: '%',        cat: 'demographics' },
    { code: 'SP.POP.TOTL.FE.ZS', name: 'Female population (% of total)',            unit: '%',        cat: 'demographics' },
    { code: 'SP.POP.TOTL.MA.ZS', name: 'Male population (% of total)',              unit: '%',        cat: 'demographics' },
    { code: 'SP.DYN.LE00.FE.IN', name: 'Life expectancy, female (years)',           unit: 'years',    cat: 'demographics' },
    { code: 'SP.DYN.LE00.MA.IN', name: 'Life expectancy, male (years)',             unit: 'years',    cat: 'demographics' },
    { code: 'SP.POP.DPND',       name: 'Age dependency ratio (% of working-age)',   unit: '%',        cat: 'demographics' },
    { code: 'SP.URB.TOTL',       name: 'Urban population (total persons)',          unit: 'persons',  cat: 'demographics' },
    { code: 'SP.RUR.TOTL',       name: 'Rural population (total persons)',          unit: 'persons',  cat: 'demographics' },

    // ECONOMY — GDP & GROWTH
    { code: 'NY.GDP.MKTP.CD',    name: 'GDP (current USD)',                          unit: 'USD',      cat: 'economy' },
    { code: 'NY.GDP.MKTP.KD.ZG', name: 'GDP growth rate (annual %)',                 unit: '%',        cat: 'economy' },
    { code: 'NY.GDP.PCAP.CD',    name: 'GDP per capita (current USD)',               unit: 'USD',      cat: 'economy' },
    { code: 'NY.GDP.PCAP.PP.CD', name: 'GDP per capita, PPP (current international $)', unit: 'int$', cat: 'economy' },
    { code: 'NY.GNP.PCAP.CD',    name: 'GNI per capita (current USD)',               unit: 'USD',      cat: 'economy' },
    { code: 'NY.GDP.PCAP.KD.ZG', name: 'GDP per capita growth (annual %)',           unit: '%',        cat: 'economy' },

    // ECONOMY — PRICES & MONETARY
    { code: 'FP.CPI.TOTL.ZG',    name: 'Inflation, consumer prices (annual %)',      unit: '%',        cat: 'economy' },
    { code: 'FP.CPI.TOTL',       name: 'Consumer price index (2010 = 100)',          unit: 'index',    cat: 'economy' },
    { code: 'PA.NUS.FCRF',       name: 'Official exchange rate (AMD per USD)',       unit: 'AMD/USD',  cat: 'economy' },

    // ECONOMY — TRADE & INVESTMENT
    { code: 'NE.EXP.GNFS.ZS',    name: 'Exports of goods and services (% of GDP)',  unit: '%',        cat: 'economy' },
    { code: 'NE.IMP.GNFS.ZS',    name: 'Imports of goods and services (% of GDP)',  unit: '%',        cat: 'economy' },
    { code: 'NE.TRD.GNFS.ZS',    name: 'Trade (% of GDP)',                          unit: '%',        cat: 'economy' },
    { code: 'BX.KLT.DINV.CD.WD', name: 'FDI, net inflows (current USD)',            unit: 'USD',      cat: 'economy' },
    { code: 'BM.KLT.DINV.CD.WD', name: 'FDI, net outflows (current USD)',           unit: 'USD',      cat: 'economy' },
    { code: 'BN.CAB.XOKA.GD.ZS', name: 'Current account balance (% of GDP)',        unit: '%',        cat: 'economy' },
    { code: 'BX.TRF.PWKR.DT.GD.ZS', name: 'Personal remittances received (% of GDP)', unit: '%',    cat: 'economy' },
    { code: 'BX.TRF.PWKR.CD.DT', name: 'Personal remittances received (current USD)', unit: 'USD',   cat: 'economy' },

    // ECONOMY — GOVERNMENT FINANCE
    { code: 'GC.DOD.TOTL.GD.ZS', name: 'Central government debt (% of GDP)',        unit: '%',        cat: 'economy' },
    { code: 'GC.REV.XGRT.GD.ZS', name: 'Revenue (excluding grants, % of GDP)',      unit: '%',        cat: 'economy' },
    { code: 'GC.XPN.TOTL.GD.ZS', name: 'Expenditure (% of GDP)',                   unit: '%',        cat: 'economy' },
    { code: 'GC.BAL.CASH.GD.ZS', name: 'Cash surplus/deficit (% of GDP)',           unit: '%',        cat: 'economy' },

    // LABOR
    { code: 'SL.UEM.TOTL.ZS',    name: 'Unemployment, total (% of labor force)',    unit: '%',        cat: 'labor' },
    { code: 'SL.UEM.1524.ZS',    name: 'Youth unemployment (% ages 15-24)',         unit: '%',        cat: 'labor' },
    { code: 'SL.TLF.CACT.ZS',    name: 'Labor force participation rate (%)',        unit: '%',        cat: 'labor' },
    { code: 'SL.TLF.CACT.FE.ZS', name: 'Female labor force participation (%)',      unit: '%',        cat: 'labor' },
    { code: 'SL.AGR.EMPL.ZS',    name: 'Employment in agriculture (%)',             unit: '%',        cat: 'labor' },
    { code: 'SL.IND.EMPL.ZS',    name: 'Employment in industry (%)',                unit: '%',        cat: 'labor' },
    { code: 'SL.SRV.EMPL.ZS',    name: 'Employment in services (%)',                unit: '%',        cat: 'labor' },
    { code: 'SL.POV.DDAY',       name: 'Poverty headcount ratio ($2.15/day, % pop)', unit: '%',       cat: 'labor' },

    // EDUCATION
    { code: 'SE.ADT.LITR.ZS',    name: 'Literacy rate, adult total (%)',            unit: '%',        cat: 'education' },
    { code: 'SE.PRM.ENRR',       name: 'Primary school enrollment, gross (%)',      unit: '%',        cat: 'education' },
    { code: 'SE.SEC.ENRR',       name: 'Secondary school enrollment, gross (%)',    unit: '%',        cat: 'education' },
    { code: 'SE.TER.ENRR',       name: 'Tertiary enrollment, gross (%)',            unit: '%',        cat: 'education' },
    { code: 'GB.XPD.RSDV.GD.ZS', name: 'Research and development expenditure (% of GDP)', unit: '%', cat: 'education' },
    { code: 'SE.XPD.TOTL.GD.ZS', name: 'Government expenditure on education (% of GDP)', unit: '%',  cat: 'education' },

    // HEALTH
    { code: 'SH.XPD.CHEX.GD.ZS', name: 'Current health expenditure (% of GDP)',    unit: '%',        cat: 'health' },
    { code: 'SH.MED.BEDS.ZS',    name: 'Hospital beds (per 1,000 people)',          unit: 'per 1000', cat: 'health' },
    { code: 'SH.MED.PHYS.ZS',    name: 'Physicians (per 1,000 people)',             unit: 'per 1000', cat: 'health' },
    { code: 'SH.DYN.MORT',       name: 'Mortality rate, under-5 (per 1,000)',       unit: 'per 1000', cat: 'health' },
    { code: 'SH.STA.MMRT',       name: 'Maternal mortality ratio (per 100,000)',    unit: 'per 100k', cat: 'health' },
    { code: 'SH.HIV.INCD',       name: 'HIV incidence (per 1,000 uninfected)',      unit: 'per 1000', cat: 'health' },

    // TECHNOLOGY & DIGITAL
    { code: 'IT.NET.USER.ZS',    name: 'Individuals using the Internet (% of pop)',  unit: '%',       cat: 'technology' },
    { code: 'IT.CEL.SETS.P2',    name: 'Mobile cellular subscriptions (per 100)',    unit: 'per 100', cat: 'technology' },
    { code: 'IT.NET.BBND.P2',    name: 'Fixed broadband subscriptions (per 100)',    unit: 'per 100', cat: 'technology' },
    { code: 'IT.NET.SECR.P6',    name: 'Secure Internet servers (per million)',      unit: 'per 1M',  cat: 'technology' },

    // ENVIRONMENT & ENERGY
    { code: 'EN.ATM.CO2E.PC',    name: 'CO2 emissions (metric tons per capita)',     unit: 'tonnes',  cat: 'environment' },
    { code: 'EG.USE.PCAP.KG.OE', name: 'Energy use per capita (kg of oil equiv.)',  unit: 'kg oe',   cat: 'environment' },
    { code: 'EG.ELC.ACCS.ZS',    name: 'Access to electricity (% of population)',   unit: '%',       cat: 'environment' },
    { code: 'EG.ELC.RNEW.ZS',    name: 'Renewable electricity output (% of total)', unit: '%',       cat: 'environment' },
    { code: 'ER.LND.PTLD.ZS',    name: 'Terrestrial protected areas (% of land)',   unit: '%',       cat: 'environment' },
    { code: 'AG.LND.FRST.ZS',    name: 'Forest area (% of land area)',              unit: '%',       cat: 'environment' },
    { code: 'AG.LND.ARBL.ZS',    name: 'Arable land (% of land area)',              unit: '%',       cat: 'environment' },

    // BANKING & FINANCE
    { code: 'FS.AST.DOMS.GD.ZS', name: 'Domestic credit to private sector (% GDP)', unit: '%',       cat: 'banking' },
    { code: 'FM.LBL.BMNY.GD.ZS', name: 'Broad money (% of GDP)',                   unit: '%',        cat: 'banking' },
    { code: 'FR.INR.LEND',       name: 'Lending interest rate (%)',                 unit: '%',        cat: 'banking' },
    { code: 'FR.INR.DPST',       name: 'Deposit interest rate (%)',                 unit: '%',        cat: 'banking' },
    { code: 'FB.BNK.CAPA.ZS',    name: 'Bank capital to assets ratio (%)',          unit: '%',        cat: 'banking' },
    { code: 'FB.AST.NPER.ZS',    name: 'Bank nonperforming loans (% of gross)',    unit: '%',        cat: 'banking' },
]

// ─── IMF DataMapper indicators for Armenia ────────────────────────
const IMF_INDICATORS = [
    { code: 'NGDP_RPCH',    name: 'Real GDP growth (IMF, annual %)',                  unit: '%',     cat: 'economy' },
    { code: 'PCPIPCH',      name: 'Inflation rate (IMF, annual %)',                   unit: '%',     cat: 'economy' },
    { code: 'LUR',          name: 'Unemployment rate (IMF, %)',                       unit: '%',     cat: 'labor'   },
    { code: 'BCA_NGDPD',    name: 'Current account balance (IMF, % of GDP)',          unit: '%',     cat: 'economy' },
    { code: 'GGXWDN_NGDP',  name: 'Net government debt (IMF, % of GDP)',              unit: '%',     cat: 'economy' },
    { code: 'NGDPD',        name: 'GDP, current prices (IMF, USD billions)',           unit: 'USD B', cat: 'economy' },
    { code: 'PPPGDP',       name: 'GDP, PPP (IMF, international $ billions)',         unit: 'int$ B',cat: 'economy' },
    { code: 'TM_RPCH',      name: 'Import volume of goods and services (IMF, %ch)',   unit: '%',     cat: 'economy' },
    { code: 'TX_RPCH',      name: 'Export volume of goods and services (IMF, %ch)',   unit: '%',     cat: 'economy' },
]

// ─── Fetch helpers ────────────────────────────────────────────────
function randomUA() {
    return [
        'Feedly/1.0 (+http://www.feedly.com/fetcher.html; like FeedFetcher-Google)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    ][Math.floor(Math.random() * 3)]
}

async function fetchJSON(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': randomUA(), 'Accept': 'application/json' },
        redirect: 'follow', cf: { cacheTtl: 1800 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
}

async function fetchRSS(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': randomUA(), 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' },
        redirect: 'follow', cf: { cacheTtl: 0 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
}

// ─── RSS Parser ───────────────────────────────────────────────────
function parseRSS(xml) {
    const items = []
    const itemRx = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi
    let m
    while ((m = itemRx.exec(xml)) !== null) {
        const b       = m[1]
        const title   = strip(getTag(b, 'title'))
        const link    = getTag(b, 'link') || getAttr(b, 'link', 'href')
        const summary = strip(getTag(b, 'description') || getTag(b, 'summary') || getTag(b, 'content:encoded') || '')
        const pubDate = getTag(b, 'pubDate') || getTag(b, 'published') || getTag(b, 'updated') || ''
        if (title && link) items.push({
            title: title.slice(0, 490), url: link.trim(),
            summary: summary.slice(0, 800) || null,
            date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        })
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
function strip(s) {
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

// ─── Scraper job tracking ─────────────────────────────────────────
// Column names match 0001_schema.sql: job_type, source_name, error_message, completed_at
async function startJob(DB, source) {
    try {
        const r = await DB.prepare(
            "INSERT INTO scraper_jobs (job_type, source_name, status, started_at) VALUES ('scrape', ?, 'running', CURRENT_TIMESTAMP) RETURNING id"
        ).bind(source).first()
        return r?.id ?? null
    } catch { return null }
}
async function finishJob(DB, id, status, count, errMsg = null) {
    if (!id) return
    try {
        await DB.prepare(
            'UPDATE scraper_jobs SET status=?, items_scraped=?, error_message=?, completed_at=CURRENT_TIMESTAMP WHERE id=?'
        ).bind(status, count, errMsg, id).run()
    } catch { /* non-fatal */ }
}

// ─── Insert helper: data_points ──────────────────────────────────
async function insertDataPoint(DB, { domain, category, entity, attribute, value_num, value_text, unit, location, period, source_name, source_url, confidence }) {
    try {
        const r = await DB.prepare(`
            INSERT OR IGNORE INTO data_points
              (domain, category, entity, attribute, value_num, value_text, unit, location, period, source_name, source_url, confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
            domain || 'general',
            category || null,
            entity || '',
            attribute,
            typeof value_num === 'number' ? value_num : null,
            value_text || null,
            unit || null,
            location || 'Armenia',
            period || '',
            source_name || '',
            source_url || null,
            ['high','medium','low','ai_inferred'].includes(confidence) ? confidence : 'medium',
        ).run()
        return r.meta?.changes > 0 ? 1 : 0
    } catch { return 0 }
}

// ─── PHASE 1a: News RSS ───────────────────────────────────────────
async function scrapeNewsSource(DB, source) {
    const jobId = await startJob(DB, source.name)
    try {
        const xml   = await fetchRSS(source.url)
        const items = parseRSS(xml).slice(0, 25)
        let count = 0
        for (const item of items) {
            const category = guessCategory(item.title + ' ' + (item.summary || ''))
            try {
                const r = await DB.prepare(`
                    INSERT INTO news_articles (title, summary, source, source_url, published_date, category, sentiment, language, ai_processed)
                    VALUES (?,?,?,?,?,?,'neutral','en',0)
                    ON CONFLICT(source_url) DO NOTHING
                `).bind(item.title, item.summary, source.name, item.url, item.date, category).run()
                if (r.meta?.changes > 0) count++
            } catch { /* skip */ }
        }
        await finishJob(DB, jobId, 'completed', count)
        console.log(`✅ ${source.name}: ${count} new`)
        return { source: source.name, new: count }
    } catch (e) {
        await finishJob(DB, jobId, 'failed', 0, e.message)
        console.error(`❌ ${source.name}: ${e.message}`)
        return { source: source.name, new: 0, error: e.message }
    }
}

// ─── PHASE 1b: World Bank → data_points ──────────────────────────
async function scrapeWorldBank(DB) {
    const BASE = 'https://api.worldbank.org/v2/country/AM/indicator'
    const jobId = await startJob(DB, 'worldbank')
    let totalNew = 0
    for (const ind of WB_INDICATORS) {
        try {
            const json   = await fetchJSON(`${BASE}/${ind.code}?format=json&mrv=10&per_page=10`)
            const points = json[1] || []
            for (const dp of points) {
                if (dp.value === null) continue
                totalNew += await insertDataPoint(DB, {
                    domain: ind.cat,
                    entity: 'Armenia',
                    attribute: ind.name,
                    value_num: dp.value,
                    unit: ind.unit,
                    location: 'Armenia',
                    period: String(dp.date),
                    source_name: 'World Bank',
                    source_url: `https://data.worldbank.org/indicator/${ind.code}?locations=AM`,
                    confidence: 'high',
                })
            }
        } catch (e) { console.warn(`WB ${ind.code}: ${e.message}`) }
    }
    await finishJob(DB, jobId, 'completed', totalNew)
    console.log(`🌍 World Bank: ${totalNew} new data_points`)
    return totalNew
}

// ─── PHASE 1c: IMF DataMapper → data_points ──────────────────────
async function scrapeIMF(DB) {
    const BASE = 'https://www.imf.org/external/datamapper/api/v1'
    const jobId = await startJob(DB, 'imf')
    let totalNew = 0
    for (const ind of IMF_INDICATORS) {
        try {
            const json   = await fetchJSON(`${BASE}/${ind.code}/ARM`)
            const series = json?.values?.[ind.code]?.ARM || {}
            for (const [year, value] of Object.entries(series)) {
                if (value === null || value === undefined) continue
                if (parseInt(year) < 2010) continue
                totalNew += await insertDataPoint(DB, {
                    domain: ind.cat,
                    entity: 'Armenia',
                    attribute: ind.name,
                    value_num: value,
                    unit: ind.unit,
                    location: 'Armenia',
                    period: year,
                    source_name: 'IMF',
                    source_url: `https://www.imf.org/external/datamapper/${ind.code}/ARM`,
                    confidence: 'high',
                })
            }
        } catch (e) { console.warn(`IMF ${ind.code}: ${e.message}`) }
    }
    await finishJob(DB, jobId, 'completed', totalNew)
    console.log(`📊 IMF: ${totalNew} new data_points`)
    return totalNew
}

// ─── PHASE 1d: AMD Exchange Rates ────────────────────────────────
async function scrapeExchangeRates(DB) {
    const today = new Date().toISOString().slice(0, 10)
    try {
        const existing = await DB.prepare(
            "SELECT COUNT(*) as n FROM exchange_rates WHERE date = ?"
        ).bind(today).first()
        if (existing?.n > 0) { console.log('FX: already have today'); return 0 }

        const json = await fetchJSON('https://open.er-api.com/v6/latest/AMD')
        if (!json?.rates) throw new Error('No rates in response')

        const targets = ['USD', 'EUR', 'RUB', 'GBP', 'CNY', 'GEL', 'IRR', 'AED', 'CHF', 'JPY', 'CAD', 'AUD']
        let count = 0
        for (const target of targets) {
            const rate = json.rates[target]
            if (!rate) continue
            try {
                await DB.prepare(`
                    INSERT INTO exchange_rates (base, target, rate, date, source)
                    VALUES ('AMD', ?, ?, ?, 'open.er-api.com')
                    ON CONFLICT(base, target, date) DO NOTHING
                `).bind(target, rate, today).run()
                count++
            } catch { /* duplicate */ }
        }
        console.log(`💱 Exchange rates: ${count} pairs for ${today}`)
        return count
    } catch (e) {
        console.error(`FX rates: ${e.message}`)
        return 0
    }
}

// ─── PHASE 2: AI Enrichment → entities table ─────────────────────
async function enrichArticles(env) {
    const { DB, OPENAI_API_KEY } = env
    if (!OPENAI_API_KEY) { console.log('Enrichment: no OPENAI_API_KEY'); return }

    const { results: articles } = await DB.prepare(
        'SELECT id, title, summary FROM news_articles WHERE ai_processed = 0 LIMIT 25'
    ).all()
    if (!articles.length) { console.log('Enrichment: nothing to process'); return }

    for (let i = 0; i < articles.length; i += 5) {
        await enrichBatch(DB, OPENAI_API_KEY, articles.slice(i, i + 5))
    }
    console.log(`🤖 Enriched ${articles.length} articles`)
}

async function enrichBatch(DB, apiKey, articles) {
    const text = articles.map((a, i) =>
        `[${i}] ${a.title}\n${(a.summary || '').slice(0, 200)}`
    ).join('\n\n')

    const system = `Armenian business intelligence analyst. For each numbered article extract:
- entities: Armenian company/organization names mentioned ([] if none), with type: 'company', 'brand', 'ngo', 'government_body', or 'media_outlet'
- sentiment: "positive", "neutral", or "negative" toward Armenia's economy
Return ONLY valid JSON: {"results":[{"entities":[{"name":"name","type":"company"}],"sentiment":"neutral"},...]} — one object per article.`

    let parsed = []
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: text }], max_tokens: 800, temperature: 0.1 }),
        })
        const ai = await res.json()
        const raw = ai.choices?.[0]?.message?.content?.trim() || '{}'
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
        const wrapper = JSON.parse(cleaned)
        parsed = Array.isArray(wrapper) ? wrapper : (wrapper.results || Object.values(wrapper)[0] || [])
    } catch (e) {
        console.error('Enrichment batch failed:', e.message)
        for (const a of articles) {
            await DB.prepare('UPDATE news_articles SET ai_processed=1 WHERE id=?').bind(a.id).run()
        }
        return
    }

    for (let idx = 0; idx < articles.length; idx++) {
        const article = articles[idx]
        const result  = parsed?.[idx] || {}
        const sentiment = ['positive', 'neutral', 'negative'].includes(result.sentiment) ? result.sentiment : 'neutral'

        for (const ent of (result.entities || [])) {
            const name = ent?.name?.trim() || (typeof ent === 'string' ? ent.trim() : '')
            const type = ent?.type || 'company'
            if (!name || name.length < 3) continue
            try {
                await DB.prepare(
                    "INSERT INTO entities (name, type, country, source, ai_extracted) VALUES (?,?,?,'AI-Extracted',1) ON CONFLICT(name) DO NOTHING"
                ).bind(name, type, 'Armenia').run()
                const entity = await DB.prepare('SELECT id FROM entities WHERE name=?').bind(name).first()
                if (entity) await DB.prepare(
                    'INSERT INTO news_entities (news_id, entity_id) VALUES (?,?) ON CONFLICT DO NOTHING'
                ).bind(article.id, entity.id).run()
            } catch { /* skip */ }
        }

        await DB.prepare('UPDATE news_articles SET ai_processed=1, sentiment=? WHERE id=?')
            .bind(sentiment, article.id).run()
    }
}

// ─── Worker export ────────────────────────────────────────────────
export default {
    async scheduled(_ev, env, ctx) {
        console.log('🚀 Pipeline started:', new Date().toISOString())
        ctx.waitUntil(
            Promise.allSettled([
                ...NEWS_SOURCES.map(s => scrapeNewsSource(env.DB, s)),
                scrapeWorldBank(env.DB),
                scrapeIMF(env.DB),
                scrapeExchangeRates(env.DB),
            ])
            .then(() => enrichArticles(env))
            .then(() => console.log('✅ Pipeline done:', new Date().toISOString()))
        )
    },

    async fetch(request, env) {
        const { pathname } = new URL(request.url)

        if (pathname === '/scrape' && request.method === 'POST') {
            const [newsRes, wbNew, imfNew, fxNew] = await Promise.all([
                Promise.allSettled(NEWS_SOURCES.map(s => scrapeNewsSource(env.DB, s))),
                scrapeWorldBank(env.DB),
                scrapeIMF(env.DB),
                scrapeExchangeRates(env.DB),
            ])
            const sources  = newsRes.map(r => r.value || { error: r.reason?.message })
            const newsNew  = sources.reduce((n, s) => n + (s.new || 0), 0)
            return Response.json({ success: true, news_new: newsNew, stats_new: wbNew + imfNew, fx_new: fxNew, sources })
        }

        if (pathname === '/enrich' && request.method === 'POST') {
            await enrichArticles(env)
            return Response.json({ success: true, message: 'Enrichment complete' })
        }

        return new Response([
            'Armenian OSINT Data Pipeline',
            '  POST /scrape  — collect all sources (news + WB + IMF + FX) → data_points',
            '  POST /enrich  — run AI enrichment on unprocessed articles → entities',
        ].join('\n'), { status: 200 })
    },
}
