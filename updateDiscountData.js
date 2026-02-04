const { pool } = require('./config/database');

async function seedDiscounts() {
    console.log('🚀 Đang bắt đầu cập nhật khuyến mãi cho 17 sản phẩm...');

    try {
        // 1. Lấy tất cả sản phẩm hiện có
        const [products] = await pool.execute('SELECT id, price FROM products');

        if (products.length === 0) {
            console.log('⚠️ Không có sản phẩm nào trong database để cập nhật.');
            return;
        }

        for (const product of products) {
            // 2. Tạo logic giảm giá ngẫu nhiên: 
            // Khoảng 70% sản phẩm sẽ được giảm giá, 30% giữ nguyên giá gốc
            const shouldDiscount = Math.random() > 0.3;

            let percent = 0;
            let discountedPrice = null;

            if (shouldDiscount) {
                // Chọn ngẫu nhiên mức giảm: 5%, 10%, 15%, 20%, 25%, 30%, 50%
                const commonPercents = [5, 10, 15, 20, 25, 30, 50];
                percent = commonPercents[Math.floor(Math.random() * commonPercents.length)];

                // Tính giá đã giảm
                discountedPrice = product.price * (1 - percent / 100);
            }

            // 3. Cập nhật vào Database
            await pool.execute(
                'UPDATE products SET discount_percent = ?, discount_price = ? WHERE id = ?',
                [percent > 0 ? percent : null, discountedPrice, product.id]
            );

            console.log(`✨ ID ${product.id.toString().padEnd(3)} | Giảm: ${percent.toString().padStart(2)}% | Giá mới: ${discountedPrice || product.price}`);
        }

        console.log('\n✅ Đã cập nhật xong dữ liệu mẫu cho 17 sản phẩm!');

        // Hiển thị kết quả kiểm tra
        const [results] = await pool.execute('SELECT id, name, price, discount_percent, discount_price FROM products LIMIT 17');
        console.table(results);

    } catch (error) {
        console.error('❌ Lỗi:', error);
    } finally {
        process.exit(0);
    }
}

seedDiscounts();