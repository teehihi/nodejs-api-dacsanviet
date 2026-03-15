const { pool } = require('../config/database');
const LoyaltyPoints = require('./LoyaltyPoints');

class Review {
    static async create({ userId, productId, orderId, rating, comment }) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Check if user has already reviewed this product in this order
            const [existing] = await connection.query(
                'SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ? AND order_id = ?',
                [userId, productId, orderId]
            );

            if (existing.length > 0) {
                throw new Error('Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi');
            }

            // Check if product was bought in that order by the user
            const [orderCheck] = await connection.query(`
        SELECT oi.id 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.id = ? AND o.user_id = ? AND oi.product_id = ? AND o.status = 'DELIVERED'
      `, [orderId, userId, productId]);

            if (orderCheck.length === 0) {
                throw new Error('Sản phẩm chưa được giao hoặc không thuộc đơn hàng này');
            }

            // Insert review
            const [result] = await connection.query(
                'INSERT INTO product_reviews (user_id, product_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
                [userId, productId, orderId, rating, comment]
            );

            const reviewId = result.insertId;

            // Reward points (e.g., 500 points per review)
            const pointsReward = 500;
            await LoyaltyPoints.addPoints(connection, userId, pointsReward, 'EARN_REVIEW', 'Tặng điểm đánh giá sản phẩm', reviewId);

            // Give a coupon (e.g., 10% off, max 50k)
            const couponCode = `REV${userId}${Date.now().toString().slice(-4)}`;
            await connection.query(
                `INSERT INTO coupons (code, discount_type, discount_value, max_discount_amount, min_order_amount, source, user_id, expires_at) 
         VALUES (?, 'PERCENT', 10, 50000, 0, 'REVIEW_REWARD', ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
                [couponCode, userId]
            );

            await connection.commit();

            return {
                id: reviewId,
                reward: {
                    points: pointsReward,
                    couponCode
                }
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findByProductId(productId, limit = 20, offset = 0) {
        const [rows] = await pool.query(`
      SELECT r.*, u.full_name as user_name, u.username 
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
      SELECT r.*, p.name as product_name, p.image_url 
      FROM product_reviews r
      JOIN products p ON r.product_id = p.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [userId]);
        return rows;
    }

    static async getProductStats(productId) {
        const [rows] = await pool.query(`
      SELECT 
        COUNT(id) as reviewCount,
        IFNULL(AVG(rating), 0) as avgRating
      FROM product_reviews
      WHERE product_id = ?
    `, [productId]);

        // Also get buyer count (how many unique users bought it)
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
            total_reviews: rows[0].reviewCount,
            avg_rating: parseFloat(rows[0].avgRating).toFixed(1)
        };
    }
}

module.exports = Review;
