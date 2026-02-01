const Product = require('../models/Product');

const productController = {
    // Lấy danh sách sản phẩm với bộ lọc
    getProducts: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 12;
            const offset = (page - 1) * limit;

            const filters = {
                q: req.query.q,
                minPrice: req.query.minPrice,
                maxPrice: req.query.maxPrice,
                category: req.query.category,
                sort: req.query.sort,
                limit,
                offset
            };

            const products = await Product.findAll(filters);
            const totalItems = await Product.count(filters);
            const totalPages = Math.ceil(totalItems / limit);

            res.json({
                success: true,
                data: products,
                pagination: {
                    page,
                    limit,
                    totalItems,
                    totalPages
                }
            });
        } catch (error) {
            console.error('Get products error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách sản phẩm',
                error: error.message
            });
        }
    },

    // Lấy chi tiết sản phẩm
    getProductById: async (req, res) => {
        try {
            const { id } = req.params;
            const product = await Product.findById(id);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                });
            }

            res.json({
                success: true,
                data: product
            });
        } catch (error) {
            console.error('Get product by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy thông tin sản phẩm',
                error: error.message
            });
        }
    },

    // Lấy danh sách danh mục
    getCategories: async (req, res) => {
        try {
            const categories = await Product.getAllCategories();
            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            console.error('Get categories error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách danh mục',
                error: error.message
            });
        }
    }
};

module.exports = productController;
