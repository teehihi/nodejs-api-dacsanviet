const { pool } = require('../config/database');

async function seed() {
    try {
        console.log('Seeding 50 mixed historical orders for a rich statistics view...');
        
        const userId = 1;
        const products = [
            { id: 1, name: "Bánh Pía Sóc Trăng", price: 85000, catId: 1 },
            { id: 2, name: "Kẹo Cu Đơ Hà Tĩnh", price: 45000, catId: 1 },
            { id: 3, name: "Chè Lam Thạch Xá", price: 35000, catId: 1 },
            { id: 4, name: "Nem Chua Thanh Hóa", price: 120000, catId: 2 },
            { id: 5, name: "Chả Cá Lã Vọng", price: 250000, catId: 2 },
            { id: 6, name: "Mực Khô Phan Thiết", price: 450000, catId: 3 }
        ];

        const paymentMethods = ['VNPAY', 'MOMO', 'BANK_TRANSFER', 'COD'];

        for (let i = 0; i < 50; i++) {
            const date = new Date();
            // Randomly distributed over the last 30 days
            const randomDays = Math.floor(Math.random() * 30);
            date.setDate(date.getDate() - randomDays);
            const dateStr = date.toISOString().slice(0, 19).replace('T', ' ');
            
            const product = products[i % products.length];
            const qty = Math.floor(Math.random() * 3) + 1;
            const orderNumber = `STAT-ORD-${i}-${Date.now()}`;
            const totalAmount = product.price * qty;
            const payment = paymentMethods[i % paymentMethods.length];

            // 80% DELIVERED, 10% NEW, 10% CANCELLED
            let status = 'DELIVERED';
            if (i % 10 === 0) status = 'NEW';
            if (i % 10 === 9) status = 'CANCELLED';

            // Insert into orders
            const [orderResult] = await pool.execute(
                `INSERT INTO orders (
                    order_number, user_id, total_amount, 
                    customer_name, customer_phone, 
                    shipping_address_text, 
                    payment_method, status, created_at, 
                    delivered_at, delivered_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderNumber, userId, totalAmount,
                    `Customer ${i}`, "09" + Math.floor(Math.random() * 89999999 + 10000000),
                    "Vietnam",
                    payment, status, 
                    dateStr, 
                    status === 'DELIVERED' ? dateStr : null, 
                    status === 'DELIVERED' ? dateStr : null
                ]
            );

            const orderId = orderResult.insertId;

            // Insert into order_items
            await pool.execute(
                `INSERT INTO order_items (
                    order_id, product_id, product_name, 
                    quantity, price, unit_price, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [orderId, product.id, product.name, qty, totalAmount, product.price, dateStr]
            );
        }

        console.log('✅ Successfully seeded 50 historical orders.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        process.exit(1);
    }
}

seed();
