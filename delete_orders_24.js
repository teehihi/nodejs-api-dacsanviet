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

    console.log("Connected to DB, deleting orders for 2026-04-24...");
    
    // Find all orders on 2026-04-24
    const [orders] = await connection.query(`SELECT id FROM orders WHERE DATE(created_at) = '2026-04-24'`);
    if (orders.length === 0) {
        console.log("No orders found for 2026-04-24.");
        process.exit(0);
    }
    
    const orderIds = orders.map(o => o.id);
    console.log(`Found ${orderIds.length} orders. Deleting child records first...`);

    // We can't delete directly without turning off FK checks OR deleting children first.
    // Let's delete children first.
    // Or we can just disable FK checks temporarily. Let's do that for ease.
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    const idList = orderIds.join(',');
    
    await connection.query(`DELETE FROM order_items WHERE order_id IN (${idList})`);
    console.log('Deleted order_items.');
    
    const [result] = await connection.query(`DELETE FROM orders WHERE id IN (${idList})`);
    console.log(`Deleted ${result.affectedRows} orders from 'orders' table.`);
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Done!');
    await connection.end();
  } catch(e) { console.error(e); }
}
run();
