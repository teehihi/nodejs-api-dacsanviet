const { pool } = require('../config/database');
const LoyaltyPoints = require('./LoyaltyPoints');

const REVIEW_WINDOW_DAYS = 10;
const MIN_COMMENT_LENGTH = 20;

class Review {
    /**
     * Create a review. Both rating AND comment (≥20 chars) are required to earn rewards.
     */
    static async create({ userId, productId, orderId, rating, comment }) {
        if (!rating || rating < 1 || rating > 5) {
            throw new Error('Vui lòng chọn số sao từ 1 đến 5');
        }
        const commentTrimmed = (comment || '').trim();
        const isEligibleForReward = commentTrimmed.length >= MIN_COMMENT_LENGTH;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Check for duplicate review (Must check per Order)
            const [existing] = await connection.query(
                'SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ? AND order_id = ?',
                [userId, productId, orderId]
            );
            if (existing.length > 0) {
                throw new Error('Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi');
            }

            // Verify the product belongs to a DELIVERED order (using orders.id = numeric PK)
            const [orderCheck] = await connection.query(`
                SELECT oi.id, o.delivered_at
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.id = ?
                  AND o.user_id = ?
                  AND oi.product_id = ?
                  AND o.status = 'DELIVERED'
            `, [orderId, userId, productId]);

            // Get user info for reviewer fields
            const [userRows] = await connection.query(
                'SELECT email, full_name, username FROM users WHERE id = ?',
                [userId]
            );
            const user = userRows[0] || {};
            const reviewerEmail = user.email || '';
            const reviewerName = user.full_name || user.username || '';

            // Enforce 10-day window
            const deliveredAt = orderCheck[0].delivered_at;
            if (deliveredAt) {
                const daysSince = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince > REVIEW_WINDOW_DAYS) {
                    throw new Error(`Đã quá ${REVIEW_WINDOW_DAYS} ngày kể từ khi giao hàng, không thể đánh giá nữa`);
                }
            }

            // Insert review
            const [result] = await connection.query(
                'INSERT INTO product_reviews (user_id, product_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
                [userId, productId, orderId, rating, commentTrimmed]
            );
            const reviewId = result.insertId;
            let reward = null;

