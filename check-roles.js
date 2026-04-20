require('dotenv').config();
const { pool } = require('./config/database');

async function checkRoles() {
    try {
        const [rows] = await pool.execute('SELECT DISTINCT role FROM users');
        console.log('Roles in users table:');
        console.table(rows);

        const [admin] = await pool.execute('SELECT * FROM users WHERE email = "admin@dacsanviet.com"');
        if (admin.length > 0) {
            console.log('Admin user role:', admin[0].role);
        } else {
            console.log('Admin user not found');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkRoles();
