const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Define routes
// Chú ý: Route tĩnh phải đặt trước route động (:id)
router.get('/categories', productController.getCategories);
router.get('/categories-with-products', productController.getCategoriesWithProducts);
router.get('/bestsellers', productController.getBestSellers);
router.get('/discounted', productController.getDiscountedProducts);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

module.exports = router;
