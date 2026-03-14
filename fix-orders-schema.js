require('dotenv').config();
const { pool } = require('./config/database');

async function fixOrdersTable() {
    try {
        console.log('🔧 Fixing orders table...');

        // Drop existing orders & order_items (CASCADE)
        await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
        await pool.execute('DROP TABLE IF EXISTS order_items');
        await pool.execute('DROP TABLE IF EXISTS orders');
        await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Dropped old tables');

        // Re-create orders with correct schema
        await pool.execute(`
            CREATE TABLE orders (
                id          BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id     BIGINT NOT NULL,
                total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
                shipping_full_name VARCHAR(255),
                shipping_phone     VARCHAR(20),
                shipping_address   VARCHAR(500),
                shipping_ward      VARCHAR(100),
                shipping_district  VARCHAR(100),
                shipping_city      VARCHAR(100),
                shipping_note      TEXT,
                payment_method     VARCHAR(50) DEFAULT 'COD',
                status             VARCHAR(50) DEFAULT 'NEW',
                cancel_deadline    DATETIME,
                confirmed_at       DATETIME,
                cancelled_at       DATETIME,
                delivered_at       DATETIME,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ Created orders table');

        // Re-create order_items
        await pool.execute(`
            CREATE TABLE order_items (
                id           BIGINT AUTO_INCREMENT PRIMARY KEY,
                order_id     BIGINT NOT NULL,
                product_id   BIGINT,
                product_name VARCHAR(255) NOT NULL,
                product_image VARCHAR(500),
                price        DECIMAL(15,2) NOT NULL,
                quantity     INT NOT NULL DEFAULT 1,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ Created order_items table');

        console.log('\n✅ Done! Orders tables recreated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

fixOrdersTable();
