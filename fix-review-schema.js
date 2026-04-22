require('dotenv').config();
const { pool } = require('./config/database');

async function fixSchema() {
    console.log('Checking product_reviews schema...');
    const [columns] = await pool.query('DESCRIBE product_reviews');
    const columnNames = columns.map(c => c.Field);

    if (columnNames.includes('content') && !columnNames.includes('comment')) {
        console.log('Renaming content to comment...');
        await pool.query('ALTER TABLE product_reviews CHANGE COLUMN content comment TEXT');
    }

    if (!columnNames.includes('order_id')) {
        console.log('Adding order_id column...');
        // We need order_id to be NOT NULL, but for existing rows we might need to handle it.
        // For now, let's just add it as BIGINT.
        await pool.query('ALTER TABLE product_reviews ADD COLUMN order_id BIGINT AFTER product_id');
    }
    
    // Check if other tables from migration exist
    const [tables] = await pool.query('SHOW TABLES');
    const tableList = tables.map(t => Object.values(t)[0]);
    
    if (!tableList.includes('loyalty_points') || !tableList.includes('point_transactions') || !tableList.includes('coupons')) {
        console.log('Running main migration to ensure all tables exist...');
        const fs = require('fs');
        const path = require('path');
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'create_reviews_tables.sql'), 'utf8');
        await pool.query(sql);
    }

    console.log('✅ Schema fixed successfully.');
    process.exit(0);
}

fixSchema().catch(err => {
    console.error('❌ Fix failed:', err);
    process.exit(1);
});
