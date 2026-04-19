const { pool } = require('../config/database');
const LoyaltyPoints = require('./LoyaltyPoints');

class Review {
    static async create({ userId, productId, orderId, rating, comment }) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Check duplicate review (per product, not per order since no order_id column)
            const [existing] = await connection.query(
                'SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ?',
                [userId, productId]
            );
            if (existing.length > 0) throw new Error('Bạn đã đánh giá sản phẩm này rồi');

            // Check product was delivered in that order
            const [orderCheck] = await connection.query(`
                SELECT oi.id FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.id = ? AND o.user_id = ? AND oi.product_id = ? AND o.status = 'DELIVERED'
            `, [orderId, userId, productId]);
            if (orderCheck.length === 0) throw new Error('Sản phẩm chưa được giao hoặc không thuộc đơn hàng này');

            // Get user info for reviewer fields
            const [userRows] = await connection.query(
                'SELECT email, full_name, username FROM users WHERE id = ?',
                [userId]
            );
            const user = userRows[0] || {};
            const reviewerEmail = user.email || '';
            const reviewerName = user.full_name || user.username || '';

            // Insert review
            const [result] = await connection.query(
                `INSERT INTO product_reviews (user_id, product_id, rating, content, is_verified_buyer, reviewer_email, reviewer_name, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 1, ?, ?, NOW(), NOW())`,
                [userId, productId, rating, comment, reviewerEmail, reviewerName]
            );
            const reviewId = result.insertId;

            // Reward 500 points
            const pointsReward = 500;
            await LoyaltyPoints.addPoints(connection, userId, pointsReward, 'EARN_REVIEW', 'Tặng điểm đánh giá sản phẩm', reviewId);

            // Give coupon 10% off
            const couponCode = `REV${userId}${Date.now().toString().slice(-4)}`;
            await connection.query(
                `INSERT INTO coupons (code, discount_type, discount_value, max_discount_amount, min_order_amount, source, user_id, expires_at, max_uses, is_active)
                 VALUES (?, 'PERCENT', 10, 50000, 0, 'REVIEW_REWARD', ?, DATE_ADD(NOW(), INTERVAL 30 DAY), 1, 1)`,
                [couponCode, userId]
            );

            await connection.commit();
            return { id: reviewId, reward: { points: pointsReward, couponCode } };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findByProductId(productId, limit = 20, offset = 0) {
        const [rows] = await pool.query(`
            SELECT r.id, r.rating, r.content as comment, r.created_at, r.is_verified_buyer,
                   u.full_name as user_name, u.username, u.avatar_url
            FROM product_reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = ?
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `, [productId, parseInt(limit), parseInt(offset)]);
        return rows;
    }

    static async findByUserId(userId) {
        const [rows] = await pool.query(`
            SELECT r.id, r.rating, r.content as comment, r.created_at, r.product_id,
                   p.name as product_name, p.image_url
            FROM product_reviews r
            JOIN products p ON r.product_id = p.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        `, [userId]);
        return rows;
    }

    // Get products in a delivered order that haven't been reviewed yet
    static async getReviewableItems(userId, orderId) {
        const [rows] = await pool.query(`
            SELECT oi.product_id, oi.product_name, oi.product_image_url,
                   (SELECT id FROM product_reviews WHERE user_id = ? AND product_id = oi.product_id) as review_id
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.id = ? AND o.user_id = ? AND o.status = 'DELIVERED'
        `, [userId, orderId, userId]);
        return rows;
    }

    static async getProductStats(productId) {
        const [rows] = await pool.query(`
            SELECT COUNT(id) as reviewCount, IFNULL(AVG(rating), 0) as avgRating
            FROM product_reviews WHERE product_id = ?
        `, [productId]);

        const [buyerRows] = await pool.query(`
            SELECT COUNT(DISTINCT o.user_id) as buyerCount
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = ? AND o.status IN ('DELIVERED', 'COMPLETED')
        `, [productId]);

        return {
            reviewCount: rows[0].reviewCount,
            avgRating: parseFloat(rows[0].avgRating).toFixed(1),
            buyerCount: buyerRows[0].buyerCount,
        };
    }
}

module.exports = Review;
