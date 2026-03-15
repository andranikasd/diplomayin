const llmWrapper = require('./llm-wrapper');
const db = require('../database/connection');

class NLPToSQL {
    constructor() {
        this.systemPrompt = this.buildSystemPrompt();
        this.useAI = process.env.ENABLE_AI_SQL === 'true';
    }

    buildSystemPrompt() {
        return `You are an expert SQL query generator for an Armenian OSINT marketing intelligence database. Your task is to convert natural language questions into safe, efficient PostgreSQL queries.

DATABASE SCHEMA:
- companies: id, name, name_am (Armenian), industry, description, website, email, phone, address, city, country, registration_number, tax_id, founded_date, employee_count, revenue_estimate, source, source_url, created_at, updated_at
- contacts: id, company_id, first_name, last_name, position, email, phone, linkedin_url, facebook_url, source, created_at, updated_at
- social_metrics: id, company_id, platform, profile_url, followers_count, following_count, posts_count, engagement_rate, avg_likes, avg_comments, avg_shares, snapshot_date, created_at
- news_articles: id, title, title_am (Armenian), content, summary, author, source, source_url, published_date, category, sentiment, language, created_at
- news_companies: news_id, company_id (junction table)
- statistics: id, category, indicator, value, unit, period, source, source_url, region, notes, created_at
- market_trends: id, industry, trend_name, description, trend_score, start_date, end_date, source, created_at
- scraper_jobs: id, job_type, source_name, source_url, status, items_scraped, error_message, started_at, completed_at, created_at
- chat_history: id, session_id, user_message, generated_sql, sql_error, result_count, assistant_response, created_at

RULES:
1. Generate ONLY SELECT queries - no INSERT, UPDATE, DELETE, DROP, or other destructive operations
2. Always use proper JOIN syntax when combining tables
3. Use LIMIT clause to prevent overwhelming results (default 100 if not specified)
4. Support both Armenian and English field names in natural language
5. For date queries, use PostgreSQL date functions
6. For text search, use ILIKE for case-insensitive matching
7. Return ONLY the SQL query, no explanations or markdown
8. Ensure queries are injection-safe with proper escaping
9. For aggregations, use appropriate GROUP BY clauses
10. For chart/visualization queries, return data in a format suitable for charts (grouped, aggregated)

EXAMPLES:
User: "Show me top 10 companies by revenue"
SQL: SELECT name, industry, revenue_estimate FROM companies WHERE revenue_estimate IS NOT NULL ORDER BY revenue_estimate DESC LIMIT 10;

User: "Get social media followers for tech companies"
SQL: SELECT c.name, sm.platform, sm.followers_count FROM companies c JOIN social_metrics sm ON c.id = sm.company_id WHERE c.industry ILIKE '%tech%' ORDER BY sm.followers_count DESC LIMIT 100;

User: "Latest news about IT industry"
SQL: SELECT title, summary, published_date, source FROM news_articles WHERE category ILIKE '%IT%' ORDER BY published_date DESC LIMIT 20;

User: "Show GDP statistics by region"
SQL: SELECT region, value, period FROM statistics WHERE indicator ILIKE '%GDP%' ORDER BY period DESC, region;

Generate the SQL query for the user's question.`;
    }

    async convertToSQL(userQuestion, options = {}) {
        // If AI is enabled, use LLM
        if (this.useAI) {
            return await this.convertWithAI(userQuestion, options);
        }

        // Otherwise, use basic pattern matching
        return await this.convertWithPatterns(userQuestion);
    }

