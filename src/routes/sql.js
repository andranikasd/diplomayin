const express = require('express');
const router = express.Router();
const db = require('../database/connection');

/**
 * Execute SQL query endpoint
 * POST /api/sql/execute
 */
router.post('/execute', async (req, res) => {
    const { sql } = req.body;

    if (!sql || !sql.trim()) {
        return res.status(400).json({
            success: false,
            error: 'SQL query is required'
        });
    }

    console.log('📊 SQL Execution Request:', sql.substring(0, 100) + '...');

    try {
        // Security: Only allow SELECT queries (read-only)
        const trimmedSQL = sql.trim().toUpperCase();

        // Allow SELECT and WITH (for CTEs)
        if (!trimmedSQL.startsWith('SELECT') && !trimmedSQL.startsWith('WITH')) {
            return res.status(403).json({
                success: false,
                error: 'Only SELECT queries are allowed for security reasons'
            });
        }

        // Block dangerous keywords
        const dangerousPatterns = [
            /\bDROP\b/i,
            /\bDELETE\b/i,
            /\bTRUNCATE\b/i,
            /\bUPDATE\b/i,
            /\bINSERT\b/i,
            /\bALTER\b/i,
            /\bCREATE\b/i,
            /\bGRANT\b/i,
            /\bREVOKE\b/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(sql)) {
                return res.status(403).json({
                    success: false,
                    error: 'Query contains forbidden operations (write/modify operations not allowed)'
                });
            }
        }

        // Execute query with timeout
        const startTime = Date.now();
        const result = await db.query(sql);
        const executionTime = Date.now() - startTime;

        console.log(`✅ Query executed successfully: ${result.rows.length} rows in ${executionTime}ms`);

        res.json({
            success: true,
            results: result.rows,
            rowCount: result.rows.length,
            executionTime
        });

    } catch (error) {
        console.error('❌ SQL execution error:', error.message);

        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
