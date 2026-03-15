const axios = require('axios');
const cheerio = require('cheerio');
const winston = require('winston');

// Lazy-load puppeteer only when needed (heavy dep)
let puppeteerBrowser = null
async function getPuppeteerBrowser() {
    if (!puppeteerBrowser) {
        const puppeteer = require('puppeteer')
        puppeteerBrowser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        })
    }
    return puppeteerBrowser
}

// Logger setup
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Rotate through realistic browser User-Agent strings
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

class BaseScraper {
    constructor(name, db) {
        this.name = name;
        this.db = db;
        this.requestDelay = parseInt(process.env.REQUEST_DELAY_MS) || 2000;
        this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
        this.logger = logger;
        this._uaIndex = 0;
    }

    _nextUserAgent() {
        const ua = USER_AGENTS[this._uaIndex % USER_AGENTS.length];
        this._uaIndex++;
        return ua;
    }

    async fetch(url, retries = 0) {
        try {
            this.logger.info(`Fetching: ${url}`);

            const ua = this._nextUserAgent();
            const origin = new URL(url).origin;

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': ua,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Referer': origin + '/',
                    'DNT': '1',
                },
                timeout: 15000,
                maxRedirects: 5,
            });

            await this.delay(this.requestDelay);
            return response.data;
        } catch (error) {
            const status = error.response?.status;

            // 403/429 — site is blocking axios; fall back to headless Puppeteer
            if ((status === 403 || status === 429) && retries === 0) {
                this.logger.info(`🤖 Axios blocked (${status}), switching to Puppeteer for ${url}`);
                return this.fetchWithPuppeteer(url);
            }

            this.logger.error(`Error fetching ${url}: ${error.message}`);
            if (retries < this.maxRetries) {
                const backoff = this.requestDelay * Math.pow(2, retries);
                this.logger.info(`Retrying... (${retries + 1}/${this.maxRetries}) in ${backoff}ms`);
                await this.delay(backoff);
                return this.fetch(url, retries + 1);
            }

            throw error;
        }
    }

    async fetchWithPuppeteer(url) {
        this.logger.info(`Puppeteer fetching: ${url}`);
        const browser = await getPuppeteerBrowser();
        const page = await browser.newPage();
        try {
            await page.setUserAgent(this._nextUserAgent());
            await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            // Wait a moment for any JS rendering
            await this.delay(1500);
            const html = await page.content();
            await this.delay(this.requestDelay);
            return html;
        } finally {
            await page.close();
        }
    }

    parseHTML(html) {
        return cheerio.load(html);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    normalizeText(text) {
        if (!text) return null;
        return text.trim().replace(/\s+/g, ' ');
    }

    async saveToDatabase(table, data) {
        try {
            const columns = Object.keys(data);
            const values = Object.values(data);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

            const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING id
      `;

            const result = await this.db.query(query, values);
            return result.rows[0].id;
        } catch (error) {
            this.logger.error(`Error saving to ${table}:`, error.message);
            throw error;
        }
    }

    async updateJobStatus(jobId, status, itemsScraped = 0, errorMessage = null) {
        try {
            let extra = '';
            if (status === 'running') extra = ', started_at = CURRENT_TIMESTAMP';
            else if (status === 'completed' || status === 'failed') extra = ', completed_at = CURRENT_TIMESTAMP';

            const query = `
                UPDATE scraper_jobs
                SET status = $1, items_scraped = $2, error_message = $3${extra}
                WHERE id = $4
            `;
            await this.db.query(query, [status, itemsScraped, errorMessage, jobId]);
        } catch (error) {
            this.logger.error(`Error updating job status:`, error.message);
        }
    }

    async createJob(jobType, sourceName, sourceUrl) {
        try {
            const query = `
        INSERT INTO scraper_jobs (job_type, source_name, source_url, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id
      `;

            const result = await this.db.query(query, [jobType, sourceName, sourceUrl]);
            return result.rows[0].id;
        } catch (error) {
            this.logger.error('Error creating job:', error.message);
            throw error;
        }
    }

    // Abstract method to be implemented by child classes
    async scrape(_url) {
        throw new Error('scrape() must be implemented by child class');
    }
}

module.exports = BaseScraper;
