const axios = require('axios');
const cheerio = require('cheerio');
const winston = require('winston');

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

class BaseScraper {
    constructor(name, db) {
        this.name = name;
        this.db = db;
        this.userAgent = process.env.USER_AGENT || 'Mozilla/5.0';
        this.requestDelay = parseInt(process.env.REQUEST_DELAY_MS) || 2000;
        this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
        this.logger = logger;
    }

    async fetch(url, retries = 0) {
        try {
            this.logger.info(`Fetching: ${url}`);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5,hy;q=0.3'
                },
                timeout: 10000
            });

            // Rate limiting
            await this.delay(this.requestDelay);

            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching ${url}: ${error.message}`);

            if (retries < this.maxRetries) {
                this.logger.info(`Retrying... (${retries + 1}/${this.maxRetries})`);
                await this.delay(this.requestDelay * 2);
                return this.fetch(url, retries + 1);
            }

            throw error;
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
            const query = `
        UPDATE scraper_jobs 
        SET status = $1, 
            items_scraped = $2, 
            error_message = $3,
            ${status === 'running' ? 'started_at = CURRENT_TIMESTAMP,' : ''}
            ${status === 'completed' || status === 'failed' ? 'completed_at = CURRENT_TIMESTAMP,' : ''}
            updated_at = CURRENT_TIMESTAMP
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
    async scrape(url) {
        throw new Error('scrape() must be implemented by child class');
    }
}

module.exports = BaseScraper;
