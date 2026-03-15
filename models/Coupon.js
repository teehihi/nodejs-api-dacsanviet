const { pool } = require('../config/database');

class Coupon {
    static async validate(code, userId, orderAmount) {
        const [rows] = await pool.query(
            'SELECT * FROM coupons WHERE code = ? AND is_active = TRUE',
            [code]
        );

        if (rows.length === 0) throw new Error('Mã giảm giá không tồn tại hoặc đã bị khóa');

        const coupon = rows[0];

        // Check expiration
        if (new Date(coupon.expires_at) < new Date()) {
            throw new Error('Mã giảm giá đã hết hạn');
        }

        // Check user restriction
        if (coupon.user_id && coupon.user_id !== userId) {
            throw new Error('Mã giảm giá này không dành cho tài khoản của bạn');
        }

        // Check order minimum amount
        if (parseFloat(orderAmount) < parseFloat(coupon.min_order_amount)) {
            throw new Error(`Đơn hàng tối thiểu ${coupon.min_order_amount}đ để áp dụng mã này`);
        }

        // Check usage limits
        if (coupon.used_count >= coupon.max_uses) {
            throw new Error('Mã giảm giá này đã hết lượt sử dụng');
        }

        // Calculate discount amount
        let discountAmount = 0;
        if (coupon.discount_type === 'PERCENT') {
            discountAmount = (parseFloat(orderAmount) * parseFloat(coupon.discount_value)) / 100;
            if (coupon.max_discount_amount && discountAmount > parseFloat(coupon.max_discount_amount)) {
                discountAmount = parseFloat(coupon.max_discount_amount);
            }
        } else {
            discountAmount = parseFloat(coupon.discount_value);
        }

        // Discount cannot exceed order amount
        if (discountAmount > parseFloat(orderAmount)) {
            discountAmount = parseFloat(orderAmount);
        }

        return {
            isValid: true,
            couponId: coupon.id,
            discountAmount: discountAmount,
            type: coupon.discount_type,
            value: coupon.discount_value,
            code: coupon.code
        };
    }

    static async apply(connection, couponId, userId, orderId, discountApplied) {
        // Insert usage record
        await connection.query(
            'INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_applied) VALUES (?, ?, ?, ?)',
            [couponId, userId, orderId, discountApplied]
        );

        // Increment used count
        await connection.query(
            'UPDATE coupons SET used_count = used_count + 1 WHERE id = ?',
            [couponId]
        );
    }

    static async getUserCoupons(userId) {
        const [rows] = await pool.query(`
      SELECT * FROM coupons 
      WHERE (user_id = ? OR user_id IS NULL) 
        AND is_active = TRUE 
        AND expires_at > NOW()
        AND used_count < max_uses
      ORDER BY expires_at ASC
    `, [userId]);
        return rows;
    }
}

module.exports = Coupon;
