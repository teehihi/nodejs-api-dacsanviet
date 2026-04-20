const Product = require('../models/Product');
const Review = require('../models/Review');
const LoyaltyPoints = require('../models/LoyaltyPoints');
const { pool } = require('../config/database');
const Notification = require('../models/Notification');
const { notifyAdmin } = require('../socket/socketManager');
const { validationResult } = require('express-validator');

// ── POST /api/reviews ─────────────────────────────────────────────────────────
exports.createReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId, orderId, rating, comment } = req.body;

        if (!productId || !orderId || !rating) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
        }

        const review = await Review.create({ userId, productId, orderId, rating, comment });

        // Notify admin about new review (only if reviewer is NOT admin)
        try {
            if (req.user.role !== 'ADMIN') {
                const userName = req.user.fullName || req.user.username || 'Người dùng';

                // Lấy tên sản phẩm để thông báo cho trực quan
                const product = await Product.findById(productId);
                const productName = product ? product.name : `#${productId}`;

                const notif = await Notification.create({
                    userId: null, // broadcast to admin
                    type: 'NEW_REVIEW',
                    title: 'Đánh giá sản phẩm mới',
                    body: `${userName} đã gửi đánh giá ${rating} sao cho sản phẩm "${productName}".`,
                    data: { productId, rating, reviewId: review.id, userName, productName },
                });
                // Gửi cả sự kiện 'new_review' và 'notification' để đảm bảo admin nhận được
                notifyAdmin('new_review', notif);
                notifyAdmin('notification', notif);
            }
        } catch (e) {
            console.error('Notify error:', e.message);
        }

        return res.status(201).json({
            success: true,
            message: 'Đánh giá thành công! Bạn đã nhận được phần thưởng.',
            data: review,
        });
    } catch (error) {
        const status = error.message.includes('ký tự') || error.message.includes('sao') ? 400 : 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

// ── GET /api/reviews/product/:productId ───────────────────────────────────────
exports.getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        const [reviews, stats] = await Promise.all([
            Review.findByProductId(productId, limit, offset),
            Review.getProductStats(productId),
        ]);

        return res.json({ success: true, data: { reviews, stats } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── GET /api/reviews/my ───────────────────────────────────────────────────────
exports.getMyReviews = async (req, res) => {
    try {
        const reviews = await Review.findByUserId(req.user.id);
        return res.json({ success: true, data: reviews });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── GET /api/reviews/check?orderId=&productId= ────────────────────────────────
exports.checkReviewed = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId, productId } = req.query;
        if (!orderId || !productId) {
            return res.status(400).json({ success: false, message: 'Thiếu orderId hoặc productId' });
        }
        const reviewed = await Review.hasReviewed(userId, productId, orderId);
        return res.json({ success: true, data: { reviewed } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── GET /api/reviews/eligibility/:productId ──────────────────────────
exports.checkEligibility = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;

        // Tìm đơn hàng DELIVERED gần nhất của sản phẩm này mà CHƯA đánh giá
        const [rows] = await pool.query(`
            SELECT o.id, o.delivered_at 
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'DELIVERED'
              AND o.delivered_at >= DATE_SUB(NOW(), INTERVAL 10 DAY)
              AND NOT EXISTS (
                  SELECT 1 FROM product_reviews pr 
                  WHERE pr.order_id = o.id AND pr.product_id = ? AND pr.user_id = ?
              )
            ORDER BY o.delivered_at DESC LIMIT 1
        `, [userId, productId, productId, userId]);

        if (rows.length > 0) {
            return res.json({ success: true, canReview: true, orderId: rows[0].id });
        } else {
            return res.json({ success: true, canReview: false });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


// ── GET /api/reviews/pending-for-order/:orderId ───────────────────────────────
exports.getPendingReviewsForOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.params;  // numeric order id

        const items = await Review.getPendingItems(userId, orderId);
        return res.json({ success: true, data: items });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── GET /api/reviews/order-status/:orderId ────────────────────────────────────
exports.getOrderReviewStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.params;
        const status = await Review.getOrderReviewStatus(userId, orderId);
        if (!status) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }
        return res.json({ success: true, data: status });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── GET /api/reviews/my-rewards ───────────────────────────────────────────────
// Returns { points: {...}, coupons: [...], history: [...] }
exports.getMyRewards = async (req, res) => {
    try {
        const userId = req.user.id;

        const [balance, history, coupons] = await Promise.all([
            LoyaltyPoints.getBalance(userId),
            LoyaltyPoints.getHistory(userId),
            pool.query(
                `SELECT id, code, discount_type, discount_value, max_discount_amount,
                        min_order_amount, source, ABS(used_count >= max_uses) as is_used, expires_at, created_at
                 FROM coupons
                 WHERE user_id = ?
                 ORDER BY created_at DESC`,
                [userId]
            ),
        ]);

        return res.json({
            success: true,
            data: {
                points: {
                    balance: balance.current_balance || 0,
                },
                coupons: coupons[0],   // coupons[0] is the rows array
                history: history.slice(0, 30),
            },
        });
    } catch (error) {
        console.error('getMyRewards error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getReviewableItems = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.params;
        const items = await Review.getReviewableItems(userId, orderId);
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Get reviewable items error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};
