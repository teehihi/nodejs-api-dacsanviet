const Order = require('../models/Order');
const { pool } = require('../config/database');

async function test() {
    try {
        console.log('Testing findById(31)...');
        const order = await Order.findById(31);
        console.log('Result found:');
        console.log(JSON.stringify(order, null, 2));
        process.exit(0);
    } catch (e) {
        console.error('CRASH DETECTED:');
        console.error(e);
        process.exit(1);
    }
}

test();
