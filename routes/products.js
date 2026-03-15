const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Define routes
// Chú ý: Route tĩnh phải đặt trước route động (:id)
router.get('/categories', productController.getCategories);
router.get('/categories-with-products', productController.getCategoriesWithProducts);
router.get('/bestsellers', productController.getBestSellers);
router.get('/discounted', productController.getDiscountedProducts);
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dacsanviet_secret_key_2024');
            req.user = decoded;
        } catch (error) { }
    }
    next();
};

router.get('/recently-viewed', optionalAuth, productController.getRecentlyViewed);
router.get('/', productController.getProducts);
router.get('/:id/similar', productController.getSimilarProducts);
router.post('/:id/view', optionalAuth, productController.trackProductView);
router.get('/:id', productController.getProductById);

module.exports = router;
