const { pool } = require('../config/database');

async function check() {
    try {
        const [rows] = await pool.query('DESCRIBE orders');
        console.log('Orders table schema:');
        console.table(rows);
        
        const [orderRows] = await pool.query('SELECT id FROM orders LIMIT 5');
        console.log('Sample order IDs:');
        console.log(orderRows);
        orderRows.forEach(row => {
            console.log(`ID: ${row.id}, Type: ${typeof row.id}`);
        });
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
