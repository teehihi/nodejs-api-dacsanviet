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

    console.log('Connected to DB');

    // Find orders from 2026-04-24
    const [orders] = await connection.execute("SELECT id FROM orders WHERE DATE(created_at) = '2026-04-24'");
    console.log(`Found ${orders.length} orders on 2026-04-24`);

    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      
      // Delete order_items
      const [result1] = await connection.query("DELETE FROM order_items WHERE order_id IN (?)", [orderIds]);
      console.log(`Deleted ${result1.affectedRows} order_items`);

      // Try to delete order_status_history if it exists
      try {
        const [result2] = await connection.query("DELETE FROM order_status_history WHERE order_id IN (?)", [orderIds]);
        console.log(`Deleted ${result2.affectedRows} order_status_history`);
      } catch (e) {
        console.log("No order_status_history table or column, skipping...");
      }

      // Delete orders
      const [result3] = await connection.query("DELETE FROM orders WHERE id IN (?)", [orderIds]);
      console.log(`Deleted ${result3.affectedRows} orders`);
    }

    await connection.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
