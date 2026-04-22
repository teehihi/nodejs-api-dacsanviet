const { pool } = require('../config/database');

async function updateEnum() {
    try {
        await pool.query(`
            ALTER TABLE orders 
            MODIFY COLUMN status enum(
                'CANCELLED',
                'CONFIRMED',
                'DELIVERED',
                'PENDING',
                'PROCESSING',
                'SHIPPED',
                'CANCEL_REQUESTED',
                'NEW',
                'PREPARING',
                'SHIPPING',
                'COMPLETE'
            ) NOT NULL
        `);
        console.log('Order status enum updated successfully!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

updateEnum();
