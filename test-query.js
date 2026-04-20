require('dotenv').config();
const { pool } = require('./config/database');

async function testQuery() {
    try {
        const query = `SELECT o.*, u.username, u.email, u.full_name as user_full_name,
                         (SELECT COUNT(*) FROM product_reviews pr WHERE pr.order_id = o.id) as reviews_count,
                         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count
      FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 20 OFFSET 0`;

        console.log('Running query...');
        const [orders] = await pool.query(query);
        console.log('Query successful, found', orders.length, 'orders');
        if (orders.length > 0) {
            console.log('First order:', orders[0].id, orders[0].order_number);
        }

        process.exit(0);
    } catch (error) {
        console.error('Query Failed:', error.message);
        process.exit(1);
    }
}

testQuery();
