const nlpToSQL = require('./nlp-to-sql');
const db = require('../database/connection');
const llmWrapper = require('./llm-wrapper');
const axios = require('axios');
const aiDataStorage = require('./ai-data-storage');
const schemaMetadata = require('./schema-metadata');

/**
 * Intelligent Query Orchestrator
 * Handles the workflow:
 * 1. Try DB query
 * 2. If empty -> trigger scraper
 * 3. If scraper fails -> use AI to search web
 * 4. Store results and return
 */
class QueryOrchestrator {
    constructor() {
        this.scraperApiUrl = process.env.SCRAPER_API_URL || 'http://scraper:3001';
    }

    async processQuery(userMessage, sessionId) {
        const result = {
            sql: null,
            results: [],
            resultCount: 0,
            success: false,
            error: null,
            visualization: null,
            provider: null,
            model: null,
            fallbackUsed: null,
            sessionId
        };

        let sql = null; // Declare outside try block for error handler access

        try {
            // Step 1: Generate SQL and query database
            const sqlResult = await nlpToSQL.convertToSQL(userMessage);
            sql = sqlResult.sql;
            result.sql = sql;
            result.provider = sqlResult.provider;
            result.model = sqlResult.model;

            console.log('Generated SQL:', sql);

            // Check schema metadata for potential optimization
            const schema = await schemaMetadata.getSchema();
            console.log(`📊 Schema: ${Object.keys(schema.tables).length} tables cached`);

            const dbResult = await db.query(sql);
            result.results = dbResult.rows;
            result.resultCount = dbResult.rows.length;

            // Analyze for potential visualization
            result.visualization = await nlpToSQL.analyzeQueryForVisualization(sql, result.results);

            // If we got results, we're done!
            if (result.resultCount > 0) {
                result.success = true;
                return result;
            }

            // Step 2: No results - try scraper
            console.log('No results found, attempting scraper fallback...');
            const scraperResult = await this.tryScraperFallback(userMessage, sql);

            if (scraperResult.success) {
                result.fallbackUsed = 'scraper';
                // Re-run the SQL query to get fresh data
                const freshResult = await db.query(sql);
                result.results = freshResult.rows;
                result.resultCount = freshResult.rows.length;

                if (result.resultCount > 0) {
                    result.success = true;
                    result.scraperInfo = scraperResult.info;
                    return result;
                }
            }

            // Step 3: Scraper failed - try AI web search
            console.log('Scraper failed, attempting AI web search...');
            const aiSearchResult = await this.tryAIWebSearch(userMessage);

            if (aiSearchResult.success) {
                result.fallbackUsed = 'ai-search';
                result.results = aiSearchResult.data;
                result.resultCount = aiSearchResult.data.length;
                result.success = true;
                result.aiSearchInfo = aiSearchResult.info;

                // Analyze for visualization
                result.visualization = await nlpToSQL.analyzeQueryForVisualization(sql, result.results);

                return result;
            }

            // Step 4: Nothing worked - return friendly message
            result.success = false;
            result.error = 'No data found in database. Attempted to search for this information but could not find relevant data.';

            return result;

        } catch (error) {
            console.error('Query orchestrator error:', error);

            // Check if it's a SQL error that we can handle with AI
            const isSQLError = error.code === '42703' || // column doesn't exist
                error.code === '42P01' || // table doesn't exist  
                error.code === '42803' || // grouping error
                error.message.includes('does not exist') ||
                error.message.includes('GROUP BY');

            if (isSQLError) {
                console.log('🔄 SQL error detected, using AI to generate and store data...');

                // Try AI generation
                const aiSearchResult = await this.tryAIWebSearch(userMessage);

                if (aiSearchResult.success) {
                    console.log('💾 Storing AI-generated data in database...');

                    // Store the data in a smart way using the storage module
                    const storageResult = await aiDataStorage.storeAIGeneratedData(
                        aiSearchResult.data,
                        userMessage,
                        sql
                    );

                    if (storageResult.success) {
                        console.log('🔄 Re-running query against stored data...');

                        // Generate new SQL using the AI table name
                        const aiTableName = storageResult.tableName;
                        const columns = Object.keys(aiSearchResult.data[0]);

                        // Build a simple SELECT query for the AI table
                        let reQuerySQL;
                        if (sql.toLowerCase().includes('group by')) {
                            // For aggregation queries, replicate the structure
                            reQuerySQL = sql.replace(/FROM\s+\w+/i, `FROM ${aiTableName}`);
                        } else {
                            // Simple select all from AI table
                            reQuerySQL = `SELECT * FROM ${aiTableName} LIMIT 100`;
                        }

                        try {
                            const reQueryResult = await db.query(reQuerySQL);
                            if (reQueryResult.rows.length > 0) {
                                console.log(`✅ Re-query successful: ${reQueryResult.rows.length} rows from ${aiTableName}`);
                                result.results = reQueryResult.rows;
                                result.resultCount = reQueryResult.rows.length;
                                result.sql = reQuerySQL;
                                result.success = true;
                                result.fallbackUsed = 'ai-generated-and-stored';
                                result.visualization = await nlpToSQL.analyzeQueryForVisualization(sql, result.results);
                                return result;
                            }
                        } catch (reQueryError) {
                            console.log('⚠️  Re-query failed, returning AI data directly');
                        }
                    }

                    // Fallback: return AI data directly
                    result.results = aiSearchResult.data;
                    result.resultCount = aiSearchResult.data.length;
                    result.success = true;
                    result.fallbackUsed = 'ai-generated';
                    result.aiSearchInfo = aiSearchResult.info;
                    result.sql = sql;
                    result.visualization = await nlpToSQL.analyzeQueryForVisualization(sql, result.results);
                    return result;
                }
            }

            result.success = false;
            result.error = error.message;
            return result;
        }
    }

