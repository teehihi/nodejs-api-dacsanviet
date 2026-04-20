const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDB() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        const [products] = await pool.query('SELECT count(*) as count FROM products');
        console.log('Total Products:', products[0].count);

        const [sample] = await pool.query('SELECT name, price, stock_quantity, image_url FROM products LIMIT 5');
        console.log('Sample Products:', sample);

        const [coupons] = await pool.query('SELECT count(*) as count FROM coupons');
        console.log('Total Coupons:', coupons[0].count);

        await pool.end();
    } catch (err) {
        console.error('Error checking DB:', err);
    }
}

checkDB();
