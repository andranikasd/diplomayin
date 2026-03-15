const fs = require('fs');
const path = require('path');
const db = require('./connection');

async function runMigration() {
    console.log('🔄 Running database migration...');

    try {
        // Read the schema SQL file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute the schema
        await db.query(schema);

        console.log('✅ Database migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
