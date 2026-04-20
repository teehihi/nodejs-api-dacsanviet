require('dotenv').config();
const Order = require('./models/Order');

async function testNaN() {
    try {
        console.log('Testing Order.findAll({ page: "abc" })...');
        const result = await Order.findAll({ page: NaN, limit: 20 });
        console.log('Result:', result.orders.length);
        process.exit(0);
    } catch (error) {
        console.error('Test Failed as expected:', error.message);
        process.exit(0);
    }
}

testNaN();
