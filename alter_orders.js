const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '12345678',
      database: process.env.DB_NAME || 'DacSanViet'
    });

    // Check if column exists
    const [rows] = await connection.query("SHOW COLUMNS FROM orders LIKE 'payment_transaction_id'");
    if (rows.length === 0) {
      await connection.query("ALTER TABLE orders ADD COLUMN payment_transaction_id VARCHAR(255) NULL");
      console.log("Added payment_transaction_id column.");
    } else {
      console.log("payment_transaction_id column already exists.");
    }
    
    await connection.end();
  } catch(e) { console.error(e); }
}
run();
