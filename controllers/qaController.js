const ProductQA = require('../models/ProductQA');

exports.getProductComments = async (req, res) => {
    try {
        const { productId } = req.params;
        const comments = await ProductQA.findByProductId(productId);
        res.json({
            success: true,
            data: comments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Không thể tải bình luận',
            error: error.message
        });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { productId } = req.params;
        const { content, parentId } = req.body;
        const userId = req.user.id;
        const userName = req.user.fullName || req.user.username || 'Anonymous';
        const userEmail = req.user.email;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nội dung bình luận không được để trống'
            });
        }

        const commentId = await ProductQA.create({
            productId,
            userId,
            userName,
            userEmail,
            content,
            parentId
        });

        res.status(201).json({
            success: true,
            message: 'Đã đăng bình luận thành công',
            data: { id: commentId }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Không thể đăng bình luận',
            error: error.message
        });
    }
};
