const db = require('../database/connection');

/**
 * Schema Metadata Service
 * Tracks database schema, available tables, and columns for intelligent query optimization
 */
class SchemaMetadataService {
    constructor() {
        this.schemaCache = null;
        this.lastRefresh = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get current database schema metadata
     */
    async getSchema(forceRefresh = false) {
        if (!forceRefresh && this.schemaCache && this.isCacheValid()) {
            return this.schemaCache;
        }

        console.log('🔄 Refreshing schema metadata...');
        await this.refreshSchema();
        return this.schemaCache;
    }

    /**
     * Refresh schema cache from database
     */
    async refreshSchema() {
        try {
            // Get all tables in public schema
            const tablesResult = await db.query(`
        SELECT 
          table_name,
          (SELECT COUNT(*) FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

            const schema = {
                tables: {},
                lastRefreshed: new Date().toISOString()
            };

            // For each table, get columns and sample row count
            for (const table of tablesResult.rows) {
                const tableName = table.table_name;

                // Get columns with types
                const columnsResult = await db.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);

                // Get row count
                const countResult = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);

                schema.tables[tableName] = {
                    rowCount: parseInt(countResult.rows[0].count),
                    columns: columnsResult.rows.map(col => ({
                        name: col.column_name,
                        type: col.data_type,
                        nullable: col.is_nullable === 'YES',
                        default: col.column_default
                    }))
                };
            }

            this.schemaCache = schema;
            this.lastRefresh = Date.now();

            console.log(`✅ Schema cached: ${Object.keys(schema.tables).length} tables`);
            return schema;

        } catch (error) {
            console.error('❌ Schema refresh error:', error);
            throw error;
        }
    }

    /**
     * Check if table exists and has data
     */
    async tableHasData(tableName) {
        const schema = await this.getSchema();
        const table = schema.tables[tableName.toLowerCase()];

        if (!table) {
            return { exists: false, hasData: false, rowCount: 0 };
        }

        return {
            exists: true,
            hasData: table.rowCount > 0,
            rowCount: table.rowCount,
            columns: table.columns.map(c => c.name)
        };
    }

    /**
     * Find tables that match given columns (for AI data matching)
     */
    async findMatchingTables(columns) {
        const schema = await this.getSchema();
        const matches = [];

        for (const [tableName, tableInfo] of Object.entries(schema.tables)) {
            const tableColumns = tableInfo.columns.map(c => c.name);
            const matchingColumns = columns.filter(col =>
                tableColumns.some(tc => tc.toLowerCase() === col.toLowerCase())
            );

            if (matchingColumns.length >= columns.length * 0.6) { // 60% match threshold
                matches.push({
                    tableName,
                    rowCount: tableInfo.rowCount,
                    matchScore: matchingColumns.length / columns.length,
                    matchingColumns
                });
            }
        }

        return matches.sort((a, b) => b.matchScore - a.matchScore);
    }

    /**
     * Check if data exists for a specific query pattern
     */
    async checkDataExists(queryInfo) {
        try {
            const schema = await this.getSchema();

            // Check if any tables have data for this query type
            if (queryInfo.type === 'company' || queryInfo.mentions?.includes('company')) {
                const companyData = await this.tableHasData('companies');
                const aiCompanyData = await this.tableHasData('ai_company_revenue');

                return companyData.hasData || aiCompanyData.hasData;
            }

            if (queryInfo.type === 'statistics' || queryInfo.mentions?.includes('statistics')) {
                const statsData = await this.tableHasData('statistics');
                const aiStatsData = await this.tableHasData('ai_smoker_statistics');

                return statsData.hasData || aiStatsData.hasData;
            }

            // Generic check: look for any AI-generated tables
            const aiTables = Object.keys(schema.tables).filter(t => t.startsWith('ai_'));
            return aiTables.some(t => schema.tables[t].rowCount > 0);

        } catch (error) {
            console.error('Error checking data existence:', error);
            return false;
        }
    }

    /**
     * Get schema summary for AI context
     */
    async getSchemaSummary() {
        const schema = await this.getSchema();

        return Object.entries(schema.tables).map(([name, info]) => ({
            table: name,
            rows: info.rowCount,
            columns: info.columns.map(c => c.name)
        }));
    }

    isCacheValid() {
        return this.lastRefresh && (Date.now() - this.lastRefresh < this.cacheTimeout);
    }

    /**
     * Invalidate cache (call after creating new tables)
     */
    invalidateCache() {
        this.schemaCache = null;
        this.lastRefresh = null;
    }
}

module.exports = new SchemaMetadataService();
