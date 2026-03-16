const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Define routes
// Chú ý: Route tĩnh phải đặt trước route động (:id)
router.get('/categories', productController.getCategories);
router.get('/categories-with-products', productController.getCategoriesWithProducts);
router.get('/bestsellers', productController.getBestSellers);
router.get('/discounted', productController.getDiscountedProducts);
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const qaController = require('../controllers/qaController');

router.get('/recently-viewed', optionalAuth, productController.getRecentlyViewed);
router.get('/', productController.getProducts);
router.get('/:productId/similar', productController.getSimilarProducts);
router.post('/:productId/view', optionalAuth, productController.trackProductView);
router.get('/:productId/comments', qaController.getProductComments);
router.post('/:productId/comments', authenticateToken, qaController.addComment);
router.get('/:productId', productController.getProductById);

module.exports = router;
