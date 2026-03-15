const { Pool } = require('pg');
const { scraperQueue, scheduleRecurringJobs } = require('./src/queue');
const ArmeniaScraper = require('./src/scrapers/armenia-sources');
require('dotenv').config();

// Database connection
const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'armenian_osint',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 10
});

// Test database connection
db.on('connect', () => {
    console.log('✅ Worker connected to PostgreSQL database');
});

db.on('error', (err) => {
    console.error('❌ Database error:', err);
});

// Initialize scrapers
const armeniaScraper = new ArmeniaScraper(db);

// Process jobs
const concurrency = parseInt(process.env.CONCURRENT_JOBS) || 2;

scraperQueue.process('statistics', concurrency, async (job) => {
    console.log(`📊 Processing statistics job ${job.id}`);
    const { url } = job.data;
    return await armeniaScraper.scrapeStatistics(url);
});

scraperQueue.process('news', concurrency, async (job) => {
    console.log(`📰 Processing news job ${job.id}`);
    const { sources } = job.data;
    return await armeniaScraper.scrapeNews(sources);
});

scraperQueue.process('company', concurrency, async (job) => {
    console.log(`🏢 Processing company job ${job.id}`);
    const { url } = job.data;
    return await armeniaScraper.scrapeCompanies(url);
});

// Start worker
async function startWorker() {
    console.log('\n🤖 Armenian OSINT Scraper Worker');
    console.log('=================================\n');

    try {
        // Test DB connection
        await db.query('SELECT 1');
        console.log('✅ Database connection verified');

        // Schedule recurring jobs
        await scheduleRecurringJobs();

        console.log('\n🚀 Worker is ready and listening for jobs...');
        console.log('📋 Configured job types: statistics, news, company');
        console.log(`⚙️  Concurrency: ${concurrency}`);
        console.log('\nPress Ctrl+C to stop\n');
    } catch (error) {
        console.error('❌ Failed to start worker:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\n⏸️  Shutting down worker gracefully...');
    await scraperQueue.close();
    await db.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n⏸️  Shutting down worker gracefully...');
    await scraperQueue.close();
    await db.end();
    process.exit(0);
});

// Start the worker
startWorker();

module.exports = { db, armeniaScraper };
