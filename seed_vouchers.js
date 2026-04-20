require('dotenv').config();
const mysql = require('mysql2/promise');

async function seedVouchers() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '12345',
        database: process.env.DB_NAME || 'DacSanViet',
    });

    try {
        // Tạo 2 voucher mẫu cho tất cả user (user_id = NULL)
        const vouchers = [
            {
                code: 'GIAM10',
                discount_type: 'PERCENT',
                discount_value: 10,
                max_discount_amount: 50000,
                min_order_amount: 100000,
                max_uses: 100,
                source: 'ADMIN',
                user_id: null,
                expires_at: '2026-12-31 23:59:59'
            },
            {
                code: 'GIAM20',
                discount_type: 'PERCENT',
                discount_value: 20,
                max_discount_amount: 100000,
                min_order_amount: 200000,
                max_uses: 50,
                source: 'ADMIN',
                user_id: null,
                expires_at: '2026-12-31 23:59:59'
            }
        ];

        for (const v of vouchers) {
            // Xoá nếu đã tồn tại
            await pool.execute('DELETE FROM coupons WHERE code = ?', [v.code]);

            await pool.execute(`
                INSERT INTO coupons 
                (code, discount_type, discount_value, max_discount_amount, min_order_amount, max_uses, user_id, expires_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [v.code, v.discount_type, v.discount_value, v.max_discount_amount, v.min_order_amount, v.max_uses, v.user_id, v.expires_at]);

            console.log(`✅ Đã tạo voucher: ${v.code} - Giảm ${v.discount_value}% (tối đa ${v.max_discount_amount.toLocaleString()}đ, đơn từ ${v.min_order_amount.toLocaleString()}đ)`);
        }

        console.log('\n🎉 Seed voucher hoàn thành!');
        console.log('📝 Dùng mã GIAM10 để giảm 10%');
        console.log('📝 Dùng mã GIAM20 để giảm 20%');
    } catch (error) {
        console.error('Lỗi:', error.message);
    } finally {
        await pool.end();
    }
}

seedVouchers();
