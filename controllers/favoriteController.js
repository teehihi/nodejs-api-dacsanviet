const Favorite = require('../models/Favorite');

exports.toggleFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;

        const result = await Favorite.toggle(userId, productId);

        res.json({
            success: true,
            message: result.liked ? 'Đã thêm vào mục yêu thích' : 'Đã bỏ yêu thích',
            data: result
        });
    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

exports.getFavorites = async (req, res) => {
    try {
        const userId = req.user.id;
        const favorites = await Favorite.findByUserId(userId);

        res.json({
            success: true,
            data: favorites
        });
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

exports.checkStatus = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const { productId } = req.params;

        // Only fetch if authenticated userId is available
        let isLiked = false;
        if (userId) {
            isLiked = await Favorite.isLiked(userId, productId);
        }

        res.json({
            success: true,
            data: { isLiked }
        });
    } catch (error) {
        console.error('Check favorite status error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};
