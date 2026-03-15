const { pool } = require('../config/database');

class Coupon {
    // Validate coupon from `coupons` table (user-specific rewards)
    static async validate(code, userId, orderAmount) {
        const [rows] = await pool.query(
            'SELECT * FROM coupons WHERE code = ? AND is_active = 1',
            [code]
        );

        if (rows.length === 0) {
            // Try promotions table (public promo codes)
            return await Coupon.validatePromotion(code, userId, orderAmount);
        }

        const coupon = rows[0];
        if (new Date(coupon.expires_at) < new Date()) throw new Error('Mã giảm giá đã hết hạn');
        if (coupon.user_id && coupon.user_id !== userId) throw new Error('Mã giảm giá này không dành cho tài khoản của bạn');
        if (parseFloat(orderAmount) < parseFloat(coupon.min_order_amount || 0)) {
            throw new Error(`Đơn hàng tối thiểu ${coupon.min_order_amount}đ để áp dụng mã này`);
        }
        if (coupon.used_count >= coupon.max_uses) throw new Error('Mã giảm giá này đã hết lượt sử dụng');

        let discountAmount = 0;
        if (coupon.discount_type === 'PERCENT') {
            discountAmount = (parseFloat(orderAmount) * parseFloat(coupon.discount_value)) / 100;
            if (coupon.max_discount_amount && discountAmount > parseFloat(coupon.max_discount_amount)) {
                discountAmount = parseFloat(coupon.max_discount_amount);
            }
        } else {
            discountAmount = parseFloat(coupon.discount_value);
        }
        if (discountAmount > parseFloat(orderAmount)) discountAmount = parseFloat(orderAmount);

        return { isValid: true, couponId: coupon.id, source: 'coupon', discountAmount, type: coupon.discount_type, value: coupon.discount_value, code: coupon.code };
    }

    static async validatePromotion(code, userId, orderAmount) {
        const [rows] = await pool.query(
            'SELECT * FROM promotions WHERE code = ? AND is_active = 1 AND start_date <= NOW() AND end_date >= NOW()',
            [code]
        );
        if (rows.length === 0) throw new Error('Mã giảm giá không tồn tại hoặc đã hết hạn');

        const promo = rows[0];
        if (parseFloat(orderAmount) < parseFloat(promo.min_order_value || 0)) {
            throw new Error(`Đơn hàng tối thiểu ${promo.min_order_value}đ để áp dụng mã này`);
        }
        if (promo.usage_limit && promo.used_count >= promo.usage_limit) throw new Error('Mã khuyến mãi đã hết lượt sử dụng');

        let discountAmount = 0;
        if (promo.discount_type === 'PERCENT' || promo.discount_type === 'percentage') {
            discountAmount = (parseFloat(orderAmount) * parseFloat(promo.discount_value)) / 100;
            if (promo.max_discount_amount && discountAmount > parseFloat(promo.max_discount_amount)) {
                discountAmount = parseFloat(promo.max_discount_amount);
            }
        } else {
            discountAmount = parseFloat(promo.discount_value);
        }
        if (discountAmount > parseFloat(orderAmount)) discountAmount = parseFloat(orderAmount);

        return { isValid: true, couponId: promo.id, source: 'promotion', discountAmount, type: promo.discount_type, value: promo.discount_value, code: promo.code };
    }

    static async apply(connection, couponId, userId, orderId, discountApplied, source = 'coupon') {
        if (source === 'coupon') {
            await connection.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [couponId]);
        } else {
            await connection.query('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', [couponId]);
        }
    }

    static async getUserCoupons(userId) {
        // Personal coupons (from reviews, etc.)
        const [coupons] = await pool.query(`
            SELECT id, code, discount_type, discount_value, max_discount_amount, min_order_amount,
                   expires_at, source, 'coupon' as table_source
            FROM coupons
            WHERE (user_id = ? OR user_id IS NULL) AND is_active = 1 AND expires_at > NOW()
              AND used_count < max_uses
            ORDER BY expires_at ASC
        `, [userId]);

        // Public promotions
        const [promos] = await pool.query(`
            SELECT id, code, discount_type, discount_value, max_discount_amount, min_order_value as min_order_amount,
                   end_date as expires_at, 'PROMOTION' as source, 'promotion' as table_source
            FROM promotions
            WHERE is_active = 1 AND start_date <= NOW() AND end_date >= NOW()
              AND (usage_limit IS NULL OR used_count < usage_limit)
            ORDER BY end_date ASC
        `);

        return [...coupons, ...promos];
    }
}

module.exports = Coupon;
