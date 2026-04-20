require('dotenv').config();
const { pool } = require('./config/database');

async function checkOrders() {
    try {
        const [rows] = await pool.execute('DESCRIBE orders');
        console.log('Orders Table Structure:');
        console.table(rows);
        
        const [itemsRows] = await pool.execute('DESCRIBE order_items');
        console.log('\nOrder Items Table Structure:');
        console.table(itemsRows);

        const [count] = await pool.execute('SELECT COUNT(*) as total FROM orders');
        console.log('\nTotal Orders in DB:', count[0].total);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkOrders();
