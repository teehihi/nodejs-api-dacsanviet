require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'dacsanviet',
  });

  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivered_at'`,
      [process.env.DB_NAME || 'dacsanviet']
    );

    if (cols.length === 0) {
      await conn.query('ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMP NULL');
      console.log('✅ Added delivered_at column to orders table');
    } else {
      console.log('ℹ️  delivered_at column already exists');
    }
  } finally {
    await conn.end();
    process.exit(0);
  }
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
