const Product = require('../models/Product');

const productController = {
    // Lấy danh sách sản phẩm với bộ lọc
    getProducts: async (req, res) => {
        try {
            console.log('📥 Request query params:', req.query);

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 12;
            const queryOffset = req.query.offset !== undefined ? parseInt(req.query.offset) : null;
            const offset = queryOffset !== null && !isNaN(queryOffset) ? queryOffset : (page - 1) * limit;

            console.log('📊 Parsed params:', { page, limit, offset, queryOffset });

            const filters = {
                q: req.query.q,
                minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
                maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
                category: req.query.category,
                sort: req.query.sort,
                limit,
                offset
            };

            console.log('🔍 Filters:', filters);

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
    },

    // Lấy danh sách danh mục có sản phẩm
    getCategoriesWithProducts: async (req, res) => {
        try {
            const categories = await Product.getCategoriesWithProducts();
            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            console.error('Get categories with products error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách danh mục có sản phẩm',
                error: error.message
            });
        }
    },

    // Lấy sản phẩm bán chạy nhất
    getBestSellers: async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const products = await Product.getBestSellers(limit);
            res.json({
                success: true,
                data: products
            });
        } catch (error) {
            console.error('Get best sellers error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy sản phẩm bán chạy',
                error: error.message
            });
        }
    },

    // Lấy sản phẩm giảm giá
    getDiscountedProducts: async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;
            const products = await Product.getDiscountedProducts(limit, offset);
            res.json({
                success: true,
                data: products
            });
        } catch (error) {
            console.error('Get discounted products error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy sản phẩm giảm giá',
                error: error.message
            });
        }
    }
};

module.exports = productController;
