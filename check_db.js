const { pool } = require('./config/database');

async function check() {
  const [rows] = await pool.query("SELECT id, status, created_at, delivered_at, total_amount FROM orders WHERE status = 'DELIVERED'");
  console.log("Delivered Orders:");
  console.table(rows);
  process.exit(0);
}
check();
