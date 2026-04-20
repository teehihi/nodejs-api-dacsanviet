require('dotenv').config();
const Order = require('./models/Order');

async function testFindAll() {
    try {
        console.log('Testing Order.findAll()...');
        const result = await Order.findAll({ page: 1, limit: 100 });
        console.log('Total items:', result.pagination.totalItems);
        console.log('Orders returned:', result.orders.length);

        if (result.orders.length > 0) {
            console.log('Sample Order Items Sample:', result.orders[0].items.length);
        }

        process.exit(0);
    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    }
}

testFindAll();
