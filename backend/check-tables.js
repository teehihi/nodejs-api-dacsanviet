require('dotenv').config();
const { pool } = require('./config/database');

async function checkTables() {
    try {
        const [tables] = await pool.execute('SHOW TABLES');
        console.log('Tables in DB:');
        console.log(tables.map(t => Object.values(t)[0]));

        const [reviewsRows] = await pool.execute('DESCRIBE product_reviews');
        console.log('\nProduct Reviews Table Structure:');
        console.table(reviewsRows);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkTables();
