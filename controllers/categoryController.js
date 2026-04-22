const Category = require('../models/Category');

const categoryController = {
    getAllCategories: async (req, res) => {
        try {
            const categories = await Category.findAll();
            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách danh mục',
                error: error.message
            });
        }
    },

    getCategoryById: async (req, res) => {
        try {
            const category = await Category.findById(req.params.id);
            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy danh mục'
                });
            }
            res.json({
                success: true,
                data: category
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy thông tin danh mục',
                error: error.message
            });
        }
    },

    createCategory: async (req, res) => {
        try {
            const data = { ...req.body };
            
            // Nếu có file upload, ưu tiên dùng file
            if (req.file) {
                data.image_url = `/uploads/categories/${req.file.filename}`;
            }

            const categoryId = await Category.create(data);
            res.status(201).json({
                success: true,
                message: 'Tạo danh mục thành công',
                data: { id: categoryId }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi tạo danh mục',
                error: error.message
            });
        }
    },

    updateCategory: async (req, res) => {
        try {
            const data = { ...req.body };
            
            // Nếu có file upload, ưu tiên dùng file
            if (req.file) {
                data.image_url = `/uploads/categories/${req.file.filename}`;
            }

            const updated = await Category.update(req.params.id, data);
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy danh mục hoặc không có thay đổi'
                });
            }
            res.json({
                success: true,
                message: 'Cập nhật danh mục thành công'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật danh mục',
                error: error.message
            });
        }
    },

    deleteCategory: async (req, res) => {
        try {
            const deleted = await Category.delete(req.params.id);
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy danh mục'
                });
            }
            res.json({
                success: true,
                message: 'Xóa danh mục thành công'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi xóa danh mục',
                error: error.message
            });
        }
    },

    getCategoryProducts: async (req, res) => {
        try {
            const products = await Category.getProducts(req.params.id);
            res.json({
                success: true,
                data: products
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách sản phẩm của danh mục',
                error: error.message
            });
        }
    },

    addProductToCategory: async (req, res) => {
        try {
            const { productId } = req.body;
            const updated = await Category.addProductToCategory(req.params.id, productId);
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy danh mục hoặc sản phẩm'
                });
            }
            res.json({
                success: true,
                message: 'Đã thêm sản phẩm vào danh mục thành công'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi thêm sản phẩm vào danh mục',
                error: error.message
            });
        }
    }
};

module.exports = categoryController;
