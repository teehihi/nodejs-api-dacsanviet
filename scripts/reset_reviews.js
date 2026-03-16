require('dotenv').config({ path: '../.env' }); // or '.' if adjusting
const mysql = require('mysql2/promise');

(async function() {
    try {
        require('dotenv').config();
        const pool = mysql.createPool({ 
            host: process.env.DB_HOST || 'localhost', 
            user: process.env.DB_USER || 'root', 
            password: process.env.DB_PASSWORD || '', 
            database: process.env.DB_NAME || 'dacsanviet', 
            port: process.env.DB_PORT || 3306 
        });

        // 1. Drop old table
        await pool.query('DROP TABLE IF EXISTS review_images');
        await pool.query('DROP TABLE IF EXISTS product_reviews');
        console.log('✅ Dropped old product_reviews');

        // 2. Re-create new schema
        await pool.query(`
            CREATE TABLE product_reviews (
                id          BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id     BIGINT NOT NULL,
                product_id  BIGINT NOT NULL,
                order_id    BIGINT NOT NULL,
                rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
                comment     TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_product_order (user_id, product_id, order_id),
                FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                INDEX idx_product_id (product_id),
                INDEX idx_user_id    (user_id),
                INDEX idx_order_id   (order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Created new product_reviews table');

        // 3. Mark the specified order IDs as DELIVERED to ensure test data is correct
        // The user mentioned order_id = 19 is DELIVERED but gives error because it's missing product_reviews.order_id
        await pool.query(`UPDATE orders SET status = 'DELIVERED', delivered_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id IN (16, 17, 18, 19)`);
        console.log('✅ Updated recent orders (id 16-19) to DELIVERED with delivered_at=yesterday');

        // 4. (Optional) insert a sample review for another order if it exists, to test "already reviewed" state.
        // Let's check some previous order items
        const [items] = await pool.query('SELECT oi.product_id, o.id as order_id, o.user_id FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.id = 18 LIMIT 1');
        if (items.length > 0) {
            await pool.query(
                `INSERT IGNORE INTO product_reviews (user_id, product_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)`,
                [items[0].user_id, items[0].product_id, items[0].order_id, 5, "Sản phẩm tốt, giao hàng nhanh, rất ưng ý!"]
            );
            console.log(`✅ Added fake reviewed item for order 18, product ${items[0].product_id}`);
        } else {
            console.log('ℹ️ Order 18 has no items, skipping fake review insertion.');
        }

        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
})();
