const Coupon = require('../models/Coupon');
const LoyaltyPoints = require('../models/LoyaltyPoints');

exports.getMyCoupons = async (req, res) => {
    try {
        const userId = req.user.id;
        const coupons = await Coupon.getUserCoupons(userId);

        res.json({
            success: true,
            data: coupons
        });
    } catch (error) {
        console.error('Get coupons error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

exports.validateCoupon = async (req, res) => {
    try {
        const userId = req.user.id;
        const { code, orderAmount } = req.body;

        if (!code || orderAmount === undefined) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin xác minh mã giảm giá' });
        }

        const validation = await Coupon.validate(code, userId, orderAmount);

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('Validate coupon error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// Loyalty Points endpoints
exports.getLoyaltyPoints = async (req, res) => {
    try {
        const userId = req.user.id;
        const balance = await LoyaltyPoints.getBalance(userId);

        res.json({
            success: true,
            data: {
                balance: balance.current_balance || 0
            }
        });
    } catch (error) {
        console.error('Get loyalty points error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

exports.getPointsHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const history = await LoyaltyPoints.getHistory(userId);

        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Get point history error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};
