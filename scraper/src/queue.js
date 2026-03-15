const Queue = require('bull');
const redis = require('redis');
require('dotenv').config();

// Create Redis client
const redisClient = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379
    }
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('✅ Connected to Redis');
});

// Create Bull queue
const scraperQueue = new Queue('armenian-osint-scraper', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379
    }
});

// Queue event handlers
scraperQueue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
});

scraperQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
});

scraperQueue.on('active', (job) => {
    console.log(`🔄 Job ${job.id} started`);
});

// Helper functions to add jobs
async function addStatisticsJob(url) {
    return await scraperQueue.add('statistics', { url }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        }
    });
}

async function addNewsJob(sources) {
    return await scraperQueue.add('news', { sources }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        }
    });
}

async function addCompanyJob(url) {
    return await scraperQueue.add('company', { url }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        }
    });
}

// Schedule recurring jobs
async function scheduleRecurringJobs() {
    // Scrape news daily at 6 AM
    await scraperQueue.add('news', {
        sources: [
            { name: 'News.am', url: 'https://news.am/eng/' },
            { name: 'Armenpress', url: 'https://armenpress.am/eng/' }
        ]
    }, {
        repeat: {
            cron: '0 6 * * *' // Daily at 6 AM
        }
    });

    console.log('📅 Scheduled recurring news scraping job');
}

module.exports = {
    scraperQueue,
    redisClient,
    addStatisticsJob,
    addNewsJob,
    addCompanyJob,
    scheduleRecurringJobs
};
