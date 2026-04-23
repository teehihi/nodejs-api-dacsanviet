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

    const [result] = await connection.query("UPDATE orders SET payment_status = 'PENDING' WHERE payment_status IS NULL");
    console.log(`Updated ${result.affectedRows} orders to PENDING payment_status`);
    await connection.end();
  } catch(e) { console.error(e); }
}
run();
