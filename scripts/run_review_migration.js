/**
 * Run migration: create product_reviews, loyalty_points, point_transactions, coupons tables
 * Usage: node backend/scripts/run_review_migration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function run() {
  const connection = await mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  console.log('✅ Connected to database:', process.env.DB_NAME);

  const sqlFile = path.join(__dirname, '../migrations/create_reviews_tables.sql');
  const sql     = fs.readFileSync(sqlFile, 'utf8');

  await connection.query(sql);
  console.log('✅ Migration succeeded: product_reviews, loyalty_points, point_transactions, coupons tables ready.');

  await connection.end();
}

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
