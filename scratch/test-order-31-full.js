const Order = require('../models/Order');
const Review = require('../models/Review');
const { pool } = require('../config/database');

async function test() {
    try {
        const userId = 1; // Assuming user ID 1
        const orderId = 31;
        
        console.log(`Testing findById(${orderId})...`);
        const order = await Order.findById(orderId);
        console.log('Order found.');
        
        console.log(`Testing Review.getOrderReviewStatus(${userId}, ${order.numericId})...`);
        const reviewStatus = await Review.getOrderReviewStatus(userId, order.numericId);
        console.log('Review status found:');
        console.log(JSON.stringify(reviewStatus, null, 2));
        
        console.log('Full data:');
        console.log(JSON.stringify({ order, reviewStatus }, null, 2));
        
        process.exit(0);
    } catch (e) {
        console.error('CRASH DETECTED:');
        console.error(e);
        process.exit(1);
    }
}

test();
