require('dotenv').config();
const { pool } = require('./config/database');

async function checkUserTables() {
    try {
        const [usersCount] = await pool.execute('SELECT COUNT(*) as count FROM users');
        console.log('Users (plural) count:', usersCount[0].count);

        const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM user');
        console.log('User (singular) count:', userCount[0].count);

        const [sampleOrders] = await pool.execute('SELECT user_id FROM orders LIMIT 10');
        console.log('\nSample Order User IDs:', sampleOrders.map(o => o.user_id));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkUserTables();