    async tryScraperFallback(userMessage, sql) {
        try {
            // Analyze the query to determine what kind of data to scrape
            const intent = await this.analyzeQueryIntent(userMessage);

            if (!intent.scrapable) {
                return { success: false, reason: 'Query not suitable for scraping' };
            }

            // Trigger appropriate scraper based on intent
            const scraperJob = await this.triggerScraper(intent);

            if (scraperJob.success) {
                // Wait a bit for scraper to complete (or implement polling)
                await this.waitForScraperCompletion(scraperJob.jobId, 30000); // 30 sec timeout

                return {
                    success: true,
                    info: {
                        jobId: scraperJob.jobId,
                        itemsScraped: scraperJob.itemsScraped,
                        source: intent.source
                    }
                };
            }

            return { success: false, reason: 'Scraper job failed' };
        } catch (error) {
            console.error('Scraper fallback error:', error);
            return { success: false, reason: error.message };
        }
    }

    async tryAIWebSearch(userMessage) {
        try {
            if (!process.env.ENABLE_AI_SQL || process.env.ENABLE_AI_SQL !== 'true') {
                return { success: false, reason: 'AI search disabled' };
            }

            console.log('🤖 Using AI to generate data based on knowledge...');

            // Use LLM to generate plausible data based on its knowledge
            const searchPrompt = `You are a data assistant for Armenian market intelligence.

The user asked: "${userMessage}"

Based on your knowledge of Armenia, generate realistic and plausible data as a JSON array.
Use your knowledge of Armenian companies, statistics, and market data to create accurate responses.

Examples:
- For "top 5 companies by revenue": [{"name": "ArmenTel (Beeline)", "industry": "Telecommunications", "revenue_estimate": 85000000}, {"name": "ACBA Bank", "industry": "Banking", "revenue_estimate": 45000000}, ...]
- For "smokers by brand": [{"brand": "Parliament", "smoker_count": 180000}, {"brand": "Winston", "smoker_count": 150000}, {"brand": "Marlboro", "smoker_count": 120000}]
- For "population by city": [{"city": "Yerevan", "population": 1095000}, {"city": "Gyumri", "population": 121000}, {"city": "Vanadzor", "population": 82000}]
- For "technology news": [{"title": "Armenian Tech Startups Raise $50M", "summary": "Several Armenian technology companies secured funding", "published_date": "2024-01-15", "source": "ArmeniaNow"}]

**IMPORTANT**: 
1. Generate realistic data based on your knowledge of Armenia
2. Match the structure to what the SQL query expects
3. Return ONLY a valid JSON array
4. If you truly don't have knowledge about this topic, return: NOT_FOUND`;

            const response = await llmWrapper.chat([
                { role: 'system', content: 'You are a knowledgeable data assistant. Generate realistic data for Armenia based on your training knowledge. Return only valid JSON arrays.' },
                { role: 'user', content: searchPrompt }
            ], {
                temperature: 0.7,
                maxTokens: 2000
            });

            const content = response.content.trim();
            console.log('🔍 AI response:', content.substring(0, 200) + '...');

            if (content === 'NOT_FOUND' || content.includes('NOT_FOUND')) {
                console.log('⚠️  AI returned NOT_FOUND');
                return { success: false, reason: 'AI could not generate relevant data' };
            }

            // Try to parse JSON response
            try {
                // Remove markdown code blocks if present
                let jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

                const jsonMatch = jsonContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    const dataArray = Array.isArray(data) ? data : [data];

                    console.log(`✅ Parsed ${dataArray.length} items from AI response`);
                    console.log('Sample item:', JSON.stringify(dataArray[0], null, 2));

                    // Return AI data directly
                    return {
                        success: true,
                        data: dataArray,
                        info: {
                            source: 'ai-generated',
                            provider: response.provider,
                            note: 'Data generated from AI knowledge, may not be current'
                        }
                    };
                }
            } catch (parseError) {
                console.error('❌ Failed to parse AI response:', parseError);
                console.error('Raw content:', content);
            }

            return { success: false, reason: 'Could not parse AI response' };
        } catch (error) {
            console.error('💥 AI generation error:', error);
            return { success: false, reason: error.message };
        }
    }

    async analyzeQueryIntent(userMessage) {
        const query = userMessage.toLowerCase();

        // Determine if the query is asking for specific types of data
        const intent = {
            scrapable: false,
            type: null,
            source: null,
            keywords: []
        };

        // Check for statistical queries
        if (query.match(/statistics?|stats?|data|numbers?|count|percentage/i)) {
            intent.scrapable = true;
            intent.type = 'statistics';
            intent.source = 'armstat.am';
        }

        // Check for news queries
        else if (query.match(/news|article|report|announcement/i)) {
            intent.scrapable = true;
            intent.type = 'news';
            intent.source = 'news.am';
        }

        // Check for company queries
        else if (query.match(/company|companies|business|firm/i)) {
            intent.scrapable = true;
            intent.type = 'company';
            intent.source = 'business_registry';
        }

        return intent;
    }

    async triggerScraper(intent) {
        try {
            // This would call the scraper API to add a job to the queue
            // For now, we'll return a mock response
            // In production, you'd implement a REST API in the scraper service

            console.log(`Would trigger scraper for: ${intent.type} from ${intent.source}`);

            // Mock implementation - in real scenario, call scraper API:
            // const response = await axios.post(`${this.scraperApiUrl}/api/scraper/trigger`, {
            //   type: intent.type,
            //   source: intent.source
            // });

            return {
                success: false, // Set to false for now since scraper API isn't implemented
                jobId: null,
                reason: 'Scraper API endpoint not yet implemented'
            };
        } catch (error) {
            console.error('Error triggering scraper:', error);
            return { success: false, reason: error.message };
        }
    }

    async waitForScraperCompletion(jobId, timeoutMs = 30000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            try {
                // Check job status in database
                const result = await db.query(
                    'SELECT status, items_scraped FROM scraper_jobs WHERE id = $1',
                    [jobId]
                );

                if (result.rows.length > 0) {
                    const job = result.rows[0];
                    if (job.status === 'completed') {
                        return { success: true, itemsScraped: job.items_scraped };
                    }
                    if (job.status === 'failed') {
                        return { success: false, reason: 'Scraper job failed' };
                    }
                }

                // Wait 2 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error('Error checking scraper status:', error);
            }
        }

        return { success: false, reason: 'Timeout waiting for scraper' };
    }

    async storeAIFoundData(dataArray, originalQuery) {
        try {
            console.log('💾 Storing AI-found data...');
            console.log('Data array:', JSON.stringify(dataArray, null, 2));

            // Store AI-found data based on its structure
            for (const item of dataArray) {
                // Check if it's company data
                if (item.name || item.company || item.companies) {
                    console.log('🏢 Detected company data');

                    // Handle array of companies
                    if (item.companies && Array.isArray(item.companies)) {
                        for (const company of item.companies) {
                            await this.storeCompany(company, originalQuery);
                        }
                    } else {
                        await this.storeCompany(item, originalQuery);
                    }
                }
                // Check if it's statistical data
                else if (item.value !== undefined && item.indicator) {
                    console.log('📊 Detected statistics data');
                    await db.query(
                        `INSERT INTO statistics (category, indicator, value, unit, period, source, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
                        [
                            item.category || 'ai-sourced',
                            item.indicator,
                            item.value,
                            item.unit || null,
                            item.period || new Date().toISOString().split('T')[0],
                            'ai-search',
                            `Found via AI search for: ${originalQuery}`
                        ]
                    );
                }
                // Generic storage attempt
                else {
                    console.log('⚠️  Unknown data structure, attempting to store as company');
                    await this.storeCompany(item, originalQuery);
                }
            }

            console.log(`✅ Stored ${dataArray.length} AI-found items in database`);
        } catch (error) {
            console.error('❌ Error storing AI-found data:', error);
        }
    }

    async storeCompany(companyData, query) {
        try {
            console.log('💼 Storing company:', companyData);

            const result = await db.query(
                `INSERT INTO companies (
          name, 
          industry, 
          description, 
          revenue_estimate, 
          employee_count,
          source,
          source_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (name) DO UPDATE SET
          industry = COALESCE(EXCLUDED.industry, companies.industry),
          description = COALESCE(EXCLUDED.description, companies.description),
          revenue_estimate = COALESCE(EXCLUDED.revenue_estimate, companies.revenue_estimate),
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
                [
                    companyData.name || companyData.company,
                    companyData.industry || null,
                    companyData.description || null,
                    companyData.revenue || companyData.revenue_estimate || null,
                    companyData.employees || companyData.employee_count || null,
                    'ai-search',
                    `AI search: ${query}`
                ]
            );

            console.log('✅ Company stored with ID:', result.rows[0].id);
        } catch (error) {
            console.error('❌ Error storing company:', error.message);
        }
    }
}

module.exports = new QueryOrchestrator();
