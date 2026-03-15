const express = require('express');
const router = express.Router();
const db = require('../database/connection');

// GET /api/data/summary - Dashboard summary statistics
router.get('/summary', async (req, res) => {
    try {
        // Get counts of various entities
        const companiesResult = await db.query('SELECT COUNT(*) FROM companies');
        const contactsResult = await db.query('SELECT COUNT(*) FROM contacts');
        const newsResult = await db.query('SELECT COUNT(*) FROM news_articles');
        const statsResult = await db.query('SELECT COUNT(*) FROM statistics');

        // Get recent news
        const recentNews = await db.query(
            `SELECT title, source, published_date 
       FROM news_articles 
       ORDER BY published_date DESC 
       LIMIT 5`
        );

        // Get top industries
        const topIndustries = await db.query(
            `SELECT industry, COUNT(*) as count 
       FROM companies 
       WHERE industry IS NOT NULL 
       GROUP BY industry 
       ORDER BY count DESC 
       LIMIT 5`
        );

        // Get scraper status
        const scraperStatus = await db.query(
            `SELECT status, COUNT(*) as count 
       FROM scraper_jobs 
       GROUP BY status`
        );

        res.json({
            success: true,
            summary: {
                companies: parseInt(companiesResult.rows[0].count),
                contacts: parseInt(contactsResult.rows[0].count),
                news: parseInt(newsResult.rows[0].count),
                statistics: parseInt(statsResult.rows[0].count)
            },
            recentNews: recentNews.rows,
            topIndustries: topIndustries.rows,
            scraperStatus: scraperStatus.rows
        });
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/data/companies - Get companies with filters
router.get('/companies', async (req, res) => {
    const { industry, limit = 100, offset = 0 } = req.query;

    try {
        let query = 'SELECT * FROM companies';
        const params = [];

        if (industry) {
            query += ' WHERE industry ILIKE $1';
            params.push(`%${industry}%`);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await db.query(query, params);

        res.json({
            success: true,
            companies: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/data/statistics - Get statistical data
router.get('/statistics', async (req, res) => {
    const { category, indicator, limit = 100 } = req.query;

    try {
        let query = 'SELECT * FROM statistics';
        const params = [];
        const conditions = [];

        if (category) {
            conditions.push(`category ILIKE $${params.length + 1}`);
            params.push(`%${category}%`);
        }

        if (indicator) {
            conditions.push(`indicator ILIKE $${params.length + 1}`);
            params.push(`%${indicator}%`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY period DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);

        res.json({
            success: true,
            statistics: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
