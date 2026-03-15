const Review = require('../models/Review');
const { validationResult } = require('express-validator');

exports.createReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId, orderId, rating, comment } = req.body;

        if (!productId || !orderId || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Thông tin đánh giá không hợp lệ' });
        }

        const review = await Review.create({ userId, productId, orderId, rating, comment });

        res.status(201).json({
            success: true,
            message: 'Đánh giá sản phẩm thành công',
            data: review
        });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Lỗi khi tạo đánh giá',
        });
    }
};

exports.getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const { limit = 20, page = 1 } = req.query;
        const offset = (page - 1) * limit;

        const reviews = await Review.findByProductId(productId, limit, offset);
        const stats = await Review.getProductStats(productId);

        res.json({
            success: true,
            data: {
                reviews,
                stats
            }
        });
    } catch (error) {
        console.error('Get product reviews error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

exports.getMyReviews = async (req, res) => {
    try {
        const userId = req.user.id;
        const reviews = await Review.findByUserId(userId);
        res.json({ success: true, data: reviews });
    } catch (error) {
        console.error('Get my reviews error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
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
