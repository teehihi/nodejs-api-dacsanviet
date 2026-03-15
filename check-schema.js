const { pool, testConnection } = require('./config/database');
require('dotenv').config();

async function check() {
    await testConnection();
    console.log('Checking database:', process.env.DB_NAME);
    try {
        const [columns] = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'suppliers'
    `, [process.env.DB_NAME]);
        console.log('Columns in suppliers table:', columns.length);
        console.table(columns);

        // Check tables to be sure
        const [tables] = await pool.execute(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?
    `, [process.env.DB_NAME]);
        console.log('Tables in DB:', tables.map(t => t.TABLE_NAME));

    } catch (err) {
        console.error(err);
    }
    process.exit();
}

check();