    async convertWithAI(userQuestion, options = {}) {
        try {
            const messages = [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: userQuestion }
            ];

            const response = await llmWrapper.chat(messages, {
                temperature: 0.1,
                maxTokens: 500,
                ...options
            });

            // Extract SQL from response (remove markdown code blocks if present)
            let sql = response.content.trim();
            sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();

            // Validate the SQL
            const validation = this.validateSQL(sql);
            if (!validation.valid) {
                throw new Error(`Invalid SQL: ${validation.error}`);
            }

            return {
                sql,
                provider: response.provider,
                model: response.model
            };
        } catch (error) {
            console.error('Error converting NLP to SQL:', error);
            throw error;
        }
    }

    async convertWithPatterns(userQuestion) {
        const query = userQuestion.toLowerCase();
        let sql = '';

        // Pattern matching for common queries
        if (query.includes('all companies') || query.includes('list companies')) {
            sql = 'SELECT name, industry, city, employee_count FROM companies ORDER BY name LIMIT 100;';
        }
        else if (query.includes('top') && query.includes('companies') && query.includes('revenue')) {
            const limit = this.extractNumber(query) || 10;
            sql = `SELECT name, industry, revenue_estimate FROM companies WHERE revenue_estimate IS NOT NULL ORDER BY revenue_estimate DESC LIMIT ${limit};`;
        }
        else if (query.includes('companies') && query.includes('industry')) {
            const industry = this.extractIndustry(query);
            sql = `SELECT name, industry, employee_count, revenue_estimate FROM companies WHERE industry ILIKE '%${industry}%' ORDER BY name LIMIT 100;`;
        }
        else if (query.includes('news') || query.includes('articles')) {
            const limit = this.extractNumber(query) || 20;
            sql = `SELECT title, summary, published_date, source FROM news_articles ORDER BY published_date DESC LIMIT ${limit};`;
        }
        else if (query.includes('statistics') || query.includes('stats')) {
            sql = `SELECT category, indicator, value, unit, period, region FROM statistics ORDER BY period DESC LIMIT 50;`;
        }
        else if (query.includes('contacts') || query.includes('people')) {
            sql = `SELECT first_name, last_name, position, email, company_id FROM contacts LIMIT 100;`;
        }
        else if (query.includes('social') || query.includes('followers')) {
            sql = `SELECT c.name, sm.platform, sm.followers_count, sm.engagement_rate FROM companies c JOIN social_metrics sm ON c.id = sm.company_id ORDER BY sm.followers_count DESC LIMIT 50;`;
        }
        else {
            // Default: show all companies
            sql = 'SELECT name, industry, city FROM companies ORDER BY name LIMIT 50;';
        }

        return {
            sql,
            provider: 'pattern-matching',
            model: 'basic'
        };
    }

    extractNumber(text) {
        const match = text.match(/\d+/);
        return match ? parseInt(match[0]) : null;
    }

    extractIndustry(text) {
        const industries = ['tech', 'technology', 'it', 'finance', 'healthcare', 'education', 'retail', 'manufacturing'];
        for (const industry of industries) {
            if (text.includes(industry)) {
                return industry;
            }
        }
        return 'tech';
    }

    validateSQL(sql) {
        const upperSQL = sql.toUpperCase().trim();

        // Check for destructive operations
        const destructiveKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE'];
        for (const keyword of destructiveKeywords) {
            if (upperSQL.includes(keyword)) {
                return { valid: false, error: `Destructive operation not allowed: ${keyword}` };
            }
        }

        // Must start with SELECT
        if (!upperSQL.startsWith('SELECT')) {
            return { valid: false, error: 'Query must be a SELECT statement' };
        }

        // Check for command injection patterns
        const dangerousPatterns = [/;\s*(INSERT|UPDATE|DELETE|DROP)/i, /--/, /\/\*/];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(sql)) {
                return { valid: false, error: 'Potentially dangerous SQL pattern detected' };
            }
        }

        return { valid: true };
    }

    async analyzeQueryForVisualization(sql, results) {
        if (!results || results.length === 0) {
            return { suggestChart: false };
        }

        const columns = Object.keys(results[0]);

        // Determine if data is suitable for visualization
        const hasNumericColumn = columns.some(col =>
            typeof results[0][col] === 'number'
        );

        const hasCategoryColumn = columns.length >= 2 && results.length > 1;

        if (!hasNumericColumn || !hasCategoryColumn) {
            return { suggestChart: false };
        }

        // Suggest chart type based on data structure
        let chartType = 'bar';
        if (results.length > 20) {
            chartType = 'line';
        } else if (columns.length === 2 && hasNumericColumn) {
            chartType = 'pie';
        }

        return {
            suggestChart: true,
            chartType,
            labelColumn: columns[0],
            dataColumns: columns.filter(col => typeof results[0][col] === 'number')
        };
    }
}

module.exports = new NLPToSQL();
