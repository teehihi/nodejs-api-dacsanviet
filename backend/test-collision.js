require('dotenv').config();
const { pool } = require('./config/database');

async function testCollision() {
    try {
        const query = `SELECT o.*, u.username, u.email, u.full_name as user_full_name
      FROM orders o LEFT JOIN users u ON o.user_id = u.id LIMIT 1`;

        const [orders] = await pool.query(query);
        const order = orders[0];
        
        console.log('Order columns found in result:', Object.keys(order));
        console.log('Order ID from result:', order.id);
        console.log('Order user_id from result:', order.user_id);
        
        const [realOrder] = await pool.execute('SELECT id FROM orders WHERE order_number = ?', [order.order_number]);
        console.log('Real Order ID:', realOrder[0].id);

        if (order.id !== realOrder[0].id) {
            console.log('!!! COLLISION DETECTED !!! Result id is ' + order.id + ' but should be ' + realOrder[0].id);
        } else {
            console.log('No collision in this specific case, but it might happen if users table has id and we use u.* or similar.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

testCollision();
