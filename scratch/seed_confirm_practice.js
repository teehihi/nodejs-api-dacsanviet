const { pool } = require('../config/database');

async function seed() {
    try {
        console.log('Seeding 5 MORE NEW orders for confirmation practice...');
        
        const userId = 1; // admin user
        const sampleProducts = [
            { id: 16, name: "Chả Cá Lã Vọng", price: 120000 },
            { id: 15, name: "Bánh Pía Sóc Trăng", price: 85000 },
            { id: 14, name: "Kẹo Cu Đơ Hà Tĩnh", price: 45000 },
            { id: 12, name: "Mù Tạt Cổ Truyền", price: 35000 },
            { id: 9, name: "[HOT] Bánh Căn Phan Thiết", price: 50000 }
        ];

        const customers = [
            { name: "Lưu Thế I", phone: "0966666666", address: "606 Nguyễn Huệ, Quận 1, TP.HCM" },
            { name: "Vũ Văn J", phone: "0977777777", address: "707 Đồng Khởi, Quận 1, TP.HCM" },
            { name: "Trần Thị K", phone: "0988888888", address: "808 Lê Lợi, Quận 1, TP.HCM" },
            { name: "Lê Văn L", phone: "0999999999", address: "909 Pasteur, Quận 3, TP.HCM" },
            { name: "Nguyễn Thị M", phone: "0900000001", address: "111 Cách Mạng Tháng 8, Quận 10, TP.HCM" }
        ];

        for (let i = 0; i < 5; i++) {
            const customer = customers[i];
            const product = sampleProducts[i];
            const orderNumber = `ORD-CONFIRM-PRACTICE-${Date.now()}-${i}`;
            const totalAmount = product.price;

            // Insert into orders
            const [orderResult] = await pool.execute(
                `INSERT INTO orders (
                    order_number, user_id, total_amount, 
                    customer_name, customer_phone, 
                    shipping_address_text, 
                    payment_method, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', NOW())`,
                [
                    orderNumber, userId, totalAmount,
                    customer.name, customer.phone,
                    customer.address,
                    'COD'
                ]
            );

            const orderId = orderResult.insertId;

            // Insert into order_items
            await pool.execute(
                `INSERT INTO order_items (
                    order_id, product_id, product_name, 
                    quantity, price, unit_price, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [orderId, product.id, product.name, 1, product.price, product.price]
            );

            console.log(`✅ Created practice order ${orderNumber} (ID: ${orderId})`);
        }

        console.log('Successfully seeded 5 practice orders.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        process.exit(1);
    }
}

seed();
