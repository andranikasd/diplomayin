const db = require('../database/connection');
const schemaMetadata = require('./schema-metadata');

/**
 * Smart AI data storage module
 * Creates tables dynamically and stores AI-generated data
 * Ensures schema persists for future queries
 */
class AIDataStorage {
    /**
     * Store AI-generated data by creating tables and inserting rows
     */
    async storeAIGeneratedData(dataArray, userMessage, originalSQL) {
        try {
            if (!dataArray || dataArray.length === 0) {
                return { success: false, reason: 'No data to store' };
            }

            console.log('🔍 Analyzing data structure for storage...');
            const firstItem = dataArray[0];
            const columns = Object.keys(firstItem);

            // Check if matching table already exists
            const matchingTables = await schemaMetadata.findMatchingTables(columns);
            if (matchingTables.length > 0 && matchingTables[0].matchScore >= 0.8) {
                console.log(`✅ Found matching table: ${matchingTables[0].tableName} (${matchingTables[0].rowCount} rows)`);
                // Could append to existing table here if needed
            }

            // Generate a table name based on the data structure
            const tableName = this.generateTableName(columns, userMessage);
            console.log(`📋 Target table: ${tableName}`);

            // Create table if it doesn't exist
            const createTableSQL = this.generateCreateTableSQL(tableName, firstItem);
            console.log('🏗️  Creating table if not exists...');
            await db.query(createTableSQL);

            // Insert data
            console.log(`💾 Inserting ${dataArray.length} rows...`);
            let insertedCount = 0;

            for (const item of dataArray) {
                const insertSQL = this.generateInsertSQL(tableName, item);
                try {
                    await db.query(insertSQL.query, insertSQL.values);
                    insertedCount++;
                } catch (insertError) {
                    // Ignore duplicate key errors
                    if (insertError.code !== '23505') {
                        console.log('⚠️  Insert warning:', insertError.message);
                    }
                }
            }

            console.log(`✅ Successfully stored ${insertedCount}/${dataArray.length} rows in ${tableName}`);

            // Invalidate schema cache so new table is visible
            schemaMetadata.invalidateCache();

            return { success: true, tableName, rowsInserted: insertedCount };

        } catch (error) {
            console.error('❌ Error storing AI data:', error);
            return { success: false, reason: error.message };
        }
    }

    /**
     * Generate a consistent table name based on data structure
     */
    generateTableName(columns, userMessage) {
        // Use key columns to determine table name
        if (columns.includes('brand') && columns.includes('smoker_count')) {
            return 'ai_smoker_statistics';
        }
        if (columns.includes('name') && columns.includes('revenue_estimate')) {
            return 'ai_company_revenue';
        }
        if (columns.includes('city') && columns.includes('population')) {
            return 'ai_city_demographics';
        }
        if (columns.includes('year') && columns.includes('company_count')) {
            return 'ai_company_timeline';
        }
        if (columns.includes('title') && columns.includes('summary')) {
            return 'ai_news_articles';
        }

        // Default: generic AI data table
        return 'ai_generated_data';
    }

    /**
     * Generate CREATE TABLE IF NOT EXISTS statement
     */
    generateCreateTableSQL(tableName, sampleRow) {
        const columns = Object.keys(sampleRow);
        const columnDefs = columns.map(col => {
            const value = sampleRow[col];
            let type = 'TEXT';

            if (typeof value === 'number') {
                type = Number.isInteger(value) ? 'BIGINT' : 'DECIMAL(20,2)';
            } else if (value instanceof Date || col.includes('date')) {
                type = 'TIMESTAMP';
            }

            return `${col} ${type}`;
        }).join(',\n  ');

        // Add metadata columns and UNIQUE constraint on first column for ON CONFLICT
        return `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        ${columnDefs},
        ai_source TEXT DEFAULT 'ai-generated',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (${columns[0]})
      );
      
      -- Create index on first column for better query performance
      CREATE INDEX IF NOT EXISTS idx_${tableName}_${columns[0]} 
      ON ${tableName}(${columns[0]});
    `;
    }

    /**
     * Generate INSERT statement with ON CONFLICT handling
     */
    generateInsertSQL(tableName, row) {
        const columns = Object.keys(row);
        const values = Object.values(row);

        const columnList = columns.join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        // Use first column as conflict target
        const conflictColumn = columns[0];

        return {
            query: `
        INSERT INTO ${tableName} (${columnList})
        VALUES (${placeholders})
        ON CONFLICT (${conflictColumn}) 
        DO UPDATE SET
          ${columns.slice(1).map(col => `${col} = EXCLUDED.${col}`).join(', ')},
          updated_at = CURRENT_TIMESTAMP
      `,
            values
        };
    }
}

module.exports = new AIDataStorage();