            if (isEligibleForReward) {
                // Reward: 500 points
                const pointsReward = 500;
                await LoyaltyPoints.addPoints(
                    connection, userId, pointsReward,
                    'EARN_REVIEW', 'Tặng điểm đánh giá sản phẩm', reviewId
                );

                // Reward: 10%-off coupon (30 days)
                const couponCode = `REV${userId}${Date.now().toString().slice(-6)}`;
                await connection.query(
                    `INSERT INTO coupons 
                        (code, discount_type, discount_value, max_discount_amount, min_order_amount, source, user_id, expires_at)
                     VALUES (?, 'PERCENT', 10, 50000, 0, 'REVIEW_REWARD', ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
                    [couponCode, userId]
                );

                reward = {
                    points: pointsReward,
                    couponCode,
                    couponDescription: 'Giảm 10% (tối đa 50.000đ) – hiệu lực 30 ngày',
                };
            }

            await connection.commit();
            return {
                id: reviewId,
                reward,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async hasReviewed(userId, productId, orderId) {
        const [rows] = await pool.query(
            'SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ? AND order_id = ?',
            [userId, productId, orderId]
        );
        return rows.length > 0;
    }

    /**
     * Get items in a DELIVERED order that can still be reviewed.
     * orderId = numeric PK (orders.id bigint)
     */
    static async getPendingItems(userId, orderId) {
        const numericOrderId = parseInt(orderId, 10);
        if (isNaN(numericOrderId)) return [];

        const [rows] = await pool.query(`
            SELECT
                oi.product_id,
                oi.product_name,
                p.image_url          AS product_image,
                oi.unit_price        AS price,
                oi.quantity,
                o.delivered_at,
                (
                    SELECT COUNT(*)
                    FROM product_reviews r
                    WHERE r.user_id = ? AND r.product_id = oi.product_id AND r.order_id = o.id
                ) AS already_reviewed
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.id = ? AND o.user_id = ? AND o.status = 'DELIVERED'
        `, [userId, numericOrderId, userId]);

        const now = Date.now();
        return rows.map(r => {
            const deliveredAt = r.delivered_at ? new Date(r.delivered_at) : null;
            const daysSince = deliveredAt ? (now - deliveredAt.getTime()) / (1000 * 60 * 60 * 24) : 0;
            const expired = deliveredAt ? daysSince > REVIEW_WINDOW_DAYS : false;
            const daysLeft = deliveredAt
                ? Math.max(0, Math.ceil(REVIEW_WINDOW_DAYS - daysSince))
                : REVIEW_WINDOW_DAYS;

            return {
                productId: r.product_id,
                productName: r.product_name,
                productImage: r.product_image,
                price: parseFloat(r.price),
                quantity: r.quantity,
                alreadyReviewed: r.already_reviewed > 0,
                reviewExpired: expired,
                reviewDeadline: deliveredAt
                    ? new Date(deliveredAt.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000)
                    : null,
                daysLeft,
            };
        });
    }

    /** Reviews for a product (public) */
    static async findByProductId(productId, limit = 20, offset = 0) {
        const [rows] = await pool.query(`
            SELECT
                r.id, r.rating, r.comment, r.created_at,
                u.full_name AS user_name,
                u.username,
                u.avatar_url
            FROM product_reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = ?
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `, [productId, parseInt(limit), parseInt(offset)]);

        // Format avatar URL if needed
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
        return rows.map(row => ({
            ...row,
            avatar_url: row.avatar_url ? (row.avatar_url.startsWith('http') ? row.avatar_url : `${baseUrl}/${row.avatar_url}`) : null
        }));
    }

    /** Reviews by the current user */
    static async findByUserId(userId) {
        const [rows] = await pool.query(`
            SELECT r.*, p.name AS product_name, p.image_url
            FROM product_reviews r
            JOIN products p ON r.product_id = p.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        `, [userId]);
        return rows;
    }

    /** Rating stats for a product */
    static async getProductStats(productId) {
        const [rows] = await pool.query(`
            SELECT
                COUNT(id) AS review_count,
                IFNULL(ROUND(AVG(rating), 1), 0) AS avg_rating,
                SUM(rating = 5) AS five_star,
                SUM(rating = 4) AS four_star,
                SUM(rating = 3) AS three_star,
                SUM(rating = 2) AS two_star,
                SUM(rating = 1) AS one_star
            FROM product_reviews
            WHERE product_id = ?
        `, [productId]);

        return {
            reviewCount: rows[0].review_count,
            avgRating: parseFloat(rows[0].avg_rating),
            distribution: {
                5: rows[0].five_star,
                4: rows[0].four_star,
                3: rows[0].three_star,
                2: rows[0].two_star,
                1: rows[0].one_star,
            },
        };
    }

    /** Overall review status for an order */
    static async getOrderReviewStatus(userId, orderId) {
        const numericId = parseInt(orderId, 10);
        if (isNaN(numericId)) return null;

        const [rows] = await pool.query(`
            SELECT
                o.id, o.status, o.delivered_at,
                COUNT(oi.id)  AS total_items,
                COUNT(pr.id)  AS reviewed_items
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN product_reviews pr
                   ON pr.order_id = o.id AND pr.user_id = ? AND pr.product_id = oi.product_id
            WHERE o.id = ? AND o.user_id = ?
            GROUP BY o.id
        `, [userId, numericId, userId]);

        if (rows.length === 0) return null;

        const row = rows[0];
        const deliveredAt = row.delivered_at ? new Date(row.delivered_at) : null;
        const now = Date.now();
        const daysSince = deliveredAt ? (now - deliveredAt.getTime()) / (1000 * 60 * 60 * 24) : 0;
        const expired = deliveredAt ? daysSince > REVIEW_WINDOW_DAYS : false;
        const daysLeft = deliveredAt ? Math.max(0, Math.ceil(REVIEW_WINDOW_DAYS - daysSince)) : null;

        return {
            canReview: row.status === 'DELIVERED' && !expired,
            allReviewed: row.reviewed_items >= row.total_items,
            daysLeft,
            reviewDeadline: deliveredAt
                ? new Date(deliveredAt.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000)
                : null,
            totalItems: row.total_items,
            reviewedItems: row.reviewed_items,
        };
    }
}

module.exports = Review;
