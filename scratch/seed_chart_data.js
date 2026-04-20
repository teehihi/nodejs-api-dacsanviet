const { pool } = require('../config/database');

async function seed() {
    try {
        console.log('Seeding historical DELIVERED orders for the chart...');
        
        const userId = 1;
        const products = [
            { id: 1, name: "Bánh Pía Sóc Trăng", price: 85000 },
            { id: 2, name: "Kẹo Cu Đơ Hà Tĩnh", price: 45000 },
            { id: 3, name: "Chè Lam Thạch Xá", price: 35000 }
        ];

        for (let i = 1; i <= 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().slice(0, 19).replace('T', ' ');
            
            const product = products[i % products.length];
            const orderNumber = `HIST-ORD-${i}-${Date.now()}`;
            const totalAmount = product.price * (1 + (i % 3)); // Varied revenue

            // Insert into orders as DELIVERED
            const [orderResult] = await pool.execute(
                `INSERT INTO orders (
                    order_number, user_id, total_amount, 
                    customer_name, customer_phone, 
                    shipping_address_text, 
                    payment_method, status, created_at, 
                    delivered_at, delivered_date
                ) VALUES (?, ?, ?, ?, ?, ?, 'VNPAY', 'DELIVERED', ?, ?, ?)`,
                [
                    orderNumber, userId, totalAmount,
                    `Customer ${i}`, "0912345678",
                    "A beautiful place",
                    dateStr, dateStr, dateStr
                ]
            );

            const orderId = orderResult.insertId;

            // Insert into order_items
            await pool.execute(
                `INSERT INTO order_items (
                    order_id, product_id, product_name, 
                    quantity, price, unit_price, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [orderId, product.id, product.name, (1 + (i % 3)), totalAmount, product.price, dateStr]
            );

            console.log(`✅ Created historical order ${orderNumber} for date ${dateStr}`);
        }

        console.log('Successfully seeded chart data.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        process.exit(1);
    }
}

seed();
