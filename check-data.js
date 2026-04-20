require('dotenv').config();
const { pool } = require('./config/database');

async function checkDataInconsistency() {
    try {
        const [orders] = await pool.execute('SELECT id, order_number FROM orders LIMIT 5');
        console.log('Sample Orders:');
        console.table(orders);

        if (orders.length > 0) {
            const orderId = orders[0].id;
            const [items] = await pool.execute('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
            console.log(`\nItems for Order ID ${orderId}:`, items.length);
            console.table(items);
        }

        const [orphans] = await pool.execute('SELECT COUNT(*) as count FROM order_items WHERE order_id NOT IN (SELECT id FROM orders)');
        console.log('\nOrphaned order items (no matching order id):', orphans[0].count);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkDataInconsistency();
