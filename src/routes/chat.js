const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const queryOrchestrator = require('../services/query-orchestrator');
const responseGenerator = require('../services/response-generator');
const { v4: uuidv4 } = require('uuid');

// POST /api/chat - Process user message with natural language response
router.post('/', async (req, res) => {
    console.log('\n=================================');
    console.log('📨 NEW CHAT REQUEST');
    console.log('=================================');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const { message, sessionId = uuidv4() } = req.body;

    if (!message) {
        console.log('❌ No message provided');
        return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`📝 Message: "${message}"`);
    console.log(`🔑 Session ID: ${sessionId}`);

    try {
        console.log('🔄 Starting query orchestration...');

        // Use the intelligent query orchestrator
        const result = await queryOrchestrator.processQuery(message, sessionId);

        console.log('✅ Query orchestration complete');
        console.log('Result success:', result.success);
        console.log('Result count:', result.resultCount);
        console.log('SQL:', result.sql);

        if (!result.success) {
            console.log('⚠️  Query failed, saving error to history...');

            // Save error to history
            await db.query(
                `INSERT INTO chat_history (session_id, user_message, generated_sql, sql_error, result_count, assistant_response)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    sessionId,
                    message,
                    result.sql,
                    result.error || null,
                    0,
                    result.error || 'No results found'
                ]
            );

            console.log('📤 Sending error response');
            return res.json({
                success: false,
                message,
                response: result.error || "I couldn't find any data for your query.",
                sql: result.sql,
                sessionId,
                fallbackAttempted: true
            });
        }

        console.log('🤖 Generating natural language response...');

        // Generate natural language response
        const nlResponse = await responseGenerator.generateResponse(
            message,
            result.results,
            result.visualization
        );

        console.log('✅ Response generated:', nlResponse.text.substring(0, 100) + '...');
        console.log('📊 Has chart:', nlResponse.hasChart);

        console.log('💾 Saving to chat history...');

        // Save to chat history
        await db.query(
            `INSERT INTO chat_history (session_id, user_message, generated_sql, sql_error, result_count, assistant_response)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                sessionId,
                message,
                result.sql,
                null,
                result.resultCount,
                nlResponse.text
            ]
        );

        const responseData = {
            success: true,
            message,
            response: nlResponse.text,
            data: result.results,
            dataCount: result.resultCount,
            chart: nlResponse.hasChart ? {
                type: nlResponse.chartConfig.chartType,
                labelColumn: nlResponse.chartConfig.labelColumn,
                dataColumns: nlResponse.chartConfig.dataColumns
            } : null,
            sql: result.sql,
            provider: result.provider,
            model: result.model,
            fallbackUsed: result.fallbackUsed,
            sessionId
        };

        console.log('📤 Sending success response');
        console.log('Response preview:', {
            success: responseData.success,
            responseLength: responseData.response.length,
            dataCount: responseData.dataCount,
            hasChart: !!responseData.chart
        });
        console.log('=================================\n');

        res.json(responseData);
    } catch (error) {
        console.error('💥 CHAT ERROR:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        console.log('=================================\n');

        res.status(500).json({
            success: false,
            error: error.message,
            response: "I'm sorry, I encountered an error processing your request."
        });
    }
});

// GET /api/chat/history/:sessionId - Get chat history
router.get('/history/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        const result = await db.query(
            `SELECT id, user_message, generated_sql, sql_error, result_count, assistant_response, created_at
       FROM chat_history
       WHERE session_id = $1
       ORDER BY created_at ASC`,
            [sessionId]
        );

        res.json({
            success: true,
            history: result.rows
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/chat/sessions - Get all sessions
router.get('/sessions', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT session_id, 
              COUNT(*) as message_count,
              MIN(created_at) as first_message,
              MAX(created_at) as last_message
       FROM chat_history
       GROUP BY session_id
       ORDER BY MAX(created_at) DESC
       LIMIT 50`
        );

        res.json({
            success: true,
            sessions: result.rows
        });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
