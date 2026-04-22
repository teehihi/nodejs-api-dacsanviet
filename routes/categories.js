const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

const { uploadCategory } = require('../middleware/upload');

// Public routes (nếu cần)
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/products', categoryController.getCategoryProducts);

// Admin routes
router.post('/', uploadCategory.single('image'), categoryController.createCategory);
router.put('/:id', uploadCategory.single('image'), categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);
router.post('/:id/add-product', categoryController.addProductToCategory);

module.exports = router;
