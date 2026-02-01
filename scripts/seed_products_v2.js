const { pool, testConnection } = require('../config/database');
require('dotenv').config();

const categories = [
    'Cà phê', 'Hạt khô', 'Trà', 'Bánh kẹo', 'Đặc sản phơi khô', 'Mắm', 'Đồ uống'
];

const products = [
    {
        name: 'Cà phê Robusta Tây Nguyên',
        description: 'Cà phê Robusta nguyên chất, hương vị đậm đà đặc trưng của vùng đất đỏ Bazan.',
        price: 150000,
        category: 'Cà phê',
        image_url: '/uploads/products/coffee-robusta.jpg'
    },
    {
        name: 'Hạt điều rang muối Bình Phước',
        description: 'Hạt điều loại A, rang củi thủ công, giòn rụm, béo ngậy.',
        price: 320000,
        category: 'Hạt khô',
        image_url: '/uploads/products/hat-dieu.jpg'
    },
    {
        name: 'Trà sen Tây Hồ',
        description: 'Trà ướp sen Tây Hồ thượng hạng, hương thơm tinh tế, vị trà chát dịu.',
        price: 500000,
        category: 'Trà',
        image_url: '/uploads/products/tra-sen.jpg'
    },
    {
        name: 'Bánh pía Sóc Trăng',
        description: 'Bánh pía sầu riêng trứng muối, đặc sản nổi tiếng miền Tây.',
        price: 65000,
        category: 'Bánh kẹo',
        image_url: '/uploads/products/banh-pia.jpg'
    },
    {
        name: 'Nem chua Thanh Hóa',
        description: 'Nem chua truyền thống, vị chua cay mặn ngọt hài hòa.',
        price: 45000,
        category: 'Đặc sản phơi khô',
        image_url: '/uploads/products/nem-chua.jpg'
    },
    {
        name: 'Mắm tôm chua Huế',
        description: 'Mắm tôm chua đậm đà hương vị cố đô, ăn kèm thịt luộc ngon tuyệt.',
        price: 85000,
        category: 'Mắm',
        image_url: '/uploads/products/mam-tom-chua.jpg'
    },
    {
        name: 'Kẹo cu đơ Hà Tĩnh',
        description: 'Kẹo lạc giòn tan, ngọt ngào hương mật mía và gừng cay ấm.',
        price: 35000,
        category: 'Bánh kẹo',
        image_url: '/uploads/products/keo-cu-do.jpg'
    },
    {
        name: 'Rượu cần Hòa Bình',
        description: 'Rượu cần men lá truyền thống, hương vị nồng nàn say đắm.',
        price: 250000,
        category: 'Đồ uống',
        image_url: '/uploads/products/ruou-can.jpg'
    }
];

async function seed() {
    await testConnection();

    try {
        // 1. Get existing categories
        const [catRows] = await pool.execute('SELECT id, name FROM categories');
        if (catRows.length === 0) {
            console.error('No categories found. Cannot seed products without categories.');
            process.exit(1);
        }
        const catIds = catRows.map(c => c.id);
        console.log(`Found ${catIds.length} existing categories.`);

        // 1.5 Ensure Supplier exists
        console.log('Ensuring supplier...');
        const [supplierRows] = await pool.execute('SELECT id FROM suppliers LIMIT 1');
        let supplierId;
        if (supplierRows.length > 0) {
            supplierId = supplierRows[0].id;
        } else {
            try {
                const [res] = await pool.execute("INSERT INTO suppliers (name, address, email, phone, is_active, tax_code, created_at) VALUES ('Dac San Viet Default', 'Hanoi', 'contact@dacsanviet.com', '0123456789', 1, '1234567890', NOW())");
                supplierId = res.insertId;
                console.log('Created default supplier');
            } catch (err) {
                console.error('Error creating supplier:', err.sqlMessage);
                throw err;
            }
        }

        // 2. Insert products
        const [existing] = await pool.execute('SELECT COUNT(*) as count FROM products');
        if (existing[0].count > 0) {
            console.log(`Products table already has ${existing[0].count} items. Skipping seed.`);
            process.exit(0);
        }

        const insertQuery = `
      INSERT INTO products 
      (name, description, short_description, price, category_id, image_url, stock_quantity, is_active, origin, weight_grams, is_featured, supplier_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 100, 1, 'Vietnam', 500, 0, ?, NOW())
    `;

        for (const p of products) {
            console.log(`Inserting product ${p.name}...`);
            // Pick random category
            const randomCatId = catIds[Math.floor(Math.random() * catIds.length)];

            try {
                await pool.execute(insertQuery, [
                    p.name,
                    p.description,
                    p.description.substring(0, 100) + '...', // short_description
                    p.price,
                    randomCatId,
                    p.image_url,
                    supplierId
                ]);
                console.log(`inserted: ${p.name}`);
            } catch (err) {
                console.error(`Error inserting product ${p.name}:`, err.sqlMessage);
                throw err;
            }
        }

        console.log('Done seeding.');

    } catch (err) {
        console.error('Seed error MSG:', err.sqlMessage);
    }
    process.exit();
}

seed();
