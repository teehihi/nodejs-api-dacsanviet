const { pool } = require('../config/database');

async function checkEnum() {
    try {
        const [rows] = await pool.query(`
            SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'orders' 
              AND COLUMN_NAME = 'status'
        `);
        console.log('Current Order Status Enum:');
        console.log(rows[0].COLUMN_TYPE);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkEnum();
