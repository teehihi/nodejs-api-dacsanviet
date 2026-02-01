const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Define routes
// Chú ý: Route tĩnh (categories) phải đặt trước route động (:id)
router.get('/categories', productController.getCategories);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

module.exports = router;
