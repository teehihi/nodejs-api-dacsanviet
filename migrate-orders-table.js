const { pool } = require('./config/database');

async function migrateOrdersTable() {
    try {
        console.log('🔧 Migrating orders table...');

        // Check existing columns
        const [cols] = await pool.execute(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
        `);
        const existing = cols.map(c => c.COLUMN_NAME);
        console.log('Existing columns:', existing);

        // Create orders table if not exists (full schema)
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(50) PRIMARY KEY,
                user_id BIGINT NOT NULL,
                total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
                shipping_full_name VARCHAR(255),
                shipping_phone VARCHAR(20),
                shipping_address VARCHAR(500),
                shipping_ward VARCHAR(100),
                shipping_district VARCHAR(100),
                shipping_city VARCHAR(100),
                shipping_note TEXT,
                payment_method VARCHAR(50) DEFAULT 'COD',
                status VARCHAR(50) DEFAULT 'NEW',
                cancel_deadline DATETIME,
                confirmed_at DATETIME,
                cancelled_at DATETIME,
                delivered_at DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Create order_items table if not exists
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS order_items (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                product_id BIGINT,
                product_name VARCHAR(255) NOT NULL,
                product_image VARCHAR(500),
                price DECIMAL(15,2) NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Add missing columns to orders if table already exists
        const columnsToAdd = [
            ['shipping_full_name', 'VARCHAR(255)'],
            ['shipping_phone', 'VARCHAR(20)'],
            ['shipping_address', 'VARCHAR(500)'],
            ['shipping_ward', 'VARCHAR(100)'],
            ['shipping_district', 'VARCHAR(100)'],
            ['shipping_city', 'VARCHAR(100)'],
            ['shipping_note', 'TEXT'],
            ['cancel_deadline', 'DATETIME'],
            ['confirmed_at', 'DATETIME'],
            ['cancelled_at', 'DATETIME'],
            ['delivered_at', 'DATETIME'],
        ];

        for (const [col, type] of columnsToAdd) {
            if (!existing.includes(col)) {
                await pool.execute(`ALTER TABLE orders ADD COLUMN ${col} ${type}`);
                console.log(`✅ Added column: ${col}`);
            } else {
                console.log(`ℹ️  Column exists: ${col}`);
            }
        }

        console.log('\n✅ Orders migration completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrateOrdersTable();
